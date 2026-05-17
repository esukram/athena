import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@testing-library/react';

import type { Question } from '@athena/api';

import { useChapterVoicePlayback } from './useChapterVoicePlayback';

// --- trpc mock -------------------------------------------------------------
const mutateAsync = vi.fn(async () => ({ audioData: 'AAAA', duration: 100 }));
vi.mock('../utils/trpc', () => ({
  trpc: {
    speech: {
      synthesize: {
        useMutation: () => ({ mutateAsync }),
      },
    },
  },
}));

// Avoid touching the real markdown parser; answers are speakable as-is here.
vi.mock('../utils/markdownToSsml', () => ({
  markdownToSsml: (md: string) => md.trim(),
}));

vi.mock('../utils/audioFromBase64', () => ({
  audioUrlFromBase64: () => 'blob:mock',
}));

// --- Audio mock ------------------------------------------------------------
class MockAudio {
  static instances: MockAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => {});
  pause = vi.fn(() => {});
  constructor() {
    MockAudio.instances.push(this);
  }
  end() {
    this.onended?.();
  }
}

const lastAudio = () => MockAudio.instances[MockAudio.instances.length - 1];

const makeQuestions = (n: number): Question[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    chapterId: 'c1',
    question: `Question ${i}`,
    answer: `Answer ${i}`,
    order: i,
    isAnnotated: false,
  }));

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  MockAudio.instances = [];
  mutateAsync.mockClear();
  vi.stubGlobal('Audio', MockAudio);
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {},
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useChapterVoicePlayback', () => {
  it('walks question -> short pause -> answer -> long pause -> next question', async () => {
    const { result } = renderHook(() =>
      useChapterVoicePlayback({
        questions: makeQuestions(2),
        language: 'en',
        enabled: true,
        chapterId: 'c1',
      }),
    );

    act(() => result.current.toggle());
    await flush();

    // Question 0 is being synthesized then spoken.
    expect(result.current.currentQuestionIndex).toBe(0);
    expect(result.current.currentPart).toBe('question');
    expect(result.current.status).toBe('speaking-question');

    await act(async () => lastAudio().end());
    expect(result.current.status).toBe('pausing-short');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(result.current.currentPart).toBe('answer');
    expect(result.current.status).toBe('speaking-answer');

    await act(async () => lastAudio().end());
    expect(result.current.status).toBe('pausing-long');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(result.current.currentQuestionIndex).toBe(1);
    expect(result.current.currentPart).toBe('question');
  });

  it('finishes after the last question without a trailing long pause', async () => {
    const { result } = renderHook(() =>
      useChapterVoicePlayback({
        questions: makeQuestions(1),
        language: 'en',
        enabled: true,
        chapterId: 'c1',
      }),
    );

    act(() => result.current.toggle());
    await flush();
    await act(async () => lastAudio().end()); // question
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    await act(async () => lastAudio().end()); // answer

    expect(result.current.status).toBe('finished');
    expect(result.current.isActive).toBe(false);
  });

  it('pauses and resumes playback', async () => {
    const { result } = renderHook(() =>
      useChapterVoicePlayback({
        questions: makeQuestions(2),
        language: 'en',
        enabled: true,
        chapterId: 'c1',
      }),
    );

    act(() => result.current.toggle());
    await flush();
    const audio = lastAudio();

    act(() => result.current.toggle()); // pause
    expect(result.current.isPaused).toBe(true);
    expect(audio.pause).toHaveBeenCalled();

    act(() => result.current.toggle()); // resume
    expect(result.current.isPaused).toBe(false);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it('aborts to idle when the chapter changes', async () => {
    const { result, rerender } = renderHook(
      (props: { chapterId: string }) =>
        useChapterVoicePlayback({
          questions: makeQuestions(2),
          language: 'en',
          enabled: true,
          chapterId: props.chapterId,
        }),
      { initialProps: { chapterId: 'c1' } },
    );

    act(() => result.current.toggle());
    await flush();
    expect(result.current.isActive).toBe(true);

    act(() => rerender({ chapterId: 'c2' }));
    expect(result.current.status).toBe('idle');
    expect(result.current.currentQuestionIndex).toBe(null);
  });

  it('aborts cleanly on unmount without leaving timers pending', async () => {
    const { result, unmount } = renderHook(() =>
      useChapterVoicePlayback({
        questions: makeQuestions(2),
        language: 'en',
        enabled: true,
        chapterId: 'c1',
      }),
    );

    act(() => result.current.toggle());
    await flush();
    await act(async () => lastAudio().end()); // into pausing-short

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing when disabled', async () => {
    const { result } = renderHook(() =>
      useChapterVoicePlayback({
        questions: makeQuestions(2),
        language: 'en',
        enabled: false,
        chapterId: 'c1',
      }),
    );

    act(() => result.current.toggle());
    await flush();
    expect(result.current.status).toBe('idle');
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
