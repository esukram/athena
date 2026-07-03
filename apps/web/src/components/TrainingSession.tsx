import { Check, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Chapter, Question } from '@athena/api';
import {
  type TrainingMode,
  isFirstQuestion as computeIsFirstQuestion,
  isLastQuestion as computeIsLastQuestion,
  filterChaptersByQuestionText,
  nextTrainingStep,
  orderChaptersForTraining,
  prevTrainingStep,
  trainingProgressPosition,
} from '@athena/domain/training';

import { highlightText } from '../utils/highlightText';
import { trpc } from '../utils/trpc';
import { Accordion } from './Accordion';
import { AppHeader } from './AppHeader';
import { ChapterSidebar } from './ChapterSidebar';
import { ErrorState } from './ErrorState';
import { FlashCard } from './FlashCard';
import { LoadingState } from './LoadingState';
import { ProgressBar } from './ProgressBar';
import { ShuffleToggle } from './ShuffleToggle';
import { SpeechPlayButton } from './SpeechPlayButton';
import { Button } from './buttons/Button';

export type { TrainingMode };

export interface TrainingSessionProps {
  lectureId: string;
  chapterId?: string;
  questionId?: string;
  mode: TrainingMode;
  chapters: Chapter[];
}

interface TrainingSessionContentProps extends TrainingSessionProps {
  lecture: { id: string; title: string; description: string | null };
}

