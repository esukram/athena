import { useLocation, useNavigate } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Chapter, Question } from '@athena/api';
import {
  type TrainingMode,
  isFirstQuestion as computeIsFirstQuestion,
  isLastQuestion as computeIsLastQuestion,
  nextTrainingStep,
  orderChaptersForTraining,
  prevTrainingStep,
  seededRandom,
  trainingProgressPosition,
} from '@athena/domain/training';

import { trpc } from '../utils/trpc';

export interface TrainingSessionParams {
  lectureId: string;
  mode: TrainingMode;
  /** Route params; the URL is the single source of truth for position. */
  chapterId?: string;
  questionId?: string;
}

/** Route placeholder for "the last Question of this Chapter". */
const LAST_QUESTION = '__last__';

const EMPTY: never[] = [];

/** A `?seed=` value: an unsigned 32-bit integer in canonical decimal form. */
function parseSeed(value: string | null): number | undefined {
  if (value === null || !/^(0|[1-9]\d{0,9})$/.test(value)) return undefined;
  const seed = Number(value);
  return seed <= 0xffffffff ? seed : undefined;
}

const newSeed = () => Math.floor(Math.random() * 2 ** 32);

export type TrainingSessionStatus =
  'loading' | 'empty' | 'ready' | 'error' | 'not-found';

/**
 * One Training session over a Lecture: loads and orders its Chapters once,
 * resolves the route into the active Chapter and Question, and offers the
 * navigation and Annotated intents. Position lives in the URL; intents only
 * navigate.
 */
