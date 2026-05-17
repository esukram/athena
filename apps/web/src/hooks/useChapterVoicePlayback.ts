import { useEffect, useRef, useState } from 'react';

import type { Question, SpeechFormat } from '@athena/api';

import { audioUrlFromBase64 } from '../utils/audioFromBase64';
import { markdownToSsml } from '../utils/markdownToSsml';
import { trpc } from '../utils/trpc';

/**
 * Hands-free auto-play of a chapter's question/answer cards.
 *
 * For each question the runner speaks the question, pauses briefly, speaks the
 * answer (Markdown converted to SSML), pauses a little longer, then advances.
 * Playback stays within a single chapter — it stops at the last question and
 * the user advances chapters manually.
 *
 * The runner is an `async` loop guarded by an epoch ref: bumping the epoch
 * abandons any in-flight iteration, which makes aborting on pause-stop,
 * chapter change or unmount trivial.
 */

export type VoicePlaybackStatus =
  | 'idle'
  | 'loading'
  | 'speaking-question'
  | 'pausing-short'
  | 'speaking-answer'
  | 'pausing-long'
  | 'finished';

export type VoicePlaybackPart = 'question' | 'answer';

const SHORT_PAUSE_MS = 700;
const LONG_PAUSE_MS = 1500;

interface UseChapterVoicePlaybackArgs {
  questions: Question[];
  language: 'de' | 'en';
  enabled: boolean;
  chapterId: string | undefined;
}

export interface UseChapterVoicePlaybackResult {
  status: VoicePlaybackStatus;
  isActive: boolean;
  isPaused: boolean;
  currentQuestionIndex: number | null;
  currentPart: VoicePlaybackPart | null;
  toggle: () => void;
}

interface PendingWait {
  resolve: () => void;
  remaining: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export function useChapterVoicePlayback({
  questions,
  language,
  enabled,
  chapterId,
}: UseChapterVoicePlaybackArgs): UseChapterVoicePlaybackResult {
  const [status, setStatus] = useState<VoicePlaybackStatus>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<
    number | null
  >(null);
  const [currentPart, setCurrentPart] = useState<VoicePlaybackPart | null>(
    null,
  );

  const synthesize = trpc.speech.synthesize.useMutation();

  // Refs keep the runner reading fresh values without re-creating itself.
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const languageRef = useRef(language);
  languageRef.current = language;
  const statusRef = useRef(status);
  statusRef.current = status;

  const epochRef = useRef(0);
  const pausedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioResolveRef = useRef<(() => void) | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const waitRef = useRef<PendingWait | null>(null);
  const resumeWaitersRef = useRef<Array<() => void>>([]);

  const releaseAudio = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    audioRef.current = null;
    audioResolveRef.current = null;
  };

  // Bumps the epoch and tears down any active audio/timer/gates.
  const abort = () => {
    epochRef.current += 1;
    if (audioRef.current) audioRef.current.pause();
    if (waitRef.current?.timer) clearTimeout(waitRef.current.timer);
    const pendingWaitResolve = waitRef.current?.resolve;
    const pendingAudioResolve = audioResolveRef.current;
    const pendingGates = resumeWaitersRef.current;
    waitRef.current = null;
    resumeWaitersRef.current = [];
    releaseAudio();
    pausedRef.current = false;
    setIsPaused(false);
    setStatus('idle');
    setCurrentQuestionIndex(null);
    setCurrentPart(null);
    // Unblock anything the runner is awaiting so its loop can exit.
    pendingWaitResolve?.();
    pendingAudioResolve?.();
    pendingGates.forEach((r) => r());
  };