const TrainingSessionContent = ({
  lectureId,
  chapterId,
  questionId,
  mode,
  chapters,
  lecture,
}: TrainingSessionContentProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const flipTimers = useRef<number[]>([]);
  const lastQuestionIdRef = useRef<string | undefined>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chapterButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  const clearFlipTimers = useCallback(() => {
    flipTimers.current.forEach((id) => window.clearTimeout(id));
    flipTimers.current = [];
  }, []);

  const flip = useCallback(() => {
    if (flipping) return;
    setFlipping(true);
    flipTimers.current.push(
      window.setTimeout(() => setFlipped((f) => !f), 190),
      window.setTimeout(() => setFlipping(false), 410),
    );
  }, [flipping]);

  const basePath = mode === 'randomized' ? 'train-random' : 'train';

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

  // Query for total question count (for progress bar)
  const totalQuestionsQuery =
    trpc.questions.getQuestionCountsByLecture.useQuery(
      { lectureId },
      { enabled: !!lectureId },
    );

  // Query for per-chapter question counts (for accurate progress calculation)
  const questionCountsPerChapterQuery =
    trpc.questions.getQuestionCountsPerChapter.useQuery(
      { lectureId },
      { enabled: !!lectureId },
    );

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
      const sorted = orderChaptersForTraining(
        chapters,
        mode,
        annotatedChapterIdsQuery.data,
      );

      setSortedChapters(sorted);
      sortedLectureIdRef.current = lectureId;
    }
  }, [lectureId, chapters, annotatedChapterIdsQuery.data, mode]);

  const selectedChapterIndex = useMemo(() => {
    if (sortedChapters.length > 0 && chapterId) {
      const index = sortedChapters.findIndex((c) => c.id === chapterId);
      if (index !== -1) return index;
    }
    return 0;
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

  const selectedQuestionIndex = useMemo(() => {
    if (currentChapterQuestions.length > 0 && questionId) {
      const index = currentChapterQuestions.findIndex(
        (q) => q.id === questionId,
      );
      if (index !== -1) return index;
    }
    return 0;
  }, [questionId, currentChapterQuestions]);

  const filteredChapters = useMemo(
    () =>
      filterChaptersByQuestionText(
        sortedChapters,
        searchQuery,
        (chapter) => firstQuestionMap.get(chapter.id)?.question || '',
      ),
    [sortedChapters, searchQuery, firstQuestionMap],
  );

  // Calculate current progress position across all chapters
  // Sum questions from all previous chapters + current question index + 1
  const currentProgressPosition = useMemo(
    () =>
      trainingProgressPosition({
        sortedChapters,
        selectedChapterIndex,
        selectedQuestionIndex,
        questionCountsPerChapter: questionCountsPerChapterQuery.data || {},
      }),
    [
      selectedChapterIndex,
      selectedQuestionIndex,
      sortedChapters,
      questionCountsPerChapterQuery.data,
    ],
  );

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const button = chapterButtonsRef.current.get(selectedChapterIndex);
    if (!button) return;
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Selecting a chapter leaves DOM focus on its sidebar button. Keyboard
    // navigation moves the active chapter via the URL (handled by a global
    // listener) without moving focus, so the previously-selected button would
    // keep its :focus-visible outline — a stray border on the wrong chapter.
    // When a chapter button still holds focus, move it to the active chapter so
    // the outline tracks the highlight. Focus is only touched when a chapter
    // button has it, never stealing it from the card or its nav controls.
    const active = document.activeElement;
    const focusOnChapterButton =
      active instanceof HTMLButtonElement &&
      active !== button &&
      [...chapterButtonsRef.current.values()].includes(active);
    if (focusOnChapterButton) {
      button.focus({ preventScroll: true });
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
    [sortedChapters, navigate, lectureId, basePath],
  );

  const cursor = useMemo(
    () => ({
      selectedChapterIndex,
      selectedQuestionIndex,
      currentChapterQuestionCount: currentChapterQuestions.length,
      chapterCount: sortedChapters.length,
    }),
    [
      selectedChapterIndex,
      selectedQuestionIndex,
      currentChapterQuestions.length,
      sortedChapters.length,
    ],
  );

  const handleNextQuestion = useCallback(() => {
    const step = nextTrainingStep(cursor);
    if (step?.kind === 'question') {
      navigateToQuestion(
        step.chapterIndex,
        step.questionIndex,
        currentChapterQuestions,
      );
    } else if (step?.kind === 'chapter-start') {
      navigateToQuestion(step.chapterIndex, 0);
    }
  }, [cursor, currentChapterQuestions, navigateToQuestion]);

  const handlePrevQuestion = useCallback(() => {
    const step = prevTrainingStep(cursor);
    if (step?.kind === 'question') {
      navigateToQuestion(
        step.chapterIndex,
        step.questionIndex,
        currentChapterQuestions,
      );
    } else if (step?.kind === 'chapter-end') {
      const prevChapter = sortedChapters[step.chapterIndex];
      navigate(`/${basePath}/${lectureId}/${prevChapter.id}/__last__`);
    }
  }, [
    cursor,
    navigateToQuestion,
    currentChapterQuestions,
    sortedChapters,
    navigate,
    lectureId,
    basePath,
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
    basePath,
  ]);

  const isFirstQuestion = computeIsFirstQuestion(cursor);
  const isLastQuestion = computeIsLastQuestion(cursor);

  const currentQuestionId = currentChapterQuestions[selectedQuestionIndex]?.id;

  // Reset the flip state whenever the active question changes. Sidebar clicks,
  // arrow navigation and the __last__ replace-redirect can all switch questions
  // outside the flip-button path, so this guards every transition. We adjust
  // state during render (React's recommended pattern) instead of in an effect
  // so the reset is applied before paint and avoids cascading effect renders.
  if (lastQuestionIdRef.current !== currentQuestionId) {
    lastQuestionIdRef.current = currentQuestionId;
    if (flipped) setFlipped(false);
    if (flipping) setFlipping(false);
  }

  // Clearing the pending flip timers is an external-system side effect, so it
  // belongs in an effect keyed on the active question — this prevents a
  // mid-flip navigation from firing setState on a stale card.
  useEffect(() => {
    clearFlipTimers();
  }, [currentQuestionId, clearFlipTimers]);

  useEffect(() => clearFlipTimers, [clearFlipTimers]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable)
      ) {
        return;
      }

      if (event.code === 'Space') {
        // Don't hijack Space when a button/link is focused — the browser needs
        // it to activate the focused control (Space-to-click). Only flip when
        // focus is on a non-interactive element.
        if (
          active &&
          (active.tagName === 'BUTTON' ||
            active.tagName === 'A' ||
            active.getAttribute('role') === 'button')
        ) {
          return;
        }
        event.preventDefault();
        flip();
        return;
      }

      if (event.key === 'ArrowRight' && !isLastQuestion) {
        handleNextQuestion();
      } else if (event.key === 'ArrowLeft' && !isFirstQuestion) {
        handlePrevQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    sortedChapters,
    selectedChapterIndex,
    selectedQuestionIndex,
    currentChapterQuestions,
    lectureId,
    navigate,
    isFirstQuestion,
    isLastQuestion,
    handleNextQuestion,
    handlePrevQuestion,
    flip,
  ]);

  const utils = trpc.useContext();
  const updateQuestion = trpc.questions.updateQuestion.useMutation({
    // Invalidate by the chapter the mutated question belongs to (captured from
    // the variables) so a navigation away from the current chapter during the
    // request still refreshes the right list.
    onSuccess: (_data, variables) => {
      const chapterId =
        currentChapterQuestions.find((q) => q.id === variables.id)?.chapterId ??
        currentChapter?.id;
      utils.questions.getQuestions.invalidate({ chapterId });
      utils.questions.getAnnotatedChapterIdsByLecture.invalidate({
        lectureId,
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader back={{ to: '/', label: t('lectureTrain.backToLectures') }} />

      <main className="container mx-auto px-4 py-4 md:py-12">
        <div className="mb-4 lg:mb-8">
          <Accordion
            title={lecture.title}
            description={lecture.description ?? undefined}
          />
        </div>

        {chapters.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
            <p className="text-on-surface-variant mb-4">
              {t('lectureTrain.noChaptersYet')}
            </p>
            <button
              onClick={() => navigate(`/edit/${lectureId}`)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-on-primary rounded-lg transition-colors"
            >
              {t('lectureTrain.addChapters')}
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

            <div className="min-w-0">
              {currentChapter ? (
                currentChapterQuestions.length > 0 ? (
                  (() => {
                    const question =
                      currentChapterQuestions[selectedQuestionIndex];
                    if (!question) return null;
                    return (
                      <div>
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div className="text-sm font-medium text-ink-soft">
                            {mode === 'randomized'
                              ? t('lectureTrain.questionProgressRandomized', {
                                  current: selectedQuestionIndex + 1,
                                  total: currentChapterQuestions.length,
                                  chapterIndex: selectedChapterIndex + 1,
                                  chapterTotal: sortedChapters.length,
                                })
                              : t('lectureTrain.questionProgress', {
                                  current: selectedQuestionIndex + 1,
                                  total: currentChapterQuestions.length,
                                })}
                          </div>
                          <ShuffleToggle
                            checked={mode === 'randomized'}
                            onChange={(checked) =>
                              navigate(
                                `/${checked ? 'train-random' : 'train'}/${lectureId}`,
                              )
                            }
                          />
                        </div>

                        {totalQuestionsQuery.data &&
                          totalQuestionsQuery.data > 0 && (
                            <ProgressBar
                              current={currentProgressPosition}
                              total={totalQuestionsQuery.data}
                            />
                          )}

                        <div className="mt-5">
                          <FlashCard
                            question={question.question}
                            answer={question.answer || null}
                            association={currentChapter.association}
                            flipped={flipped}
                            onFlip={flip}
                            flipping={flipping}
                            annotateButton={
                              <button
                                onClick={() => {
                                  updateQuestion.mutate({
                                    id: question.id,
                                    isAnnotated: !question.isAnnotated,
                                  });
                                }}
                                className={`p-1 rounded-full transition-all hover:scale-110 ${
                                  question.isAnnotated
                                    ? ''
                                    : 'opacity-50 hover:opacity-100'
                                }`}
                                title={
                                  question.isAnnotated
                                    ? t('lectureTrain.annotated')
                                    : t('lectureTrain.annotate')
                                }
                              >
                                <span
                                  className={`text-xl ${
                                    question.isAnnotated ? '' : 'grayscale'
                                  }`}
                                >
                                  🦉
                                </span>
                              </button>
                            }
                            voice={
                              <SpeechPlayButton
                                text={question.question}
                                language={
                                  (
                                    i18n.resolvedLanguage ?? i18n.language
                                  ).startsWith('de')
                                    ? 'de'
                                    : 'en'
                                }
                              />
                            }
                          />
                        </div>

                        {!flipped ? (
                          <div className="flex items-center justify-between gap-3 mt-6">
                            <button
                              type="button"
                              className="nav-round"
                              disabled={isFirstQuestion}
                              onClick={handlePrevQuestion}
                              aria-label={t('common.previous')}
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <Button
                              variant="secondary"
                              size="lg"
                              className="flex-1 max-w-[320px] inline-flex items-center justify-center gap-2"
                              onClick={flip}
                            >
                              <RotateCw size={18} />
                              {t('lectureTrain.flipCard')}
                            </Button>
                            <button
                              type="button"
                              className="nav-round"
                              disabled={isLastQuestion}
                              onClick={handleNextQuestion}
                              aria-label={t('common.next')}
                            >
                              <ChevronRight size={20} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-3 mt-6 justify-center">
                            <button
                              type="button"
                              className="flex-1 max-w-[220px] py-3.5 rounded-lg font-semibold inline-flex items-center justify-center gap-2 bg-surface border border-border text-ink-soft hover:border-accent hover:text-ink transition-colors"
                              onClick={() => {
                                updateQuestion.mutate({
                                  id: question.id,
                                  isAnnotated: true,
                                });
                                handleNextQuestion();
                              }}
                            >
                              <RotateCw size={18} />
                              {t('lectureTrain.reviewAgain')}
                            </button>
                            <button
                              type="button"
                              className="flex-1 max-w-[220px] py-3.5 rounded-lg font-semibold inline-flex items-center justify-center gap-2 bg-success text-accent-ink transition-colors hover:opacity-90 active:translate-y-px"
                              onClick={handleNextQuestion}
                            >
                              <Check size={18} />
                              {t('lectureTrain.gotIt')}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-on-surface-variant italic">
                    {t('lectureTrain.noContentYet')}
                  </p>
                )
              ) : (
                <p className="text-on-surface-variant">
                  {t('lectureTrain.selectAChapter')}
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export const TrainingSession = ({
  lectureId,
  chapterId,
  questionId,
  mode,
}: Omit<TrainingSessionProps, 'chapters'>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const lectureQuery = trpc.lectures.getLecture.useQuery(
    { id: lectureId },
    { enabled: !!lectureId },
  );

  const chaptersQuery = trpc.chapters.getChapters.useQuery(
    { lectureId },
    { enabled: !!lectureId },
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
    <TrainingSessionContent
      lectureId={lectureId}
      chapterId={chapterId}
      questionId={questionId}
      mode={mode}
      chapters={chapters}
      lecture={lectureQuery.data}
    />
  );
};
