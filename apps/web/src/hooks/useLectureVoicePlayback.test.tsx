import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';

import type { Chapter, Question } from '@athena/api';

import { createTrpcTestWrapper, deferred } from '../test/trpcTestLink';
import { useLectureVoicePlayback } from './useLectureVoicePlayback';

/** Every clip plays for this long, then ends on its own. */
const CLIP_MS = 100;

class FakeAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  play = vi.fn(() => {
    this.timer = setTimeout(() => this.onended?.(), CLIP_MS);
    return Promise.resolve();
  });
  pause = vi.fn(() => clearTimeout(this.timer));
}

const chapter = (id: string, order: number): Chapter => ({
  id,
  lectureId: 'l1',
  association: '',
  order,
});

const question = (chapterId: string): Question => ({
  id: `q-${chapterId}`,
  chapterId,
  question: `Question ${chapterId}`,
  answer: `Answer ${chapterId}`,
  order: 0,
  isAnnotated: false,
});

/** Lecture l1: c1, c2 and c4 hold one Question each; c3 is empty. */
const chapters = [
  chapter('c1', 0),
  chapter('c2', 1),
  chapter('c3', 2),
  chapter('c4', 3),
];
const questionsOf = (chapterId: string) =>
  chapterId === 'c3' ? [] : [question(chapterId)];

type Synthesis = { audioData: string; duration: number };

function createBackend() {
  return {
    questions: {
      getQuestions: vi.fn(
        ({
          chapterId,
        }: {
          chapterId: string;
        }): Question[] | Promise<Question[]> => questionsOf(chapterId),
      ),
    },
    speech: {
      isConfigured: () => true,
      synthesize: vi.fn<
        (input: { text: string }) => Synthesis | Promise<Synthesis>
      >(() => ({ audioData: 'AAAA', duration: CLIP_MS })),
    },
  };
}

function renderPlayback(url: string, backend = createBackend()) {
  const { Wrapper } = createTrpcTestWrapper(backend);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Wrapper>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/learn/:id/:chapterId?" element={children} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  );
  const rendered = renderHook(
    () => {
      const params = useParams();
      return {
        playback: useLectureVoicePlayback({
          lectureId: params.id!,
          chapters,
          chapterId: params.chapterId,
          language: 'en',
        }),
        path: useLocation().pathname,
        navigate: useNavigate(),
      };
    },
    { wrapper },
  );
  return { ...rendered, backend };
}

/**
 * Advances fake time in small steps, each in its own `act`, so effects and
 * query results settle between steps the way they would in a browser.
 */
const advance = async (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 50) {
    await act(() => vi.advanceTimersByTimeAsync(50));
  }
};

