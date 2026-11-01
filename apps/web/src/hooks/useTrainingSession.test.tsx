import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { getQueryKey } from '@trpc/react-query';

import type { Chapter, Question } from '@athena/api';
import type { TrainingMode } from '@athena/domain/training';

import { createTrpcTestWrapper } from '../test/trpcTestLink';
import { trpc } from '../utils/trpc';
import { useTrainingSession } from './useTrainingSession';

const chapter = (id: string, lectureId: string, order: number): Chapter => ({
  id,
  lectureId,
  association: '',
  order,
});

const question = (id: string, chapterId: string, order: number): Question => ({
  id,
  chapterId,
  question: `Text ${id}`,
  answer: '',
  order,
  isAnnotated: false,
});

/**
 * An in-memory backend: Lecture l1 has Chapters c1 (2 Questions), c2 (1) and
 * c3 (2); Lecture l2 has c4 (1). Annotating a Question updates the data the
 * Annotated read models derive from.
 */
function createBackend(annotated: string[] = []) {
  const chapters = [
    chapter('c1', 'l1', 0),
    chapter('c2', 'l1', 1),
    chapter('c3', 'l1', 2),
    chapter('c4', 'l2', 0),
  ];
  const questions = [
    question('q1a', 'c1', 0),
    question('q1b', 'c1', 1),
    question('q2a', 'c2', 0),
    question('q3a', 'c3', 0),
    question('q3b', 'c3', 1),
    question('q4a', 'c4', 0),
  ].map((q) => ({ ...q, isAnnotated: annotated.includes(q.id) }));

  const chaptersOf = (lectureId: string) =>
    chapters.filter((c) => c.lectureId === lectureId);
  const questionsOf = (chapterId: string) =>
    questions.filter((q) => q.chapterId === chapterId);

  const handlers = {
    chapters: {
      getChapters: vi.fn(({ lectureId }: { lectureId: string }) =>
        chaptersOf(lectureId),
      ),
    },
    questions: {
      getQuestions: vi.fn(({ chapterId }: { chapterId: string }) =>
        questionsOf(chapterId),
      ),
      getFirstQuestionsByLecture: ({ lectureId }: { lectureId: string }) =>
        Object.fromEntries(
          chaptersOf(lectureId).map((c) => [c.id, questionsOf(c.id)[0]]),
        ),
      getAnnotatedChapterIdsByLecture: vi.fn(
        ({ lectureId }: { lectureId: string }) =>
          chaptersOf(lectureId)
            .filter((c) => questionsOf(c.id).some((q) => q.isAnnotated))
            .map((c) => c.id),
      ),
      getQuestionCountsByLecture: ({ lectureId }: { lectureId: string }) =>
        chaptersOf(lectureId).reduce(
          (sum, c) => sum + questionsOf(c.id).length,
          0,
        ),
      getQuestionCountsPerChapter: ({ lectureId }: { lectureId: string }) =>
        Object.fromEntries(
          chaptersOf(lectureId).map((c) => [c.id, questionsOf(c.id).length]),
        ),
      updateQuestion: vi.fn((input: { id: string; isAnnotated?: boolean }) => {
        const target = questions.find((q) => q.id === input.id)!;
        target.isAnnotated = input.isAnnotated ?? target.isAnnotated;
        return target;
      }),
    },
  };
  return handlers;
}

function renderSession(
  url: string,
  {
    backend = createBackend(),
    mode = 'regular',
  }: { backend?: ReturnType<typeof createBackend>; mode?: TrainingMode } = {},
) {
  const { Wrapper, queryClient } = createTrpcTestWrapper(backend);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Wrapper>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/train/:id/:chapterId?/:questionId?"
            element={children}
          />
          <Route
            path="/train-random/:id/:chapterId?/:questionId?"
            element={children}
          />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  );

  const rendered = renderHook(
    () => {
      const params = useParams();
      return {
        session: useTrainingSession({
          lectureId: params.id!,
          mode,
          chapterId: params.chapterId,
          questionId: params.questionId,
        }),
        path: useLocation().pathname,
        navigate: useNavigate(),
      };
    },
    { wrapper },
  );
  return { ...rendered, backend, queryClient };
}

