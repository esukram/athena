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

import { createTrpcTestWrapper, deferred } from '../test/trpcTestLink';
import { trpc } from '../utils/trpc';
import {
  type TrainingSessionStatus,
  useTrainingSession,
} from './useTrainingSession';

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
 * c3 (2); l2 has c4 (1); l3 has c6 (1), an empty c7 and c8 (1); l4 has no
 * Chapters. Annotating a Question updates the data the Annotated read models
 * derive from.
 */
function createBackend(annotated: string[] = []) {
  const chapters = [
    chapter('c1', 'l1', 0),
    chapter('c2', 'l1', 1),
    chapter('c3', 'l1', 2),
    chapter('c4', 'l2', 0),
    chapter('c6', 'l3', 0),
    chapter('c7', 'l3', 1),
    chapter('c8', 'l3', 2),
  ];
  const questions = [
    question('q1a', 'c1', 0),
    question('q1b', 'c1', 1),
    question('q2a', 'c2', 0),
    question('q3a', 'c3', 0),
    question('q3b', 'c3', 1),
    question('q4a', 'c4', 0),
    question('q6a', 'c6', 0),
    question('q8a', 'c8', 0),
  ].map((q) => ({ ...q, isAnnotated: annotated.includes(q.id) }));

  const chaptersOf = (lectureId: string) =>
    chapters.filter((c) => c.lectureId === lectureId);
  const questionsOf = (chapterId: string) =>
    questions.filter((q) => q.chapterId === chapterId);

  const handlers = {
    chapters: {
      getChapters: vi.fn(
        ({
          lectureId,
        }: {
          lectureId: string;
        }): Chapter[] | Promise<Chapter[]> => chaptersOf(lectureId),
      ),
    },
    questions: {
      getQuestions: vi.fn(
        ({
          chapterId,
        }: {
          chapterId: string;
        }): Question[] | Promise<Question[]> => questionsOf(chapterId),
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
  return { ...handlers, questionsOf };
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

  // Every rendered status, so a single-frame flash is visible to a test.
  const statuses: TrainingSessionStatus[] = [];
  const rendered = renderHook(
    () => {
      const params = useParams();
      const session = useTrainingSession({
        lectureId: params.id!,
        mode,
        chapterId: params.chapterId,
        questionId: params.questionId,
      });
      statuses.push(session.status);
      const location = useLocation();
      return {
        session,
        path: location.pathname,
        search: location.search,
        navigate: useNavigate(),
      };
    },
    { wrapper },
  );
  return { ...rendered, backend, queryClient, statuses };
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

    it('shuffles the Chapters by the seed in randomized mode', async () => {
      const { result } = renderSession('/train-random/l1?seed=7', {
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

  describe('shuffle seed', () => {
    const randomized = { mode: 'randomized' } as const;

    it('keeps the order and progress across remounts for the same seed', async () => {
      // A reload is a fresh mount with a fresh cache on the same URL.
      for (let mount = 0; mount < 2; mount++) {
        const { result, unmount } = renderSession(
          '/train-random/l1/c1/q1b?seed=42',
          randomized,
        );
        await waitForQuestion(result, 'q1b');
        expect(chapterIds(result)).toEqual(['c3', 'c1', 'c2']);
        // c3's two Questions, then the second of c1.
        await waitFor(() =>
          expect(result.current.session.progress.position).toBe(4),
        );
        unmount();
      }
    });

    it('orders differently for another seed', async () => {
      const { result } = renderSession('/train-random/l1?seed=42', randomized);
      await waitFor(() =>
        expect(chapterIds(result)).toEqual(['c3', 'c1', 'c2']),
      );

      act(() => result.current.navigate('/train-random/l1?seed=7'));

      await waitFor(() =>
        expect(chapterIds(result)).toEqual(['c2', 'c3', 'c1']),
      );
    });

    it('keeps the order on Back and Forward', async () => {
      const { result } = renderSession('/train-random/l1?seed=42', randomized);
      await waitForQuestion(result, 'q3a');
      act(() => result.current.session.next());
      await waitForQuestion(result, 'q3b');
      act(() => result.current.session.next());
      await waitForQuestion(result, 'q1a');

      act(() => result.current.navigate(-1));
      await waitForQuestion(result, 'q3b');
      expect(result.current.search).toBe('?seed=42');
      expect(chapterIds(result)).toEqual(['c3', 'c1', 'c2']);

      act(() => result.current.navigate(1));
      await waitForQuestion(result, 'q1a');
      expect(chapterIds(result)).toEqual(['c3', 'c1', 'c2']);
    });

    it.each(['', '?seed=abc', '?seed=01', '?seed=4294967296'])(
      'replaces a missing or invalid seed %j with a fresh one in place',
      async (search) => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const { result } = renderSession(
          `/train-random/l1/c2${search}`,
          randomized,
        );

        await waitFor(() =>
          expect(result.current.search).toBe('?seed=2147483648'),
        );
        expect(result.current.path).toBe('/train-random/l1/c2');
        await waitForQuestion(result, 'q2a');
        // Replaced, not pushed: this is still the first history entry.
        expect(result.current.session.canGoBack).toBe(false);
      },
    );

    it.each(['0', '4294967295'])(
      'accepts the boundary seed %s',
      async (seed) => {
        const { result } = renderSession(
          `/train-random/l1?seed=${seed}`,
          randomized,
        );

        await waitFor(() =>
          expect(result.current.session.status).toBe('ready'),
        );
        expect(result.current.search).toBe(`?seed=${seed}`);
      },
    );

    it('keeps the seed while resolving the last Question of a previous Chapter', async () => {
      const { result } = renderSession(
        '/train-random/l1/c1/q1a?seed=42',
        randomized,
      );
      await waitForQuestion(result, 'q1a');

      act(() => result.current.session.previous());

      await waitFor(() =>
        expect(result.current.path).toBe('/train-random/l1/c3/q3b'),
      );
      expect(result.current.search).toBe('?seed=42');
    });

    it('keeps the seed when going to the canonical URL', async () => {
      const { result } = renderSession(
        '/train-random/l1/c1/gone?seed=42',
        randomized,
      );
      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );

      act(() => result.current.session.goToCanonical());

      expect(result.current.path).toBe('/train-random/l1/c1');
      expect(result.current.search).toBe('?seed=42');
    });

    it('ignores the seed in regular mode', async () => {
      const { result } = renderSession('/train/l1?seed=42');
      await waitForQuestion(result, 'q1a');
      expect(chapterIds(result)).toEqual(['c1', 'c2', 'c3']);

      act(() => result.current.session.next());

      expect(result.current.path).toBe('/train/l1/c1/q1b');
      expect(result.current.search).toBe('');
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

    it('stays under the randomized route and keeps its seed', async () => {
      const { result } = renderSession('/train-random/l1?seed=7', {
        mode: 'randomized',
      });
      await waitForQuestion(result, 'q2a');

      act(() => result.current.session.next());

      expect(result.current.path).toBe('/train-random/l1/c3');
      expect(result.current.search).toBe('?seed=7');
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

  describe('status', () => {
    it('is loading, not empty, while a Chapter loads', async () => {
      const questions = deferred<Question[]>();
      const backend = createBackend();
      backend.questions.getQuestions.mockReturnValue(questions.promise);
      const { result, statuses } = renderSession('/train/l1', { backend });

      await waitFor(() =>
        expect(result.current.session.chapters).toHaveLength(3),
      );
      expect(result.current.session.status).toBe('loading');

      questions.resolve(backend.questionsOf('c1'));
      await waitFor(() => expect(result.current.session.status).toBe('ready'));
      expect(new Set(statuses)).toEqual(new Set(['loading', 'ready']));
    });

    it('is empty for a Chapter without Questions', async () => {
      const { result } = renderSession('/train/l3/c7');

      await waitFor(() => expect(result.current.session.status).toBe('empty'));
      expect(result.current.session.chapter?.id).toBe('c7');
      expect(result.current.session.question).toBeUndefined();
    });

    it('is empty for a Lecture without Chapters', async () => {
      const { result } = renderSession('/train/l4');

      await waitFor(() => expect(result.current.session.status).toBe('empty'));
      expect(result.current.session.chapters).toEqual([]);
    });

    it('steps over an empty Chapter in both directions', async () => {
      const { result } = renderSession('/train/l3/c7');
      await waitFor(() => expect(result.current.session.status).toBe('empty'));

      act(() => result.current.session.next());
      expect(result.current.path).toBe('/train/l3/c8');

      act(() => result.current.navigate('/train/l3/c7'));
      await waitFor(() => expect(result.current.session.status).toBe('empty'));
      act(() => result.current.session.previous());
      await waitFor(() => expect(result.current.path).toBe('/train/l3/c6/q6a'));
    });

    it('reports a failed Chapter list as error and retries', async () => {
      const backend = createBackend();
      backend.chapters.getChapters.mockImplementationOnce(() => {
        throw new Error('offline');
      });
      const { result } = renderSession('/train/l1/c1/q1b', { backend });

      await waitFor(() => expect(result.current.session.status).toBe('error'));

      act(() => result.current.session.retry());

      await waitForQuestion(result, 'q1b');
      expect(result.current.session.status).toBe('ready');
      expect(result.current.path).toBe('/train/l1/c1/q1b');
    });

    it('reports failed Questions as error and retries', async () => {
      const backend = createBackend();
      backend.questions.getQuestions.mockImplementationOnce(() => {
        throw new Error('offline');
      });
      const { result } = renderSession('/train/l1/c2/q2a', { backend });

      await waitFor(() => expect(result.current.session.status).toBe('error'));

      act(() => result.current.session.retry());

      await waitForQuestion(result, 'q2a');
      expect(result.current.session.status).toBe('ready');
    });
  });

  describe('moving back onto the last Question (__last__)', () => {
    /** Holds c2's Questions until the test releases them. */
    function holdChapterTwo() {
      const backend = createBackend();
      const c2 = deferred<Question[]>();
      backend.questions.getQuestions.mockImplementation(({ chapterId }) =>
        chapterId === 'c2' ? c2.promise : backend.questionsOf(chapterId),
      );
      return { backend, c2 };
    }

    it('stays loading while the Chapter loads, then replaces the URL', async () => {
      const { backend, c2 } = holdChapterTwo();
      const { result, statuses } = renderSession('/train/l1/c3/q3a', {
        backend,
      });
      await waitForQuestion(result, 'q3a');

      act(() => result.current.session.previous());

      expect(result.current.path).toBe('/train/l1/c2/__last__');
      await waitFor(() =>
        expect(result.current.session.status).toBe('loading'),
      );
      expect(result.current.session.chapter?.id).toBe('c2');

      c2.resolve(backend.questionsOf('c2'));

      await waitFor(() => expect(result.current.path).toBe('/train/l1/c2/q2a'));
      expect(result.current.session.status).toBe('ready');
      // The placeholder is never mistaken for an unknown Question.
      expect(statuses).not.toContain('not-found');
    });

    it('ignores further next/previous presses while it resolves', async () => {
      const { backend, c2 } = holdChapterTwo();
      const { result } = renderSession('/train/l1/c3/q3a', { backend });
      await waitForQuestion(result, 'q3a');

      act(() => result.current.session.previous());
      act(() => result.current.session.previous());
      act(() => result.current.session.next());

      expect(result.current.path).toBe('/train/l1/c2/__last__');
      expect(result.current.session.isFirst).toBe(true);
      expect(result.current.session.isLast).toBe(true);

      c2.resolve(backend.questionsOf('c2'));
      await waitFor(() => expect(result.current.path).toBe('/train/l1/c2/q2a'));

      // One history entry was added, so Back returns to the start.
      act(() => result.current.navigate(-1));
      await waitFor(() => expect(result.current.path).toBe('/train/l1/c3/q3a'));
    });

    it('lands on the Chapter-only URL when that Chapter is empty', async () => {
      const { result } = renderSession('/train/l3/c8/q8a');
      await waitForQuestion(result, 'q8a');

      act(() => result.current.session.previous());

      await waitFor(() => expect(result.current.path).toBe('/train/l3/c7'));
      expect(result.current.session.status).toBe('empty');
    });

    it('keeps the URL on failure and resolves after a retry', async () => {
      const backend = createBackend();
      backend.questions.getQuestions.mockImplementation(({ chapterId }) => {
        if (chapterId === 'c2') throw new Error('offline');
        return backend.questionsOf(chapterId);
      });
      const { result } = renderSession('/train/l1/c3/q3a', { backend });
      await waitForQuestion(result, 'q3a');

      act(() => result.current.session.previous());

      await waitFor(() => expect(result.current.session.status).toBe('error'));
      expect(result.current.path).toBe('/train/l1/c2/__last__');

      backend.questions.getQuestions.mockImplementation(({ chapterId }) =>
        backend.questionsOf(chapterId),
      );
      act(() => result.current.session.retry());

      await waitFor(() => expect(result.current.path).toBe('/train/l1/c2/q2a'));
      expect(result.current.session.status).toBe('ready');
    });

    it('never redirects once the learner has moved on', async () => {
      const { backend, c2 } = holdChapterTwo();
      const { result } = renderSession('/train/l1/c3/q3a', { backend });
      await waitForQuestion(result, 'q3a');

      act(() => result.current.session.previous());
      await waitFor(() =>
        expect(result.current.session.status).toBe('loading'),
      );

      // Sidebar selection still works while it resolves.
      act(() =>
        result.current.session.selectChapter(
          result.current.session.chapters[0],
        ),
      );
      await waitForQuestion(result, 'q1a');

      c2.resolve(backend.questionsOf('c2'));
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

      expect(result.current.path).toBe('/train/l1/c1');
      expect(result.current.session.question?.id).toBe('q1a');
    });

    it('resolves again when Back returns to an unresolved entry', async () => {
      const { backend, c2 } = holdChapterTwo();
      const { result } = renderSession('/train/l1/c3/q3a', { backend });
      await waitForQuestion(result, 'q3a');

      act(() => result.current.session.previous());
      act(() =>
        result.current.session.selectChapter(
          result.current.session.chapters[0],
        ),
      );
      await waitForQuestion(result, 'q1a');
      c2.resolve(backend.questionsOf('c2'));

      act(() => result.current.navigate(-1));

      await waitFor(() => expect(result.current.path).toBe('/train/l1/c2/q2a'));

      // Forward still reaches the Chapter the learner had moved to.
      act(() => result.current.navigate(1));
      await waitFor(() => expect(result.current.path).toBe('/train/l1/c1'));
    });

    it('resolves an old __last__ URL opened directly', async () => {
      const { result, statuses } = renderSession('/train/l1/c3/__last__');

      await waitFor(() => expect(result.current.path).toBe('/train/l1/c3/q3b'));
      expect(result.current.session.status).toBe('ready');
      expect(statuses).not.toContain('not-found');
    });

    it('treats __last__ in an unknown Chapter as not found', async () => {
      const { result } = renderSession('/train/l1/nope/__last__');

      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );
      expect(result.current.session.notFound).toBe('chapter');
    });
  });

  describe('unknown ids', () => {
    it('reports an unknown Chapter and goes to the first Chapter', async () => {
      const { result } = renderSession('/train/l1/nope', {
        backend: createBackend(['q3a']),
      });

      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );
      expect(result.current.session.notFound).toBe('chapter');
      expect(result.current.session.chapterIndex).toBe(-1);
      // A first entry (new tab, pasted link) has nothing in-app to go back to.
      expect(result.current.session.canGoBack).toBe(false);

      act(() => result.current.session.goToCanonical());

      // The first Chapter in session order: Annotated c3 comes first.
      expect(result.current.path).toBe('/train/l1/c3');
      await waitForQuestion(result, 'q3a');
    });

    it('reports an unknown Question and goes to its Chapter', async () => {
      const { result } = renderSession('/train/l1/c3/stale');

      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );
      expect(result.current.session.notFound).toBe('question');
      expect(result.current.session.chapter?.id).toBe('c3');

      act(() => result.current.session.goToCanonical());

      expect(result.current.path).toBe('/train/l1/c3');
      await waitForQuestion(result, 'q3a');
    });

    it('reports an unknown Chapter in a Lecture without Chapters', async () => {
      const { result } = renderSession('/train/l4/deleted/__last__');

      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );
      expect(result.current.session.notFound).toBe('chapter');

      act(() => result.current.session.goToCanonical());

      expect(result.current.path).toBe('/train/l4');
      await waitFor(() => expect(result.current.session.status).toBe('empty'));
    });

    it('offers no Back after the first entry was replaced', async () => {
      const { result, backend, queryClient } = renderSession(
        '/train/l1/c3/__last__',
      );
      await waitFor(() => expect(result.current.path).toBe('/train/l1/c3/q3b'));

      // The Question disappears on a later refetch.
      backend.questions.getQuestions.mockImplementation(({ chapterId }) =>
        backend.questionsOf(chapterId).filter((q) => q.id !== 'q3b'),
      );
      await act(() => queryClient.invalidateQueries());

      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );
      expect(result.current.session.canGoBack).toBe(false);
    });

    it('still offers Back after an in-app entry was replaced', async () => {
      const { result } = renderSession('/train/l1/c3/q3a');
      await waitForQuestion(result, 'q3a');

      act(() => result.current.session.previous());

      await waitFor(() => expect(result.current.path).toBe('/train/l1/c2/q2a'));
      expect(result.current.session.canGoBack).toBe(true);
    });

    it('reports an unknown Question in an empty Chapter', async () => {
      const { result } = renderSession('/train/l3/c7/stale');

      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );
      expect(result.current.session.notFound).toBe('question');
    });

    it('offers Back after an in-app navigation', async () => {
      const { result } = renderSession('/train/l1/c1/q1a');
      await waitForQuestion(result, 'q1a');

      act(() => result.current.navigate('/train/l1/c1/stale'));

      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );
      expect(result.current.session.canGoBack).toBe(true);

      act(() => result.current.session.goBack());

      await waitFor(() => expect(result.current.path).toBe('/train/l1/c1/q1a'));
      expect(result.current.session.status).toBe('ready');
    });

    it('keeps the sidebar usable', async () => {
      const { result } = renderSession('/train/l1/nope');
      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );

      act(() =>
        result.current.session.selectChapter(
          result.current.session.chapters[1],
        ),
      );

      expect(result.current.path).toBe('/train/l1/c2');
      await waitForQuestion(result, 'q2a');
    });

    it('ignores next and previous', async () => {
      const { result } = renderSession('/train/l1/c1/stale');
      await waitFor(() =>
        expect(result.current.session.status).toBe('not-found'),
      );

      act(() => result.current.session.next());
      act(() => result.current.session.previous());

      expect(result.current.path).toBe('/train/l1/c1/stale');
    });
  });
});