export function useTrainingSession({
  lectureId,
  mode,
  chapterId,
  questionId,
}: TrainingSessionParams) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = mode === 'randomized' ? 'train-random' : 'train';
  // Randomized order is a function of the URL's shuffle seed, so a reload,
  // Back/Forward or a shared link reproduce it. Regular order ignores it.
  const seed =
    mode === 'randomized'
      ? parseSeed(new URLSearchParams(location.search).get('seed'))
      : undefined;
  const needsSeed = mode === 'randomized' && seed === undefined;
  const lectureInput = { lectureId };
  const byLecture = { enabled: !!lectureId };

  const chaptersQuery = trpc.chapters.getChapters.useQuery(
    lectureInput,
    byLecture,
  );
  const firstQuestionsQuery =
    trpc.questions.getFirstQuestionsByLecture.useQuery(lectureInput, byLecture);
  const annotatedChapterIdsQuery =
    trpc.questions.getAnnotatedChapterIdsByLecture.useQuery(
      lectureInput,
      byLecture,
    );
  const totalQuestionsQuery =
    trpc.questions.getQuestionCountsByLecture.useQuery(lectureInput, byLecture);
  const questionCountsPerChapterQuery =
    trpc.questions.getQuestionCountsPerChapter.useQuery(
      lectureInput,
      byLecture,
    );

  const annotatedChapterIds = useMemo(
    () => new Set(annotatedChapterIdsQuery.data ?? EMPTY),
    [annotatedChapterIdsQuery.data],
  );

  const firstQuestionText = useCallback(
    (id: string): string | undefined =>
      firstQuestionsQuery.data?.[id]?.question,
    [firstQuestionsQuery.data],
  );

  // Ordered once per Lecture and seed: annotating mid-session or a refetch
  // must not reshuffle the Chapters under the learner.
  const [ordering, setOrdering] = useState<{
    lectureId: string;
    seed: number | undefined;
    chapters: Chapter[];
  } | null>(null);
  const isOrdered = ordering?.lectureId === lectureId && ordering.seed === seed;
  const chapters = isOrdered ? ordering.chapters : EMPTY;

  // Set during render rather than in an effect (React's pattern for state
  // derived from other values); `chapters` stays empty until then.
  if (
    !isOrdered &&
    !needsSeed &&
    chaptersQuery.data !== undefined &&
    annotatedChapterIdsQuery.data !== undefined
  ) {
    setOrdering({
      lectureId,
      seed,
      chapters: orderChaptersForTraining(
        chaptersQuery.data,
        mode,
        annotatedChapterIdsQuery.data,
        seed === undefined ? undefined : seededRandom(seed),
      ),
    });
  }

  // A missing id means "the start"; an unknown one resolves to -1.
  const chapterIndex = chapterId
    ? chapters.findIndex((c) => c.id === chapterId)
    : 0;
  const chapter: Chapter | undefined = chapters[chapterIndex];

  const questionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: chapter?.id ?? '' },
    { enabled: !!chapter?.id },
  );
  const questions = questionsQuery.data ?? EMPTY;

  // The placeholder resolves below; until then no Question is active.
  const questionIndex =
    questionId === LAST_QUESTION
      ? -1
      : questionId
        ? questions.findIndex((q) => q.id === questionId)
        : 0;
  const question: Question | undefined = questions[questionIndex];

  let status: TrainingSessionStatus;
  let notFound: 'chapter' | 'question' | undefined;
  if (!isOrdered) {
    status =
      chaptersQuery.isError || annotatedChapterIdsQuery.isError
        ? 'error'
        : 'loading';
  } else if (!chapter) {
    // An explicit unknown id is not found, even in a Lecture without
    // Chapters; no id there means there is nothing to train yet.
    if (chapterId) {
      status = 'not-found';
      notFound = 'chapter';
    } else {
      status = 'empty';
    }
  } else if (questionsQuery.data === undefined) {
    status = questionsQuery.isError ? 'error' : 'loading';
  } else if (questionId === LAST_QUESTION) {
    // Resolving: the effect below replaces the URL.
    status = 'loading';
  } else if (question) {
    status = 'ready';
  } else if (questionId) {
    status = 'not-found';
    notFound = 'question';
  } else {
    status = 'empty';
  }

  // Next/previous only move from a settled position: while loading (which
  // includes resolving the placeholder) a second press is ignored.
  const canStep = status === 'ready' || status === 'empty';
  const cursor = {
    selectedChapterIndex: chapterIndex,
    selectedQuestionIndex: Math.max(questionIndex, 0),
    currentChapterQuestionCount: questions.length,
    chapterCount: chapters.length,
  };
  const isFirst = !canStep || computeIsFirstQuestion(cursor);
  const isLast = !canStep || computeIsLastQuestion(cursor);

  // React Router keys the first history entry 'default', but a replace gives
  // it a fresh key. The session's own replaces carry the marker forward, so
  // "Go back" never leaves the app (only this hook replaces on this page).
  const isFirstEntry =
    location.key === 'default' ||
    (location.state as { firstEntry?: boolean } | null)?.firstEntry === true;

  const goTo = useCallback(
    (
      toChapterId?: string,
      toQuestionId?: string,
      replace = false,
      toSeed = seed,
    ) =>
      navigate(
        {
          pathname: `/${[basePath, lectureId, toChapterId, toQuestionId].filter(Boolean).join('/')}`,
          search: toSeed === undefined ? '' : `?seed=${toSeed}`,
        },
        {
          replace,
          state: replace && isFirstEntry ? { firstEntry: true } : null,
        },
      ),
    [navigate, basePath, lectureId, isFirstEntry, seed],
  );

  // A randomized URL without a valid seed gets a fresh one in place, so the
  // URL becomes canonical before anything is ordered.
  useEffect(() => {
    if (needsSeed) goTo(chapterId, questionId, true, newSeed());
  }, [needsSeed, goTo, chapterId, questionId]);

  const next = () => {
    if (!canStep) return;
    const step = nextTrainingStep(cursor);
    if (step?.kind === 'question') {
      goTo(chapters[step.chapterIndex].id, questions[step.questionIndex].id);
    } else if (step?.kind === 'chapter-start') {
      goTo(chapters[step.chapterIndex].id);
    }
  };

  const previous = () => {
    if (!canStep) return;
    const step = prevTrainingStep(cursor);
    if (step?.kind === 'question') {
      goTo(chapters[step.chapterIndex].id, questions[step.questionIndex].id);
    } else if (step?.kind === 'chapter-end') {
      goTo(chapters[step.chapterIndex].id, LAST_QUESTION);
    }
  };

  const selectChapter = (target: Chapter) => goTo(target.id);

  // Resolve the placeholder once the Chapter's Questions are known. The
  // destination lives in the URL, so once the learner moves on there is
  // nothing left to redirect. An empty Chapter lands on its Chapter-only URL.
  useEffect(() => {
    if (questionId !== LAST_QUESTION || !chapter || !questionsQuery.data) {
      return;
    }
    const lastQuestion = questionsQuery.data[questionsQuery.data.length - 1];
    goTo(chapter.id, lastQuestion?.id, true);
  }, [questionId, chapter, questionsQuery.data, goTo]);

  /** Re-runs the lookups that failed; the URL is left as it is. */
  const retry = () => {
    for (const query of [
      chaptersQuery,
      annotatedChapterIdsQuery,
      questionsQuery,
    ]) {
      if (query.isError) void query.refetch();
    }
  };

  const canGoBack = !isFirstEntry;
  const goBack = () => navigate(-1);

  /**
   * Unknown Chapter: the Lecture's first (or the Lecture itself when it has
   * none). Unknown Question: its Chapter.
   */
  const goToCanonical = () => {
    const target = notFound === 'chapter' ? chapters[0] : chapter;
    goTo(target?.id, undefined, true);
  };

  const utils = trpc.useUtils();
  const updateQuestion = trpc.questions.updateQuestion.useMutation({
    // Invalidate by the Chapter the server reports for the updated Question.
    // `onSuccess` sees the latest render, so the current Questions may already
    // belong to the Chapter the learner moved on to ("Review again").
    onSuccess: (updated) => {
      void utils.questions.getQuestions.invalidate(
        updated ? { chapterId: updated.chapterId } : undefined,
      );
      void utils.questions.getAnnotatedChapterIdsByLecture.invalidate({
        lectureId,
      });
    },
  });

  const toggleAnnotated = () => {
    if (!question) return;
    updateQuestion.mutate({
      id: question.id,
      isAnnotated: !question.isAnnotated,
    });
  };

  /** Flag the current Question for review, then move on. */
  const reviewAgain = () => {
    if (!question) return;
    updateQuestion.mutate({ id: question.id, isAnnotated: true });
    next();
  };

  return {
    status,
    /** Which route id is unknown while `status` is `not-found`. */
    notFound,
    retry,
    canGoBack,
    goBack,
    goToCanonical,
    /** Chapters in session order. */
    chapters,
    chapterIndex,
    chapter,
    questions,
    questionIndex,
    question,
    isFirst,
    isLast,
    next,
    previous,
    selectChapter,
    progress: {
      position: trainingProgressPosition({
        sortedChapters: chapters,
        selectedChapterIndex: chapterIndex,
        selectedQuestionIndex: cursor.selectedQuestionIndex,
        questionCountsPerChapter: questionCountsPerChapterQuery.data ?? {},
      }),
      total: totalQuestionsQuery.data,
    },
    toggleAnnotated,
    reviewAgain,
    annotatedChapterIds,
    firstQuestionText,
  };
}

export type TrainingSession = ReturnType<typeof useTrainingSession>;