type Rendered = ReturnType<typeof renderSession>['result'];

const chapterIds = (result: Rendered) =>
  result.current.session.chapters.map((c) => c.id);

const waitForQuestion = (result: Rendered, id: string) =>
  waitFor(() => expect(result.current.session.question?.id).toBe(id));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useTrainingSession', () => {
  describe('ordering', () => {
    it('puts Annotated Chapters first in regular mode', async () => {
      const { result } = renderSession('/train/l1', {
        backend: createBackend(['q3b']),
      });

      await waitFor(() =>
        expect(chapterIds(result)).toEqual(['c3', 'c1', 'c2']),
      );
    });

    it('shuffles the Chapters in randomized mode', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const { result } = renderSession('/train-random/l1', {
        mode: 'randomized',
      });

      await waitFor(() =>
        expect(chapterIds(result)).toEqual(['c2', 'c3', 'c1']),
      );
    });

    it('keeps the order when Annotations change mid-session', async () => {
      const { result, backend } = renderSession('/train/l1/c2');
      await waitForQuestion(result, 'q2a');
      expect(chapterIds(result)).toEqual(['c1', 'c2', 'c3']);

      act(() => result.current.session.toggleAnnotated());

      await waitFor(() =>
        expect(result.current.session.annotatedChapterIds.has('c2')).toBe(true),
      );
      expect(
        backend.questions.getAnnotatedChapterIdsByLecture,
      ).toHaveBeenCalledTimes(2);
      expect(chapterIds(result)).toEqual(['c1', 'c2', 'c3']);
    });

    it('orders again for another Lecture', async () => {
      const { result } = renderSession('/train/l1');
      await waitFor(() =>
        expect(chapterIds(result)).toEqual(['c1', 'c2', 'c3']),
      );

      act(() => result.current.navigate('/train/l2'));

      await waitFor(() => expect(chapterIds(result)).toEqual(['c4']));
      await waitForQuestion(result, 'q4a');
    });
  });

  describe('route resolution', () => {
    it('starts at the first Question of the first Chapter', async () => {
      const { result } = renderSession('/train/l1');

      await waitForQuestion(result, 'q1a');
      expect(result.current.session.chapterIndex).toBe(0);
      expect(result.current.session.questionIndex).toBe(0);
      expect(result.current.session.isFirst).toBe(true);
    });

    it('resolves Chapter and Question ids from the route', async () => {
      const { result } = renderSession('/train/l1/c3/q3b');

      await waitForQuestion(result, 'q3b');
      expect(result.current.session.chapter?.id).toBe('c3');
      expect(result.current.session.chapterIndex).toBe(2);
      expect(result.current.session.questionIndex).toBe(1);
      expect(result.current.session.isLast).toBe(true);
    });
  });

  describe('navigation', () => {
    it('moves to the next Question within a Chapter', async () => {
      const { result } = renderSession('/train/l1/c1/q1a');
      await waitForQuestion(result, 'q1a');

      act(() => result.current.session.next());

      expect(result.current.path).toBe('/train/l1/c1/q1b');
      await waitForQuestion(result, 'q1b');
    });

    it('moves forward across a Chapter boundary', async () => {
      const { result } = renderSession('/train/l1/c1/q1b');
      await waitForQuestion(result, 'q1b');

      act(() => result.current.session.next());

      expect(result.current.path).toBe('/train/l1/c2');
      await waitForQuestion(result, 'q2a');
      expect(result.current.session.chapterIndex).toBe(1);
    });

    it('moves to the previous Question within a Chapter', async () => {
      const { result } = renderSession('/train/l1/c1/q1b');
      await waitForQuestion(result, 'q1b');

      act(() => result.current.session.previous());

      expect(result.current.path).toBe('/train/l1/c1/q1a');
      await waitForQuestion(result, 'q1a');
    });

    it('moves back across a Chapter boundary to its last Question', async () => {
      const { result } = renderSession('/train/l1/c3/q3a');
      await waitForQuestion(result, 'q3a');

      act(() => result.current.session.previous());

      await waitFor(() => expect(result.current.path).toBe('/train/l1/c2/q2a'));
      expect(result.current.session.question?.id).toBe('q2a');

      // The placeholder was replaced, so Back returns to where we came from.
      act(() => result.current.navigate(-1));
      await waitFor(() => expect(result.current.path).toBe('/train/l1/c3/q3a'));
    });

    it('lands on the last Question of a multi-Question Chapter', async () => {
      const { result } = renderSession('/train/l1/c2/q2a');
      await waitForQuestion(result, 'q2a');

      act(() => result.current.session.previous());

      await waitFor(() => expect(result.current.path).toBe('/train/l1/c1/q1b'));
      await waitForQuestion(result, 'q1b');
    });

    it('selects a Chapter at its start', async () => {
      const { result } = renderSession('/train/l1/c1/q1b');
      await waitForQuestion(result, 'q1b');

      act(() =>
        result.current.session.selectChapter(
          result.current.session.chapters[2],
        ),
      );

      expect(result.current.path).toBe('/train/l1/c3');
      await waitForQuestion(result, 'q3a');
    });

    it('stays under the randomized route in randomized mode', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const { result } = renderSession('/train-random/l1', {
        mode: 'randomized',
      });
      await waitForQuestion(result, 'q2a');

      act(() => result.current.session.next());

      expect(result.current.path).toBe('/train-random/l1/c3');
    });

    it('ignores next on the last and previous on the first Question', async () => {
      const { result } = renderSession('/train/l1/c3/q3b');
      await waitForQuestion(result, 'q3b');
      act(() => result.current.session.next());
      expect(result.current.path).toBe('/train/l1/c3/q3b');

      act(() => result.current.navigate('/train/l1/c1/q1a'));
      await waitForQuestion(result, 'q1a');
      act(() => result.current.session.previous());
      expect(result.current.path).toBe('/train/l1/c1/q1a');
    });
  });

  describe('progress', () => {
    it('counts the Questions of earlier Chapters plus the current one', async () => {
      const { result } = renderSession('/train/l1/c3/q3a');
      await waitForQuestion(result, 'q3a');

      await waitFor(() =>
        expect(result.current.session.progress).toEqual({
          position: 4,
          total: 5,
        }),
      );
    });
  });

  describe('Annotated intents', () => {
    it('toggles Annotated and refreshes the Chapter and Annotated ids', async () => {
      const { result, backend } = renderSession('/train/l1/c1/q1b');
      await waitForQuestion(result, 'q1b');
      const questionLoads = backend.questions.getQuestions.mock.calls.length;

      act(() => result.current.session.toggleAnnotated());

      await waitFor(() =>
        expect(result.current.session.question?.isAnnotated).toBe(true),
      );
      expect(backend.questions.updateQuestion).toHaveBeenCalledWith({
        id: 'q1b',
        isAnnotated: true,
      });
      expect(
        backend.questions.getQuestions.mock.calls.slice(questionLoads),
      ).toEqual([[{ chapterId: 'c1' }]]);
      expect(result.current.session.annotatedChapterIds).toEqual(
        new Set(['c1']),
      );

      act(() => result.current.session.toggleAnnotated());

      await waitFor(() =>
        expect(result.current.session.question?.isAnnotated).toBe(false),
      );
      expect(result.current.session.annotatedChapterIds).toEqual(new Set());
    });

    it('"Review again" flags the Question and moves on', async () => {
      const { result, backend, queryClient } =
        renderSession('/train/l1/c1/q1b');
      await waitForQuestion(result, 'q1b');
      const questionsOf = (chapterId: string) =>
        queryClient.getQueryState(
          getQueryKey(trpc.questions.getQuestions, { chapterId }, 'query'),
        );

      act(() => result.current.session.reviewAgain());

      expect(result.current.path).toBe('/train/l1/c2');
      await waitFor(() =>
        expect(backend.questions.updateQuestion).toHaveBeenCalledWith({
          id: 'q1b',
          isAnnotated: true,
        }),
      );
      // The flagged Question's Chapter is refreshed, not the one the learner
      // moved on to.
      await waitFor(() => expect(questionsOf('c1')?.isInvalidated).toBe(true));
      expect(questionsOf('c2')?.isInvalidated).toBe(false);
      await waitFor(() =>
        expect(result.current.session.annotatedChapterIds).toEqual(
          new Set(['c1']),
        ),
      );
    });
  });
});
