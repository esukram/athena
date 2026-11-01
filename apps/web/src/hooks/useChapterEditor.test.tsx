import { describe, expect, it, vi } from 'vitest';

import { act, renderHook, waitFor } from '@testing-library/react';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import type { AppRouter, Chapter, Question } from '@athena/api';

import { createTrpcTestWrapper, deferred } from '../test/trpcTestLink';
import { useChapterEditor } from './useChapterEditor';

type In = inferRouterInputs<AppRouter>;
type Out = inferRouterOutputs<AppRouter>;

const existingChapter: Chapter = {
  id: 'c1',
  lectureId: 'l1',
  association: 'Tag',
  order: 0,
};

/**
 * An in-memory backend for Lecture l1. Chapter c1 holds q1 and q2; c2 holds
 * q3. Every write is a spy whose next answer a test can hold or fail.
 */
function createBackend() {
  let lastId = 0;
  const chapters: Chapter[] = [
    existingChapter,
    { id: 'c2', lectureId: 'l1', association: '', order: 1 },
  ];
  const questions: Question[] = [
    { id: 'q1', chapterId: 'c1', question: 'One', answer: 'A1', order: 0 },
    { id: 'q2', chapterId: 'c1', question: 'Two', answer: 'A2', order: 1 },
    { id: 'q3', chapterId: 'c2', question: 'Three', answer: '', order: 0 },
  ].map((q) => ({ ...q, isAnnotated: false }));

  return {
    chapters: {
      createChapter: vi.fn(
        (
          input: In['chapters']['createChapter'],
        ): Out['chapters']['createChapter'] | Promise<Chapter> => {
          const chapter = {
            id: `new-c${++lastId}`,
            association: '',
            ...input,
          };
          chapters.push(chapter);
          return chapter;
        },
      ),
      updateChapter: vi.fn(
        ({
          id,
          ...data
        }: In['chapters']['updateChapter']): Out['chapters']['updateChapter'] => {
          const chapter = chapters.find((c) => c.id === id)!;
          Object.assign(chapter, data);
          return chapter;
        },
      ),
    },
    questions: {
      getQuestions: vi.fn(
        ({
          chapterId,
        }: In['questions']['getQuestions']): Question[] | Promise<Question[]> =>
          questions.filter((q) => q.chapterId === chapterId),
      ),
      createQuestion: vi.fn(
        (
          input: In['questions']['createQuestion'],
        ): Question | Promise<Question> => {
          const question = {
            id: `new-q${++lastId}`,
            answer: '',
            isAnnotated: false,
            ...input,
          };
          questions.push(question);
          return question;
        },
      ),
      updateQuestion: vi.fn(
        ({
          id,
          ...data
        }: In['questions']['updateQuestion']): Out['questions']['updateQuestion'] => {
          const question = questions.find((q) => q.id === id)!;
          Object.assign(question, data);
          return question;
        },
      ),
      deleteQuestion: vi.fn(
        ({ id }: In['questions']['deleteQuestion']): Promise<void> | void => {
          questions.splice(
            questions.findIndex((q) => q.id === id),
            1,
          );
        },
      ),
    },
  };
}

function renderEditor(backend = createBackend()) {
  const onAutoSaved = vi.fn();
  const { Wrapper } = createTrpcTestWrapper(backend);
  const { result } = renderHook(
    () => useChapterEditor({ lectureId: 'l1', onAutoSaved }),
    { wrapper: Wrapper },
  );
  /** The open editor; fails the test if it is closed. */
  const edit = () => {
    const open = result.current.edit;
    if (!open) throw new Error('editor is not open');
    return open;
  };
  const questionTexts = () => edit().draft.questions.map((q) => q.question);
  return { result, edit, questionTexts, backend, onAutoSaved };
}

