import { useRef, useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { newClientKey } from '../utils/clientKey';
import { trpc } from '../utils/trpc';

/**
 * A Question in the Chapter editor. `key` is its identity for the whole
 * editing session and survives the Question being persisted; the persisted
 * id stays inside the editor.
 */
export interface DraftQuestion {
  key: string;
  question: string;
  answer: string;
  order: number;
}

export interface ChapterDraft {
  tag: string;
  questions: DraftQuestion[];
}

type QuestionContent = Omit<DraftQuestion, 'key'>;

interface EditorView {
  draft: ChapterDraft;
  /** The draft as last loaded or auto-saved; `isDirty` compares against it. */
  baseline: ChapterDraft;
  isSaving: boolean;
  saveFailed: boolean;
}

/** One opening of the editor, and what it knows the server holds. */
interface Session {
  /** Null until a new Chapter is created. */
  chapterId: string | null;
  order: number;
  persistedTag: string;
  /** Persisted Questions, by draft key. */
  persisted: Map<string, QuestionContent & { id: string }>;
  /** Writes run one at a time, in the order they were asked for. */
  queue: Promise<unknown>;
  /** Null while the Chapter's Questions load. */
  view: EditorView | null;
}

const blankQuestion = (order: number, question = ''): DraftQuestion => ({
  key: newClientKey(),
  question,
  answer: '',
  order,
});

const hasContent = (q: DraftQuestion) => q.question.trim() !== '';

const isDirty = ({ draft, baseline }: EditorView) =>
  draft.tag !== baseline.tag ||
  draft.questions.length !== baseline.questions.length ||
  draft.questions.some(
    (q, i) =>
      q.question !== baseline.questions[i].question ||
      q.answer !== baseline.questions[i].answer,
  );

const newSession = (
  chapterId: string | null,
  order: number,
  persistedTag: string,
  view: EditorView | null,
): Session => ({
  chapterId,
  order,
  persistedTag,
  persisted: new Map(),
  queue: Promise.resolve(),
  view,
});

const freshView = (draft: ChapterDraft): EditorView => ({
  draft,
  baseline: draft,
  isSaving: false,
  saveFailed: false,
});

/**
 * The Chapter editing lifecycle: opening a new or existing Chapter, the
 * draft, auto-save and manual save as one serialized write path, immediate
 * Question deletion, and which draft Question maps to which persisted id.
 *
 * Auto-save runs when a Question is added; manual save writes and closes.
 * Both write only what differs from what this session knows is persisted, so
 * overlapping saves never create a Chapter or Question twice.
 */
export function useChapterEditor({
  lectureId,
  onAutoSaved,
}: {
  lectureId: string;
  onAutoSaved?: () => void;
}) {
  const utils = trpc.useUtils();
  const sessionRef = useRef<Session | null>(null);
  const [view, setView] = useState<EditorView | null>(null);

  // A closed (or replaced) session keeps writing, but no longer renders.
  const commit = (s: Session, next: EditorView) => {
    s.view = next;
    if (sessionRef.current === s) setView(next);
  };

  const begin = (s: Session) => {
    sessionRef.current = s;
    setView(s.view);
  };

  const enqueue = <T>(s: Session, job: () => Promise<T>): Promise<T> => {
    const run = s.queue.then(job);
    s.queue = run.catch(() => {});
    return run;
  };

  const refresh = (chapterId: string) =>
    Promise.all([
      utils.chapters.getChapters.invalidate({ lectureId }),
      utils.chapters.getDistinctAssociations.invalidate(),
      utils.questions.getQuestions.invalidate({ chapterId }),
      utils.questions.getFirstQuestionsByLecture.invalidate({ lectureId }),
    ]);

  /**
   * Writes the current draft: creates the Chapter if needed, then the Tag and
   * every new or changed Question with content. Returns the draft it wrote,
   * or null when nothing needed writing. Throws if any write failed; the ones
   * that succeeded are remembered, so the next write only retries the rest.
   */
  const write = async (s: Session): Promise<ChapterDraft | null> => {
    if (!s.view) return null;
    const { draft } = s.view;
    const questions = draft.questions.filter(hasContent);
    if (questions.length === 0) return null;

    let created = false;
    if (s.chapterId === null) {
      const chapter = await utils.client.chapters.createChapter.mutate({
        lectureId,
        order: s.order,
        association: draft.tag,
      });
      s.chapterId = chapter.id;
      s.persistedTag = draft.tag;
      created = true;
    }
    const chapterId = s.chapterId;

    const writes: Promise<unknown>[] = [];
    if (draft.tag !== s.persistedTag) {
      writes.push(
        utils.client.chapters.updateChapter
          .mutate({ id: chapterId, association: draft.tag })
          .then(() => {
            s.persistedTag = draft.tag;
          }),
      );
    }
    for (const q of questions) {
      const content = {
        question: q.question.trim(),
        answer: q.answer,
        order: q.order,
      };
      const saved = s.persisted.get(q.key);
      if (!saved) {
        writes.push(
          utils.client.questions.createQuestion
            .mutate({ chapterId, ...content })
            .then(({ id }) => s.persisted.set(q.key, { id, ...content })),
        );
      } else if (
        saved.question !== content.question ||
        saved.answer !== content.answer ||
        saved.order !== content.order
      ) {
        writes.push(
          utils.client.questions.updateQuestion
            .mutate({ id: saved.id, ...content })
            .then(() => s.persisted.set(q.key, { id: saved.id, ...content })),
        );
      }
    }

    // Settle every write before the next job starts, even if one fails.
    const results = await Promise.allSettled(writes);
    if (created || writes.length > 0) void refresh(chapterId);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) throw failed.reason;
    return created || writes.length > 0 ? draft : null;
  };

  const openNew = (order: number, firstQuestion: string) =>
    begin(
      newSession(
        null,
        order,
        '',
        freshView({ tag: '', questions: [blankQuestion(0, firstQuestion)] }),
      ),
    );

  const openExisting = (chapter: Chapter) => {
    const s = newSession(chapter.id, chapter.order, chapter.association, null);
    begin(s);
    void (async () => {
      let loaded: Question[] = [];
      try {
        loaded = await utils.questions.getQuestions.fetch({
          chapterId: chapter.id,
        });
      } catch {
        // Open with one blank Question, so the Chapter can still be edited.
      }
      const questions = loaded.map(({ id, question, answer, order }) => {
        const draft = { ...blankQuestion(order, question), answer };
        s.persisted.set(draft.key, { id, question, answer, order });
        return draft;
      });
      commit(
        s,
        freshView({
          tag: chapter.association,
          questions: questions.length > 0 ? questions : [blankQuestion(0)],
        }),
      );
    })();
  };

  const close = () => {
    sessionRef.current = null;
    setView(null);
  };

  const editDraft = (change: (draft: ChapterDraft) => ChapterDraft) => {
    const s = sessionRef.current;
    if (s?.view) commit(s, { ...s.view, draft: change(s.view.draft) });
  };

  const setTag = (tag: string) => editDraft((d) => ({ ...d, tag }));

  const updateQuestion = (
    key: string,
    patch: Partial<Pick<DraftQuestion, 'question' | 'answer'>>,
  ) =>
    editDraft((d) => ({
      ...d,
      questions: d.questions.map((q) =>
        q.key === key ? { ...q, ...patch } : q,
      ),
    }));

  /** Appends a blank Question, auto-saves, and returns the new key. */
  const addQuestion = (): string | undefined => {
    const s = sessionRef.current;
    if (!s?.view) return undefined;
    const { draft } = s.view;
    const added = blankQuestion(
      Math.max(-1, ...draft.questions.map((q) => q.order)) + 1,
    );
    commit(s, {
      ...s.view,
      draft: { ...draft, questions: [...draft.questions, added] },
    });
    enqueue(s, () => write(s)).then(
      (written) => {
        if (!written || !s.view) return;
        commit(s, { ...s.view, baseline: written });
        if (sessionRef.current === s) onAutoSaved?.();
      },
      // ponytail: a failed auto-save stays silent, as before; the next save
      // retries whatever is still missing.
      () => {},
    );
    return added.key;
  };

  /** Removes a Question now, and from the server once earlier writes settle. */
  const deleteQuestion = (key: string) => {
    const s = sessionRef.current;
    if (!s) return;
    editDraft((d) => ({
      ...d,
      questions: d.questions.filter((q) => q.key !== key),
    }));
    enqueue(s, async () => {
      const saved = s.persisted.get(key);
      if (!saved || s.chapterId === null) return;
      await utils.client.questions.deleteQuestion.mutate({ id: saved.id });
      s.persisted.delete(key);
      void refresh(s.chapterId);
    }).catch(
      // ponytail: a failed delete stays silent, as before.
      () => {},
    );
  };

  /** Writes the draft after any pending writes, then closes; stays open on failure. */
  const save = async () => {
    const s = sessionRef.current;
    if (!s?.view || s.view.isSaving || !s.view.draft.questions.some(hasContent))
      return;
    commit(s, { ...s.view, isSaving: true, saveFailed: false });
    try {
      await enqueue(s, () => write(s));
      if (sessionRef.current === s) close();
    } catch {
      if (s.view) commit(s, { ...s.view, isSaving: false, saveFailed: true });
    }
  };

  return {
    openNew,
    openExisting,
    /** The open editor, or null when closed or still loading. */
    edit: view && {
      draft: view.draft,
      isDirty: isDirty(view),
      canSave: view.draft.questions.some(hasContent),
      isSaving: view.isSaving,
      saveFailed: view.saveFailed,
      setTag,
      updateQuestion,
      addQuestion,
      deleteQuestion,
      save,
      close,
    },
  };
}

export type ChapterEdit = NonNullable<
  ReturnType<typeof useChapterEditor>['edit']
>;
