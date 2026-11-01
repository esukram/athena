import { useNavigate } from 'react-router-dom';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

import type { Chapter, Question } from '@athena/api';

import { trpc } from '../utils/trpc';
import { useChapterVoicePlayback } from './useChapterVoicePlayback';

export interface LectureVoicePlaybackParams {
  lectureId: string;
  /** The Lecture's Chapters, in reading order. */
  chapters: Chapter[];
  /** Route param; a missing or unknown id selects the first Chapter. */
  chapterId: string | undefined;
  language: 'de' | 'en';
}

const AUTO_ADVANCE_KEY = 'learnAutoAdvance';
const EMPTY: never[] = [];

// Defaults to on; an explicit stored value overrides the default. Storage is
// guarded: private mode or disabled storage falls back to session-only.
const readAutoAdvance = (): boolean => {
  try {
    return localStorage.getItem(AUTO_ADVANCE_KEY) !== 'false';
  } catch {
    return true;
  }
};

const writeAutoAdvance = (value: boolean) => {
  try {
    localStorage.setItem(AUTO_ADVANCE_KEY, String(value));
  } catch {
    // Storage unavailable: the preference stays in memory for this session.
  }
};

/**
 * Voice playback across a Lecture in Learn mode: resolves the active Chapter
 * from the route, loads its Questions, plays them, and, with auto-advance on,
 * continues into the next Chapter, skipping empty ones. The caller renders the
 * state and sends intents: `toggle`, `selectChapter`, `setAutoAdvance`.
 */
export function useLectureVoicePlayback({
  lectureId,
  chapters,
  chapterId,
  language,
}: LectureVoicePlaybackParams) {
  const navigate = useNavigate();
  const [autoAdvance, setAutoAdvance] = useState(readAutoAdvance);

  const found = chapterId ? chapters.findIndex((c) => c.id === chapterId) : 0;
  const chapterIndex = Math.max(found, 0);
  const chapter: Chapter | undefined = chapters[chapterIndex];

  const questionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: chapter?.id ?? '' },
    { enabled: !!chapter?.id },
  );
  const questions: Question[] = questionsQuery.data ?? EMPTY;
  const available = trpc.speech.isConfigured.useQuery().data ?? false;

  // The Chapter to start playing once its Questions are ready. Keyed by id,
  // not a flag, so neither a stale `finished` nor a manual jump can start
  // the wrong Chapter.
  const autoStartRef = useRef<string | null>(null);

  const goTo = (target: Chapter) =>
    navigate(`/learn/${lectureId}/${target.id}`);

  // Continue after the Chapter at `index`; past the last one, stop.
  const continueAfter = (index: number) => {
    const next: Chapter | undefined = chapters[index + 1];
    autoStartRef.current = next?.id ?? null;
    if (next) goTo(next);
  };

  const voice = useChapterVoicePlayback({
    questions,
    language,
    enabled: available,
    chapterId: chapter?.id,
    onFinished: () => {
      if (autoAdvance) continueAfter(chapterIndex);
    },
  });

  // Runs once the active Chapter's Questions are ready: start the pending
  // auto-start, or skip past an empty Chapter.
  const autoStart = useEffectEvent(() => {
    if (!chapter || autoStartRef.current !== chapter.id) return;
    if (questions.length > 0) {
      autoStartRef.current = null;
      voice.play();
    } else {
      continueAfter(chapterIndex);
    }
  });
  const activeId = chapter?.id;
  const questionsReady = questionsQuery.isSuccess;
  useEffect(() => {
    // Browser Back/Forward can select a Chapter without selectChapter. Once
    // the route leaves an automatic target, that continuation is cancelled.
    if (autoStartRef.current !== activeId) autoStartRef.current = null;
    if (questionsReady) autoStart();
  }, [activeId, questionsReady]);

  // Manual Chapter choice: never resumes playback by itself. Stable, so the
  // caller can subscribe keyboard shortcuts to it.
  const selectChapter = useCallback(
    (index: number) => {
      const target: Chapter | undefined = chapters[index];
      if (!target) return;
      autoStartRef.current = null;
      navigate(`/learn/${lectureId}/${target.id}`);
    },
    [chapters, lectureId, navigate],
  );

  return {
    chapter,
    chapterIndex,
    questions,
    /** Speech synthesis is configured; without it there is nothing to play. */
    available,
    status: voice.status,
    isActive: voice.isActive,
    isPaused: voice.isPaused,
    currentQuestionIndex: voice.currentQuestionIndex,
    currentPart: voice.currentPart,
    autoAdvance,
    toggle: () => {
      autoStartRef.current = null;
      voice.toggle();
    },
    selectChapter,
    setAutoAdvance: (value: boolean) => {
      if (!value) autoStartRef.current = null;
      setAutoAdvance(value);
      writeAutoAdvance(value);
    },
  };
}