/** Lets queued writes and their re-renders run. */
const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('useChapterEditor', () => {
  describe('a new Chapter', () => {
    it('is auto-saved when a Question is added, and save creates only the rest', async () => {
      const { edit, result, backend, onAutoSaved } = renderEditor();
      act(() => result.current.openNew(3, 'First'));

      act(() => void edit().addQuestion());
      await waitFor(() => expect(onAutoSaved).toHaveBeenCalledTimes(1));
      expect(backend.chapters.createChapter).toHaveBeenCalledWith({
        lectureId: 'l1',
        order: 3,
        association: '',
      });
      expect(backend.questions.createQuestion).toHaveBeenCalledTimes(1);

      const second = edit().draft.questions[1].key;
      act(() => edit().updateQuestion(second, { question: 'Second' }));
      await act(() => edit().save());

      expect(result.current.edit).toBeNull();
      expect(backend.chapters.createChapter).toHaveBeenCalledTimes(1);
      expect(
        backend.questions.createQuestion.mock.calls.map(([q]) => q.question),
      ).toEqual(['First', 'Second']);
      expect(backend.questions.updateQuestion).not.toHaveBeenCalled();
    });

    it('creates nothing twice when save overlaps an auto-save still creating the Chapter', async () => {
      const { edit, result, backend } = renderEditor();
      const chapterCreated = deferred<Chapter>();
      backend.chapters.createChapter.mockImplementationOnce(
        () => chapterCreated.promise,
      );
      act(() => result.current.openNew(0, 'First'));

      act(() => void edit().addQuestion());
      const second = edit().draft.questions[1].key;
      act(() => edit().updateQuestion(second, { question: 'Second' }));
      let saved!: Promise<void>;
      act(() => {
        saved = edit().save();
      });
      expect(edit().isSaving).toBe(true);

      chapterCreated.resolve({ ...existingChapter, id: 'held' });
      await act(() => saved);

      expect(result.current.edit).toBeNull();
      expect(backend.chapters.createChapter).toHaveBeenCalledTimes(1);
      expect(
        backend.questions.createQuestion.mock.calls.map(([q]) => q),
      ).toEqual([
        { chapterId: 'held', question: 'First', answer: '', order: 0 },
        { chapterId: 'held', question: 'Second', answer: '', order: 1 },
      ]);
    });

    it('creates nothing twice when save overlaps an auto-save still creating a Question', async () => {
      const { edit, result, backend } = renderEditor();
      const questionCreated = deferred<Question>();
      backend.questions.createQuestion.mockImplementationOnce((input) =>
        questionCreated.promise.then(() => ({
          id: 'held',
          answer: '',
          isAnnotated: false,
          ...input,
        })),
      );
      act(() => result.current.openNew(0, 'First'));
      act(() => void edit().addQuestion());
      await waitFor(() =>
        expect(backend.questions.createQuestion).toHaveBeenCalledTimes(1),
      );

      // Edited while its create is in flight: save must update, not create.
      const first = edit().draft.questions[0].key;
      act(() => edit().updateQuestion(first, { answer: 'Answer' }));
      let saved!: Promise<void>;
      act(() => {
        saved = edit().save();
      });
      questionCreated.resolve({} as Question);
      await act(() => saved);

      expect(backend.questions.createQuestion).toHaveBeenCalledTimes(1);
      expect(backend.questions.updateQuestion).toHaveBeenCalledWith({
        id: 'held',
        question: 'First',
        answer: 'Answer',
        order: 0,
      });
    });

    it('stays open after a failed save and retries only what is missing', async () => {
      const { edit, result, backend } = renderEditor();
      act(() => result.current.openNew(0, 'First'));
      act(() => void edit().addQuestion());
      await waitFor(() =>
        expect(backend.questions.createQuestion).toHaveBeenCalledTimes(1),
      );
      const second = edit().draft.questions[1].key;
      act(() => edit().updateQuestion(second, { question: 'Second' }));

      backend.questions.createQuestion.mockImplementationOnce(() => {
        throw new Error('offline');
      });
      await act(() => edit().save());
      expect(edit()).toMatchObject({ isSaving: false, saveFailed: true });
      expect(edit().draft.questions).toHaveLength(2);

      await act(() => edit().save());
      expect(result.current.edit).toBeNull();
      expect(backend.chapters.createChapter).toHaveBeenCalledTimes(1);
      expect(
        backend.questions.createQuestion.mock.calls.map(([q]) => q.question),
      ).toEqual(['First', 'Second', 'Second']);
    });

    it('creates the Chapter once after its creation failed', async () => {
      const { edit, result, backend } = renderEditor();
      backend.chapters.createChapter.mockImplementationOnce(() => {
        throw new Error('offline');
      });
      act(() => result.current.openNew(0, 'First'));

      await act(() => edit().save());
      expect(edit().saveFailed).toBe(true);
      expect(backend.questions.createQuestion).not.toHaveBeenCalled();

      await act(() => edit().save());
      expect(result.current.edit).toBeNull();
      expect(backend.chapters.createChapter).toHaveBeenCalledTimes(2);
      expect(backend.questions.createQuestion).toHaveBeenCalledTimes(1);
    });

    it('saves a Tag changed after the Chapter was created', async () => {
      const { edit, result, backend, onAutoSaved } = renderEditor();
      act(() => result.current.openNew(0, 'First'));
      act(() => edit().setTag('Old'));
      act(() => void edit().addQuestion());
      await waitFor(() => expect(onAutoSaved).toHaveBeenCalled());
      expect(backend.chapters.createChapter).toHaveBeenCalledWith(
        expect.objectContaining({ association: 'Old' }),
      );

      act(() => edit().setTag('New'));
      await act(() => edit().save());

      expect(backend.chapters.updateChapter).toHaveBeenCalledTimes(1);
      expect(backend.chapters.updateChapter).toHaveBeenCalledWith({
        id: 'new-c1',
        association: 'New',
      });
    });

    it('keeps a Question row identity when auto-save persists it (#297)', async () => {
      const { edit, result, backend, onAutoSaved } = renderEditor();
      act(() => result.current.openNew(0, 'First'));
      const keyBefore = edit().draft.questions[0].key;

      act(() => void edit().addQuestion());
      await waitFor(() => expect(onAutoSaved).toHaveBeenCalled());

      expect(edit().draft.questions[0].key).toBe(keyBefore);
      act(() => edit().updateQuestion(keyBefore, { question: 'Renamed' }));
      await act(() => edit().save());
      expect(backend.questions.updateQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-q2', question: 'Renamed' }),
      );
      expect(backend.questions.createQuestion).toHaveBeenCalledTimes(1);
    });

    it('deletes a Question whose create was still in flight once it exists', async () => {
      const { edit, result, backend, questionTexts } = renderEditor();
      const questionCreated = deferred<void>();
      backend.questions.createQuestion.mockImplementationOnce((input) =>
        questionCreated.promise.then(() => ({
          id: 'held',
          answer: '',
          isAnnotated: false,
          ...input,
        })),
      );
      act(() => result.current.openNew(0, 'First'));
      act(() => void edit().addQuestion());
      await waitFor(() =>
        expect(backend.questions.createQuestion).toHaveBeenCalled(),
      );

      act(() => edit().deleteQuestion(edit().draft.questions[0].key));
      expect(questionTexts()).toEqual(['']);
      expect(backend.questions.deleteQuestion).not.toHaveBeenCalled();

      questionCreated.resolve();
      await waitFor(() =>
        expect(backend.questions.deleteQuestion).toHaveBeenCalledWith({
          id: 'held',
        }),
      );
    });

    it('is dirty once edited, and clean again after an auto-save', async () => {
      const { edit, result, onAutoSaved } = renderEditor();
      act(() => result.current.openNew(0, 'First'));
      expect(edit().isDirty).toBe(false);

      const first = edit().draft.questions[0].key;
      act(() => edit().updateQuestion(first, { answer: 'Answer' }));
      expect(edit().isDirty).toBe(true);

      act(() => void edit().addQuestion());
      await waitFor(() => expect(onAutoSaved).toHaveBeenCalled());
      expect(edit().isDirty).toBe(false);
    });
  });

  describe('an existing Chapter', () => {
    it('opens with its Questions once they have loaded', async () => {
      const { result, questionTexts, edit } = renderEditor();
      act(() => result.current.openExisting(existingChapter));
      expect(result.current.edit).toBeNull();

      await waitFor(() => expect(result.current.edit).not.toBeNull());
      expect(questionTexts()).toEqual(['One', 'Two']);
      expect(edit()).toMatchObject({ isDirty: false, canSave: true });
      expect(edit().draft.tag).toBe('Tag');
    });

    it('opens with one blank Question when loading fails', async () => {
      const backend = createBackend();
      backend.questions.getQuestions.mockImplementationOnce(() => {
        throw new Error('offline');
      });
      const { result, questionTexts } = renderEditor(backend);
      act(() => result.current.openExisting(existingChapter));

      await waitFor(() => expect(result.current.edit).not.toBeNull());
      expect(questionTexts()).toEqual(['']);
    });

    it('writes nothing when a Question is added without changes', async () => {
      const { edit, result, backend, onAutoSaved } = renderEditor();
      act(() => result.current.openExisting(existingChapter));
      await waitFor(() => expect(result.current.edit).not.toBeNull());

      act(() => void edit().addQuestion());
      await settle();

      expect(onAutoSaved).not.toHaveBeenCalled();
      expect(backend.questions.updateQuestion).not.toHaveBeenCalled();
      expect(backend.questions.createQuestion).not.toHaveBeenCalled();
    });

    it('saves only the Questions that changed', async () => {
      const { edit, result, backend } = renderEditor();
      act(() => result.current.openExisting(existingChapter));
      await waitFor(() => expect(result.current.edit).not.toBeNull());

      const second = edit().draft.questions[1].key;
      act(() => edit().updateQuestion(second, { question: ' Two! ' }));
      await act(() => edit().save());

      expect(backend.chapters.createChapter).not.toHaveBeenCalled();
      expect(backend.chapters.updateChapter).not.toHaveBeenCalled();
      expect(backend.questions.updateQuestion).toHaveBeenCalledTimes(1);
      expect(backend.questions.updateQuestion).toHaveBeenCalledWith({
        id: 'q2',
        question: 'Two!',
        answer: 'A2',
        order: 1,
      });
    });

    it('deletes a persisted Question right away', async () => {
      const { edit, result, backend, questionTexts } = renderEditor();
      act(() => result.current.openExisting(existingChapter));
      await waitFor(() => expect(result.current.edit).not.toBeNull());

      act(() => edit().deleteQuestion(edit().draft.questions[0].key));

      expect(questionTexts()).toEqual(['Two']);
      await waitFor(() =>
        expect(backend.questions.deleteQuestion).toHaveBeenCalledWith({
          id: 'q1',
        }),
      );
    });
  });

  describe('closing and reopening', () => {
    it('ignores a late load for a Chapter that is no longer open', async () => {
      const backend = createBackend();
      const c1Loaded = deferred<Question[]>();
      backend.questions.getQuestions.mockImplementationOnce(
        () => c1Loaded.promise,
      );
      const { result, questionTexts } = renderEditor(backend);

      act(() => result.current.openExisting(existingChapter));
      act(() =>
        result.current.openExisting({
          id: 'c2',
          lectureId: 'l1',
          association: '',
          order: 1,
        }),
      );
      await waitFor(() => expect(result.current.edit).not.toBeNull());
      expect(questionTexts()).toEqual(['Three']);

      c1Loaded.resolve([]);
      await settle();
      expect(questionTexts()).toEqual(['Three']);
    });

    it('lets a write in flight finish after close without reopening the editor', async () => {
      const { edit, result, backend, onAutoSaved, questionTexts } =
        renderEditor();
      const chapterCreated = deferred<Chapter>();
      backend.chapters.createChapter.mockImplementationOnce(
        () => chapterCreated.promise,
      );
      act(() => result.current.openNew(0, 'First'));
      act(() => void edit().addQuestion());
      act(() => edit().close());

      act(() => result.current.openNew(1, 'Another'));
      chapterCreated.resolve({ ...existingChapter, id: 'held' });
      await waitFor(() =>
        expect(backend.questions.createQuestion).toHaveBeenCalledTimes(1),
      );
      await settle();

      expect(onAutoSaved).not.toHaveBeenCalled();
      expect(questionTexts()).toEqual(['Another']);
      expect(edit().isDirty).toBe(false);
    });
  });
});
