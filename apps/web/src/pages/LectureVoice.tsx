import { Loader2, Mic, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { Accordion } from '../components/Accordion';
import { AppHeader } from '../components/AppHeader';
import { ChapterSidebar } from '../components/ChapterSidebar';
import { ErrorState } from '../components/ErrorState';
import { LectureNavigation } from '../components/LectureNavigation';
import { LoadingState } from '../components/LoadingState';
import { ProgressBar } from '../components/ProgressBar';
import { BackButton } from '../components/buttons/BackButton';
import { highlightText } from '../utils/highlightText';
import { trpc } from '../utils/trpc';

// Helper to convert Float32Array to 16-bit PCM
function floatTo16BitPCM(
  output: DataView,
  offset: number,
  input: Float32Array,
) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

interface LectureVoiceContentProps {
  lectureId: string;
  chapterId?: string;
  questionId?: string;
  chapters: Chapter[];
  lecture: { id: string; title: string; description: string | null };
}

const LectureVoiceContent = ({
  lectureId,
  chapterId,
  questionId,
  chapters,
  lecture,
}: LectureVoiceContentProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chapterButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [recordingError, setRecordingError] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioDataRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRecordingRef = useRef<(skipProcessing?: boolean) => void>(() => {});
  const hasSpeechStartedRef = useRef(false);

  // Silence detection constants
  const SILENCE_THRESHOLD = 0.03; // RMS threshold for detecting speech (increased to avoid noise)
  const SILENCE_TIMEOUT_MS = 5000; // 5 seconds of silence after speech
  const INITIAL_TIMEOUT_MS = 10000; // 10 seconds to start speaking
  const SPEECH_SAMPLES_REQUIRED = 5; // Require consecutive samples above threshold
  const speechSampleCountRef = useRef(0);

  // TTS playback state
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const startRecordingRef = useRef<() => void>(() => {});

  const basePath = 'voice';

  const firstQuestionsQuery =
    trpc.questions.getFirstQuestionsByLecture.useQuery(
      { lectureId },
      { enabled: !!lectureId },
    );

  const annotatedChapterIdsQuery =
    trpc.questions.getAnnotatedChapterIdsByLecture.useQuery(
      { lectureId },
      { enabled: !!lectureId },
    );

  const totalQuestionsQuery =
    trpc.questions.getQuestionCountsByLecture.useQuery(
      { lectureId },
      { enabled: !!lectureId },
    );

  const questionCountsPerChapterQuery =
    trpc.questions.getQuestionCountsPerChapter.useQuery(
      { lectureId },
      { enabled: !!lectureId },
    );

  const transcribeMutation = trpc.speech.transcribe.useMutation();
  const synthesizeMutation = trpc.speech.synthesize.useMutation();

  const annotatedChapterIds = useMemo(() => {
    return new Set(annotatedChapterIdsQuery.data || []);
  }, [annotatedChapterIdsQuery.data]);

  const firstQuestionMap = useMemo(() => {
    const map = new Map<string, Question | undefined>();
    if (firstQuestionsQuery.data) {
      for (const [chId, question] of Object.entries(firstQuestionsQuery.data)) {
        map.set(chId, question);
      }
    }
    return map;
  }, [firstQuestionsQuery.data]);

  const sortedLectureIdRef = useRef<string | null>(null);
  const [sortedChapters, setSortedChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    if (
      chapters.length > 0 &&
      annotatedChapterIdsQuery.data !== undefined &&
      sortedLectureIdRef.current !== lectureId
    ) {
      const initialAnnotatedSet = new Set(annotatedChapterIdsQuery.data);
      const sorted = [...chapters].sort((a, b) => {
        const aAnnotated = initialAnnotatedSet.has(a.id) ? 1 : 0;
        const bAnnotated = initialAnnotatedSet.has(b.id) ? 1 : 0;
        if (bAnnotated !== aAnnotated) {
          return bAnnotated - aAnnotated;
        }
        return a.order - b.order;
      });

      setSortedChapters(sorted);
      sortedLectureIdRef.current = lectureId;
    }
  }, [lectureId, chapters, annotatedChapterIdsQuery.data]);

  useEffect(() => {
    if (sortedChapters.length > 0) {
      if (chapterId) {
        const index = sortedChapters.findIndex((c) => c.id === chapterId);
        if (index !== -1) {
          setSelectedChapterIndex(index);
        }
      } else {
        setSelectedChapterIndex(0);
      }
    }
  }, [chapterId, sortedChapters]);

  const currentChapter = sortedChapters[selectedChapterIndex];
  const currentChapterQuestionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: currentChapter?.id || '' },
    { enabled: !!currentChapter?.id },
  );
  const currentChapterQuestions = useMemo(
    () => currentChapterQuestionsQuery.data || [],
    [currentChapterQuestionsQuery.data],
  );

  useEffect(() => {
    if (currentChapterQuestions.length > 0) {
      if (questionId) {
        const index = currentChapterQuestions.findIndex(
          (q) => q.id === questionId,
        );
        if (index !== -1) {
          setSelectedQuestionIndex(index);
        } else {
          setSelectedQuestionIndex(0);
        }
      } else {
        setSelectedQuestionIndex(0);
      }
    }
  }, [questionId, currentChapterQuestions]);

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return sortedChapters;
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return sortedChapters.filter((chapter) => {
      const firstQuestion = firstQuestionMap.get(chapter.id);
      const questionText = (firstQuestion?.question || '').toLowerCase();
      return tokens.every((token) => questionText.includes(token));
    });
  }, [sortedChapters, searchQuery, firstQuestionMap]);

  const currentProgressPosition = useMemo(() => {
    const countsPerChapter = questionCountsPerChapterQuery.data || {};
    let questionsInPreviousChapters = 0;
    for (let i = 0; i < selectedChapterIndex; i++) {
      const chapterId = sortedChapters[i]?.id;
      if (chapterId) {
        questionsInPreviousChapters += countsPerChapter[chapterId] || 0;
      }
    }
    return questionsInPreviousChapters + selectedQuestionIndex + 1;
  }, [
    selectedChapterIndex,
    selectedQuestionIndex,
    sortedChapters,
    questionCountsPerChapterQuery.data,
  ]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const button = chapterButtonsRef.current.get(selectedChapterIndex);
    if (button) {
      button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedChapterIndex]);

  const navigateToQuestion = useCallback(
    (
      chapterIndex: number,
      qIndex: number,
      questions?: typeof currentChapterQuestions,
    ) => {
      const chapter = sortedChapters[chapterIndex];
      if (chapter && questions && questions[qIndex]) {
        navigate(
          `/${basePath}/${lectureId}/${chapter.id}/${questions[qIndex].id}`,
        );
      } else if (chapter) {
        navigate(`/${basePath}/${lectureId}/${chapter.id}`);
      }
    },
    [sortedChapters, navigate, lectureId],
  );

  const handleNextQuestion = useCallback(() => {
    if (selectedQuestionIndex < currentChapterQuestions.length - 1) {
      navigateToQuestion(
        selectedChapterIndex,
        selectedQuestionIndex + 1,
        currentChapterQuestions,
      );
    } else if (selectedChapterIndex < sortedChapters.length - 1) {
      navigateToQuestion(selectedChapterIndex + 1, 0);
    }
  }, [
    selectedQuestionIndex,
    currentChapterQuestions,
    selectedChapterIndex,
    sortedChapters.length,
    navigateToQuestion,
  ]);

  const handlePrevQuestion = useCallback(() => {
    if (selectedQuestionIndex > 0) {
      navigateToQuestion(
        selectedChapterIndex,
        selectedQuestionIndex - 1,
        currentChapterQuestions,
      );
    } else if (selectedChapterIndex > 0) {
      const prevChapter = sortedChapters[selectedChapterIndex - 1];
      navigate(`/${basePath}/${lectureId}/${prevChapter.id}/__last__`);
    }
  }, [
    selectedQuestionIndex,
    selectedChapterIndex,
    navigateToQuestion,
    currentChapterQuestions,
    sortedChapters,
    navigate,
    lectureId,
  ]);

  useEffect(() => {
    if (questionId === '__last__' && currentChapterQuestions.length > 0) {
      const lastQuestion =
        currentChapterQuestions[currentChapterQuestions.length - 1];
      navigate(
        `/${basePath}/${lectureId}/${currentChapter?.id}/${lastQuestion.id}`,
        {
          replace: true,
        },
      );
    }
  }, [
    questionId,
    currentChapterQuestions,
    lectureId,
    currentChapter?.id,
    navigate,
  ]);

  const isFirstQuestion =
    selectedChapterIndex === 0 && selectedQuestionIndex === 0;
  const isLastQuestion =
    selectedChapterIndex === sortedChapters.length - 1 &&
    selectedQuestionIndex === currentChapterQuestions.length - 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement === searchInputRef.current) return;

      if (event.key === 'ArrowRight' && !isLastQuestion) {
        handleNextQuestion();
      } else if (event.key === 'ArrowLeft' && !isFirstQuestion) {
        handlePrevQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFirstQuestion, isLastQuestion, handleNextQuestion, handlePrevQuestion]);

  const currentQuestion = currentChapterQuestions[selectedQuestionIndex];

  // TTS playback function
  const playTts = useCallback(async () => {
    if (!currentQuestion) return;

    // Stop any existing playback
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
    }

    setIsTtsLoading(true);

    try {
      const language = i18n.language.startsWith('de') ? 'de' : 'en';
      const result = await synthesizeMutation.mutateAsync({
        text: currentQuestion.question,
        language,
      });

      const audioBlob = new Blob(
        [Uint8Array.from(atob(result.audioData), (c) => c.charCodeAt(0))],
        { type: 'audio/mpeg' },
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        setIsTtsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        // Auto-start recording after TTS finishes
        startRecordingRef.current();
      };

      audio.onerror = () => {
        setIsTtsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      setIsTtsLoading(false);
      setIsTtsPlaying(true);
      await audio.play();
    } catch {
      setIsTtsLoading(false);
      setIsTtsPlaying(false);
    }
  }, [currentQuestion, i18n.language, synthesizeMutation]);

  // Auto-play TTS when question changes
  const prevQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentQuestion && currentQuestion.id !== prevQuestionIdRef.current) {
      // Stop any ongoing recording when navigating
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        setIsRecording(false);
        if (sourceRef.current) {
          sourceRef.current.disconnect();
        }
        if (
          audioContextRef.current &&
          audioContextRef.current.state !== 'closed'
        ) {
          audioContextRef.current.close();
        }
      }

      prevQuestionIdRef.current = currentQuestion.id;
      // Clear previous transcription when navigating
      setTranscription('');
      setRecordingError('');
      // Auto-play TTS
      playTts();
    }
  }, [currentQuestion, playTts]);

  // Voice recording functions
  const startRecording = useCallback(async () => {
    try {
      setRecordingError('');
      setTranscription('');
      audioDataRef.current = [];
      isRecordingRef.current = true;
      hasSpeechStartedRef.current = false;
      speechSampleCountRef.current = 0;

      // Clear any existing timers
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (initialTimeoutRef.current) {
        clearTimeout(initialTimeoutRef.current);
        initialTimeoutRef.current = null;
      }

      // Start initial timeout - stop if user doesn't speak within 10 seconds
      initialTimeoutRef.current = setTimeout(() => {
        if (!hasSpeechStartedRef.current && isRecordingRef.current) {
          console.log('[LectureVoice] Initial timeout - no speech detected');
          setRecordingError(t('lectureVoice.inactivityTimeout'));
          stopRecordingRef.current(true); // Skip processing - no audio to transcribe
        }
      }, INITIAL_TIMEOUT_MS);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      audioContextRef.current = audioContext;

      try {
        await audioContext.audioWorklet.addModule('/audio-processor.js');
      } catch (e) {
        console.error('Failed to load audio worklet:', e);
        throw new Error(
          'Failed to load audio worklet. Ensure audio-processor.js is in public/.',
        );
      }

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

      workletNode.port.onmessage = (event) => {
        if (!isRecordingRef.current) return;
        const inputData = new Float32Array(event.data);
        audioDataRef.current.push(inputData);

        // Calculate RMS for silence detection
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        if (rms > SILENCE_THRESHOLD) {
          // Increment speech sample counter
          speechSampleCountRef.current++;

          // Only consider speech started after sustained samples above threshold
          if (
            speechSampleCountRef.current >= SPEECH_SAMPLES_REQUIRED &&
            !hasSpeechStartedRef.current
          ) {
            hasSpeechStartedRef.current = true;
            // Clear initial timeout since user started speaking
            if (initialTimeoutRef.current) {
              clearTimeout(initialTimeoutRef.current);
              initialTimeoutRef.current = null;
            }
          }

          // Clear silence timer if it's running (speech ongoing)
          if (hasSpeechStartedRef.current && silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          // Reset speech sample counter on silence
          speechSampleCountRef.current = 0;

          if (hasSpeechStartedRef.current && !silenceTimerRef.current) {
            // Silence detected after speech started - start timer
            silenceTimerRef.current = setTimeout(() => {
              console.log(
                '[LectureVoice] Silence timeout - stopping recording',
              );
              stopRecordingRef.current();
            }, SILENCE_TIMEOUT_MS);
          }
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setRecordingError(t('lectureVoice.microphoneError'));
      isRecordingRef.current = false;
    }
  }, [t]);

  // Update the ref whenever startRecording changes
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  const stopRecording = useCallback(
    async (skipProcessing = false) => {
      // Clear all timers
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (initialTimeoutRef.current) {
        clearTimeout(initialTimeoutRef.current);
        initialTimeoutRef.current = null;
      }

      setIsRecording(false);
      isRecordingRef.current = false;

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          await audioContextRef.current.close();
        }
      }

      // Skip audio processing if requested (e.g., inactivity timeout)
      if (skipProcessing) {
        setTranscription(''); // Ensure transcription area is hidden
        return;
      }

      if (audioDataRef.current.length === 0) {
        setRecordingError(t('lectureVoice.noAudioRecorded'));
        return;
      }

      const totalLength = audioDataRef.current.reduce(
        (acc, val) => acc + val.length,
        0,
      );

      if (totalLength === 0) {
        setRecordingError(t('lectureVoice.noAudioRecorded'));
        return;
      }

      const rawBuffer = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of audioDataRef.current) {
        rawBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      let finalBuffer = rawBuffer;
      const currentSampleRate = audioContextRef.current?.sampleRate || 48000;
      const targetSampleRate = 16000;

      if (currentSampleRate !== targetSampleRate) {
        try {
          const offlineCtx = new OfflineAudioContext(
            1,
            (rawBuffer.length * targetSampleRate) / currentSampleRate,
            targetSampleRate,
          );
          const source = offlineCtx.createBufferSource();
          const audioBuffer = offlineCtx.createBuffer(
            1,
            rawBuffer.length,
            currentSampleRate,
          );
          audioBuffer.copyToChannel(rawBuffer, 0);
          source.buffer = audioBuffer;
          source.connect(offlineCtx.destination);
          source.start();
          const renderedBuffer = await offlineCtx.startRendering();
          finalBuffer = renderedBuffer.getChannelData(0);
        } catch (err) {
          console.error('[LectureVoice] Resampling failed:', err);
          setRecordingError(t('lectureVoice.processingError'));
          return;
        }
      }

      const buffer = new ArrayBuffer(finalBuffer.length * 2);
      const view = new DataView(buffer);
      floatTo16BitPCM(view, 0, finalBuffer);

      const base64Audio = arrayBufferToBase64(buffer);

      try {
        const language = i18n.language.startsWith('de') ? 'de' : 'en';
        const result = await transcribeMutation.mutateAsync({
          audioData: base64Audio,
          language: language,
          sampleRate: 16000,
        });
        if (result) {
          setTranscription(result);
        } else {
          setRecordingError(t('lectureVoice.noSpeechRecognized'));
        }
      } catch (err) {
        console.error('[LectureVoice] Transcription error:', err);
        setRecordingError(t('lectureVoice.transcriptionError'));
      }
    },
    [t, i18n.language, transcribeMutation],
  );

  // Update the ref whenever stopRecording changes
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-4 md:py-12">
        <div className="mb-4 lg:mb-8">
          <BackButton to="/" label={t('lectureVoice.backToLectures')} />
          <Accordion
            title={lecture.title}
            description={lecture.description ?? undefined}
            rightElement={
              <span className="px-3 py-1 text-sm font-medium bg-purple-100 text-purple-700 rounded-full whitespace-nowrap">
                {t('lectureVoice.voiceMode')}
              </span>
            }
          />
        </div>

        {chapters.length === 0 ? (
          <div className="bg-surface rounded-xl shadow-md p-8 text-center">
            <p className="text-on-surface-variant mb-4">
              {t('lectureVoice.noChaptersYet')}
            </p>
            <button
              onClick={() => navigate(`/edit/${lectureId}`)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              {t('lectureVoice.addChapters')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 lg:gap-8 lg:grid-cols-[280px_1fr]">
            <ChapterSidebar
              title={t('lectureEdit.chapters')}
              chapters={sortedChapters}
              filteredChapters={filteredChapters}
              selectedIndex={selectedChapterIndex}
              onSelect={(chapter) =>
                navigate(`/${basePath}/${lectureId}/${chapter.id}`)
              }
              isSearchOpen={isSearchOpen}
              onSearchToggle={() => setIsSearchOpen(!isSearchOpen)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              getDisplayText={(chapter) => {
                const firstQ = firstQuestionMap.get(chapter.id);
                const displayText = firstQ?.question || t('common.untitled');
                return highlightText(displayText, searchQuery);
              }}
              highlightedChapterIds={annotatedChapterIds}
              searchInputRef={searchInputRef}
              chapterButtonsRef={chapterButtonsRef}
            />

            <div className="min-w-0 overflow-hidden bg-surface-container rounded-xl shadow-md">
              {currentChapter ? (
                <>
                  {totalQuestionsQuery.data && totalQuestionsQuery.data > 0 && (
                    <ProgressBar
                      current={currentProgressPosition}
                      total={totalQuestionsQuery.data}
                      flush
                    />
                  )}

                  <div className="p-8 pt-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="text-sm text-on-surface-variant">
                        {t('lectureVoice.questionProgress', {
                          current: selectedQuestionIndex + 1,
                          total: currentChapterQuestions.length,
                        })}
                      </div>
                      {currentChapter.association && (
                        <span className="px-3 py-1 text-sm font-medium bg-primary-100 text-primary-700 rounded-full">
                          {currentChapter.association}
                        </span>
                      )}
                    </div>

                    {currentQuestion ? (
                      <div className="space-y-6">
                        {/* TTS Status */}
                        <div className="flex items-center justify-center">
                          {isTtsLoading ? (
                            <div className="flex items-center gap-2 text-primary">
                              <Loader2 className="animate-spin" size={24} />
                              <span>{t('lectureVoice.readingQuestion')}</span>
                            </div>
                          ) : isTtsPlaying ? (
                            <div className="flex items-center gap-2 text-primary">
                              <div className="flex gap-1">
                                <span className="w-1 h-4 bg-primary rounded animate-pulse" />
                                <span
                                  className="w-1 h-4 bg-primary rounded animate-pulse"
                                  style={{ animationDelay: '0.2s' }}
                                />
                                <span
                                  className="w-1 h-4 bg-primary rounded animate-pulse"
                                  style={{ animationDelay: '0.4s' }}
                                />
                              </div>
                              <span>{t('lectureVoice.playingQuestion')}</span>
                            </div>
                          ) : (
                            <button
                              onClick={playTts}
                              className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                            >
                              {t('lectureVoice.playAgain')}
                            </button>
                          )}
                        </div>

                        {/* Voice Recording */}
                        <div className="flex flex-col items-center space-y-4">
                          <div className="flex justify-center">
                            {!isRecording ? (
                              <button
                                onClick={startRecording}
                                disabled={transcribeMutation.isLoading}
                                className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 transition-opacity"
                                aria-label={t('lectureVoice.recordResponse')}
                              >
                                <Mic size={32} />
                              </button>
                            ) : (
                              <button
                                onClick={() => stopRecording()}
                                className="w-20 h-20 rounded-full bg-error text-on-error flex items-center justify-center hover:opacity-90 transition-opacity animate-pulse"
                                aria-label={t('lectureVoice.stopRecording')}
                              >
                                <Square size={32} />
                              </button>
                            )}
                          </div>

                          <p className="text-sm text-on-surface-variant">
                            {isRecording
                              ? t('lectureVoice.stopRecording')
                              : t('lectureVoice.recordResponse')}
                          </p>
                        </div>

                        {/* Transcription Status */}
                        {transcribeMutation.isLoading && (
                          <div className="flex items-center justify-center gap-2 text-primary">
                            <Loader2 className="animate-spin" />
                            <span>{t('lectureVoice.transcribing')}</span>
                          </div>
                        )}

                        {/* Error Display */}
                        {recordingError && (
                          <div className="p-4 bg-error-container text-on-error-container rounded-lg text-center">
                            {recordingError}
                          </div>
                        )}

                        {/* Transcription Result */}
                        {transcription && (
                          <div className="p-4 bg-secondary-container text-on-secondary-container rounded-lg">
                            <h3 className="text-sm font-bold mb-2 opacity-75">
                              {t('lectureVoice.yourResponse')}
                            </h3>
                            <p className="text-lg">{transcription}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-on-surface-variant italic">
                        {t('lectureVoice.noContentYet')}
                      </p>
                    )}

                    <LectureNavigation
                      onPrev={handlePrevQuestion}
                      onNext={handleNextQuestion}
                      disablePrev={isFirstQuestion}
                      disableNext={isLastQuestion}
                    />
                  </div>
                </>
              ) : (
                <p className="text-on-surface-variant p-8">
                  {t('lectureVoice.selectAChapter')}
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export const LectureVoice = () => {
  const { id, chapterId, questionId } = useParams<{
    id: string;
    chapterId?: string;
    questionId?: string;
  }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const lectureQuery = trpc.lectures.getLecture.useQuery(
    { id: id! },
    { enabled: !!id },
  );

  const chaptersQuery = trpc.chapters.getChapters.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  const chapters = useMemo(
    () => chaptersQuery.data || [],
    [chaptersQuery.data],
  );

  if (lectureQuery.isLoading || chaptersQuery.isLoading) {
    return <LoadingState />;
  }

  if (!lectureQuery.data) {
    return (
      <ErrorState
        message={t('lectureEdit.lectureNotFound')}
        actionLabel={t('lectureEdit.backToOverview')}
        onAction={() => navigate('/')}
      />
    );
  }

  return (
    <LectureVoiceContent
      lectureId={id!}
      chapterId={chapterId}
      questionId={questionId}
      chapters={chapters}
      lecture={lectureQuery.data}
    />
  );
};
