import { useNavigate } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Chapter, Question } from '@athena/api';
import {
  type TrainingMode,
  isFirstQuestion as computeIsFirstQuestion,
  isLastQuestion as computeIsLastQuestion,
  nextTrainingStep,
  orderChaptersForTraining,
  prevTrainingStep,
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
  const basePath = mode === 'randomized' ? 'train-random' : 'train';
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

  const loadedChapters = chaptersQuery.data ?? EMPTY;

  const annotatedChapterIds = useMemo(
    () => new Set(annotatedChapterIdsQuery.data ?? EMPTY),
    [annotatedChapterIdsQuery.data],
  );

  const firstQuestionText = useCallback(
    (id: string): string | undefined =>
      firstQuestionsQuery.data?.[id]?.question,
    [firstQuestionsQuery.data],
  );

  // Ordered once per Lecture: annotating mid-session or a refetch must not
  // reshuffle the Chapters under the learner.
  const orderedLectureIdRef = useRef<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    if (
      loadedChapters.length > 0 &&
      annotatedChapterIdsQuery.data !== undefined &&
      orderedLectureIdRef.current !== lectureId
    ) {
      setChapters(
        orderChaptersForTraining(
          loadedChapters,
          mode,
          annotatedChapterIdsQuery.data,
        ),
      );
      orderedLectureIdRef.current = lectureId;
    }
  }, [lectureId, loadedChapters, annotatedChapterIdsQuery.data, mode]);

  const chapterIndex = useMemo(() => {
    const index = chapterId
      ? chapters.findIndex((c) => c.id === chapterId)
      : -1;
    return index === -1 ? 0 : index;
  }, [chapterId, chapters]);
  const chapter: Chapter | undefined = chapters[chapterIndex];

  const questionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: chapter?.id ?? '' },
    { enabled: !!chapter?.id },
  );
  const questions = questionsQuery.data ?? EMPTY;

  const questionIndex = useMemo(() => {
    const index = questionId
      ? questions.findIndex((q) => q.id === questionId)
      : -1;
    return index === -1 ? 0 : index;
  }, [questionId, questions]);
  const question: Question | undefined = questions[questionIndex];

  const cursor = {
    selectedChapterIndex: chapterIndex,
    selectedQuestionIndex: questionIndex,
    currentChapterQuestionCount: questions.length,
    chapterCount: chapters.length,
  };
  const isFirst = computeIsFirstQuestion(cursor);
  const isLast = computeIsLastQuestion(cursor);

  const goTo = useCallback(
    (toChapterId: string, toQuestionId?: string, replace = false) =>
      navigate(
        `/${basePath}/${lectureId}/${toChapterId}${toQuestionId ? `/${toQuestionId}` : ''}`,
        { replace },
      ),
    [navigate, basePath, lectureId],
  );

  const next = () => {
    const step = nextTrainingStep(cursor);
    if (step?.kind === 'question') {
      goTo(chapters[step.chapterIndex].id, questions[step.questionIndex].id);
    } else if (step?.kind === 'chapter-start') {
      goTo(chapters[step.chapterIndex].id);
    }
  };

  const previous = () => {
    const step = prevTrainingStep(cursor);
    if (step?.kind === 'question') {
      goTo(chapters[step.chapterIndex].id, questions[step.questionIndex].id);
    } else if (step?.kind === 'chapter-end') {
      goTo(chapters[step.chapterIndex].id, LAST_QUESTION);
    }
  };

  const selectChapter = (target: Chapter) => goTo(target.id);

  // Resolve the placeholder once the Chapter's Questions are known.
  useEffect(() => {
    if (questionId === LAST_QUESTION && chapter && questions.length > 0) {
      goTo(chapter.id, questions[questions.length - 1].id, true);
    }
  }, [questionId, chapter, questions, goTo]);

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
    isLoadingChapters: chaptersQuery.isLoading,
    hasChapters: loadedChapters.length > 0,
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
        selectedQuestionIndex: questionIndex,
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