  // Resolves once playback is not paused (immediately if already running).
  const awaitResume = (): Promise<void> => {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      resumeWaitersRef.current.push(resolve);
    });
  };

  // A pausable, cancelable delay.
  const wait = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      const pending: PendingWait = {
        resolve,
        remaining: ms,
        startedAt: Date.now(),
        timer: null,
      };
      waitRef.current = pending;
      if (!pausedRef.current) {
        pending.timer = setTimeout(() => {
          waitRef.current = null;
          resolve();
        }, pending.remaining);
      }
    });

  // Synthesizes `text` and plays it, resolving when playback ends.
  const speak = async (
    text: string,
    format: SpeechFormat,
    speakingStatus: VoicePlaybackStatus,
  ): Promise<void> => {
    const startEpoch = epochRef.current;
    const result = await synthesize.mutateAsync({
      text,
      language: languageRef.current,
      format,
    });
    if (startEpoch !== epochRef.current) return;

    return new Promise<void>((resolve) => {
      const url = audioUrlFromBase64(result.audioData);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audioResolveRef.current = resolve;

      const finish = () => {
        releaseAudio();
        resolve();
      };
      audio.onended = finish;
      audio.onerror = finish;

      setStatus(speakingStatus);
      if (!pausedRef.current) {
        audio.play().catch(finish);
      }
    });
  };

  const run = async (startEpoch: number): Promise<void> => {
    const aborted = () => startEpoch !== epochRef.current;
    try {
      const items = questionsRef.current;
      for (let i = 0; i < items.length; i++) {
        if (aborted()) return;
        const question = items[i];

        setCurrentQuestionIndex(i);
        setCurrentPart('question');
        setStatus('loading');
        await awaitResume();
        if (aborted()) return;
        await speak(question.question, 'text', 'speaking-question');
        if (aborted()) return;

        setStatus('pausing-short');
        await awaitResume();
        if (aborted()) return;
        await wait(SHORT_PAUSE_MS);
        if (aborted()) return;

        setCurrentPart('answer');
        const ssml = markdownToSsml(question.answer ?? '');
        if (ssml) {
          setStatus('loading');
          await awaitResume();
          if (aborted()) return;
          await speak(ssml, 'ssml', 'speaking-answer');
          if (aborted()) return;
        }

        if (i < items.length - 1) {
          setStatus('pausing-long');
          await awaitResume();
          if (aborted()) return;
          await wait(LONG_PAUSE_MS);
          if (aborted()) return;
        }
      }
      if (aborted()) return;
      setStatus('finished');
      setCurrentQuestionIndex(null);
      setCurrentPart(null);
    } catch {
      if (!aborted()) {
        epochRef.current += 1;
        releaseAudio();
        setStatus('idle');
        setCurrentQuestionIndex(null);
        setCurrentPart(null);
      }
    }
  };

  const toggle = (): void => {
    if (!enabled) return;
    const current = statusRef.current;

    if (current === 'idle' || current === 'finished') {
      if (questionsRef.current.length === 0) return;
      pausedRef.current = false;
      setIsPaused(false);
      const startEpoch = ++epochRef.current;
      void run(startEpoch);
      return;
    }

    if (pausedRef.current) {
      // Resume.
      pausedRef.current = false;
      setIsPaused(false);
      const pendingWait = waitRef.current;
      if (pendingWait && !pendingWait.timer) {
        pendingWait.startedAt = Date.now();
        pendingWait.timer = setTimeout(() => {
          waitRef.current = null;
          pendingWait.resolve();
        }, pendingWait.remaining);
      }
      audioRef.current?.play().catch(() => {});
      const gates = resumeWaitersRef.current;
      resumeWaitersRef.current = [];
      gates.forEach((r) => r());
    } else {
      // Pause.
      pausedRef.current = true;
      setIsPaused(true);
      const pendingWait = waitRef.current;
      if (pendingWait?.timer) {
        clearTimeout(pendingWait.timer);
        pendingWait.remaining -= Date.now() - pendingWait.startedAt;
        pendingWait.timer = null;
      }
      audioRef.current?.pause();
    }
  };

  // Abort on chapter change and on unmount (single effect covers both).
  useEffect(() => {
    return () => abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  const isActive = status !== 'idle' && status !== 'finished';

  return {
    status,
    isActive,
    isPaused,
    currentQuestionIndex,
    currentPart,
    toggle,
  };
}