/** Chapters whose Question was sent to synthesis, in order of first use. */
const synthesizedChapters = (backend: ReturnType<typeof createBackend>) =>
  [
    ...new Set(
      backend.speech.synthesize.mock.calls.map(
        ([{ text }]) => /Question (c\d)/.exec(text)?.[1],
      ),
    ),
  ].filter(Boolean);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('Audio', FakeAudio);
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useLectureVoicePlayback', () => {
  it('resolves a missing or unknown Chapter id to the first Chapter', async () => {
    const { result } = renderPlayback('/learn/l1/nope');
    await advance(50);

    expect(result.current.playback.chapterIndex).toBe(0);
    expect(result.current.playback.chapter?.id).toBe('c1');
    expect(result.current.playback.questions).toEqual([question('c1')]);
  });

  it('continues into the next Chapter once a Chapter finishes', async () => {
    const { result, backend } = renderPlayback('/learn/l1/c1');
    await advance(50);

    act(() => result.current.playback.toggle());
    await advance(1000);

    expect(result.current.path).toBe('/learn/l1/c2');
    expect(result.current.playback.isActive).toBe(true);
    expect(synthesizedChapters(backend)).toEqual(['c1', 'c2']);
  });

  it('plays every Chapter in turn, skipping none (regression a51e178)', async () => {
    const { result, backend } = renderPlayback('/learn/l1/c1');
    await advance(50);

    act(() => result.current.playback.toggle());
    await advance(5000);

    // c3 is empty, so it is passed over; every Chapter with content plays.
    expect(synthesizedChapters(backend)).toEqual(['c1', 'c2', 'c4']);
    expect(result.current.path).toBe('/learn/l1/c4');
    expect(result.current.playback.status).toBe('finished');
  });

  it('skips an empty Chapter and plays the next one', async () => {
    const { result, backend } = renderPlayback('/learn/l1/c2');
    await advance(50);

    act(() => result.current.playback.toggle());
    await advance(1500);

    expect(backend.questions.getQuestions).toHaveBeenCalledWith({
      chapterId: 'c3',
    });
    expect(result.current.path).toBe('/learn/l1/c4');
    expect(synthesizedChapters(backend)).toEqual(['c2', 'c4']);
  });

  it('stops after the last Chapter', async () => {
    const { result } = renderPlayback('/learn/l1/c4');
    await advance(50);

    act(() => result.current.playback.toggle());
    await advance(2000);

    expect(result.current.path).toBe('/learn/l1/c4');
    expect(result.current.playback.status).toBe('finished');
  });

  it('stays on the Chapter when auto-advance is off, and turning it on later does not jump (regression 95251e4)', async () => {
    const { result } = renderPlayback('/learn/l1/c1');
    await advance(50);

    act(() => result.current.playback.setAutoAdvance(false));
    act(() => result.current.playback.toggle());
    await advance(1000);
    expect(result.current.playback.status).toBe('finished');
    expect(result.current.path).toBe('/learn/l1/c1');

    act(() => result.current.playback.setAutoAdvance(true));
    await advance(1000);
    expect(result.current.path).toBe('/learn/l1/c1');
    expect(result.current.playback.status).toBe('finished');
  });

  it('does not resume playback after a manual Chapter change mid-playback', async () => {
    const backend = createBackend();
    const synthesis = deferred<Synthesis>();
    backend.speech.synthesize.mockImplementationOnce(() => synthesis.promise);
    const { result } = renderPlayback('/learn/l1/c1', backend);
    await advance(50);

    act(() => result.current.playback.toggle());
    await advance(50);
    expect(result.current.playback.isActive).toBe(true);

    act(() => result.current.playback.selectChapter(1));
    synthesis.resolve({ audioData: 'AAAA', duration: CLIP_MS });
    await advance(2000);

    expect(result.current.path).toBe('/learn/l1/c2');
    expect(result.current.playback.status).toBe('idle');
    expect(synthesizedChapters(backend)).toEqual(['c1']);
  });

  it('cancels a pending auto-start when auto-advance is turned off mid-flight', async () => {
    const backend = createBackend();
    const c2Questions = deferred<Question[]>();
    backend.questions.getQuestions.mockImplementation(({ chapterId }) =>
      chapterId === 'c2' ? c2Questions.promise : questionsOf(chapterId),
    );
    const { result } = renderPlayback('/learn/l1/c1', backend);
    await advance(50);

    act(() => result.current.playback.toggle());
    await advance(1000);
    expect(result.current.path).toBe('/learn/l1/c2');

    act(() => result.current.playback.setAutoAdvance(false));
    c2Questions.resolve(questionsOf('c2'));
    await advance(1000);

    expect(result.current.playback.questions).toEqual([question('c2')]);
    expect(result.current.playback.status).toBe('idle');
    expect(synthesizedChapters(backend)).toEqual(['c1']);
  });

  it('keeps auto-advancing after leaving a Chapter that was about to start (regression 95251e4)', async () => {
    const backend = createBackend();
    const c2Questions = deferred<Question[]>();
    backend.questions.getQuestions.mockImplementation(({ chapterId }) =>
      chapterId === 'c2' ? c2Questions.promise : questionsOf(chapterId),
    );
    const { result } = renderPlayback('/learn/l1/c1', backend);
    await advance(50);

    act(() => result.current.playback.toggle());
    await advance(1000);
    expect(result.current.path).toBe('/learn/l1/c2');

    // Away and back by hand before c2 is ready: a manual pick never starts
    // playback, even of the Chapter that was about to start.
    act(() => result.current.playback.selectChapter(0));
    act(() => result.current.playback.selectChapter(1));
    c2Questions.resolve(questionsOf('c2'));
    await advance(500);
    expect(result.current.path).toBe('/learn/l1/c2');
    expect(result.current.playback.status).toBe('idle');
    act(() => result.current.playback.selectChapter(0));
    await advance(50);

    // A fresh run on c1 still continues into c2.
    act(() => result.current.playback.toggle());
    await advance(1000);
    expect(result.current.path).toBe('/learn/l1/c2');
    expect(result.current.playback.isActive).toBe(true);
    expect(synthesizedChapters(backend)).toEqual(['c1', 'c2']);
  });

  it('does not restart the previous Chapter on browser Back while the next one loads', async () => {
    const backend = createBackend();
    const c2Questions = deferred<Question[]>();
    backend.questions.getQuestions.mockImplementation(({ chapterId }) =>
      chapterId === 'c2' ? c2Questions.promise : questionsOf(chapterId),
    );
    const { result } = renderPlayback('/learn/l1/c1', backend);
    await advance(50);

    act(() => result.current.playback.toggle());
    await advance(1000);
    expect(result.current.path).toBe('/learn/l1/c2');

    // c1's Questions are cached, so they are ready the moment Back lands.
    act(() => {
      void result.current.navigate(-1);
    });
    await advance(500);

    expect(result.current.path).toBe('/learn/l1/c1');
    expect(result.current.playback.status).toBe('idle');
    expect(backend.speech.synthesize).toHaveBeenCalledTimes(2);

    // Forward is also a manual navigation; returning to the former target
    // must not revive the auto-start that Back interrupted.
    c2Questions.resolve(questionsOf('c2'));
    await advance(50);
    act(() => {
      void result.current.navigate(1);
    });
    await advance(500);

    expect(result.current.path).toBe('/learn/l1/c2');
    expect(result.current.playback.status).toBe('idle');
    expect(backend.speech.synthesize).toHaveBeenCalledTimes(2);
  });

  it('settles on error and does not advance when synthesis fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const backend = createBackend();
    backend.speech.synthesize.mockImplementationOnce(() => {
      throw new Error('synthesis down');
    });
    const { result } = renderPlayback('/learn/l1/c1', backend);
    await advance(50);

    act(() => result.current.playback.toggle());
    await advance(1000);

    expect(result.current.playback.status).toBe('error');
    expect(result.current.path).toBe('/learn/l1/c1');
  });

  it('defaults auto-advance on, honours a stored preference and persists changes', async () => {
    expect(
      renderPlayback('/learn/l1').result.current.playback.autoAdvance,
    ).toBe(true);

    localStorage.setItem('learnAutoAdvance', 'false');
    const { result } = renderPlayback('/learn/l1');
    expect(result.current.playback.autoAdvance).toBe(false);

    act(() => result.current.playback.setAutoAdvance(true));
    expect(result.current.playback.autoAdvance).toBe(true);
    expect(localStorage.getItem('learnAutoAdvance')).toBe('true');
  });
});
