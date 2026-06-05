import { Check, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { highlightText } from '../utils/highlightText';
import { trpc } from '../utils/trpc';
import { Accordion } from './Accordion';
import { AppHeader } from './AppHeader';
import { ChapterSidebar } from './ChapterSidebar';
import { ErrorState } from './ErrorState';
import { FlashCard } from './FlashCard';
import { LoadingState } from './LoadingState';
import { ProgressBar } from './ProgressBar';
import { SpeechPlayButton } from './SpeechPlayButton';
import { Button } from './buttons/Button';

export type TrainingMode = 'regular' | 'randomized';

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

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

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
      let sorted: Chapter[];

      if (mode === 'randomized') {
        sorted = shuffleArray(chapters);
      } else {
        const initialAnnotatedSet = new Set(annotatedChapterIdsQuery.data);
        sorted = [...chapters].sort((a, b) => {
          const aAnnotated = initialAnnotatedSet.has(a.id) ? 1 : 0;
          const bAnnotated = initialAnnotatedSet.has(b.id) ? 1 : 0;
          if (bAnnotated !== aAnnotated) {
            return bAnnotated - aAnnotated;
          }
          return a.order - b.order;
        });
      }

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

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return sortedChapters;
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return sortedChapters.filter((chapter) => {
      const firstQuestion = firstQuestionMap.get(chapter.id);
      const questionText = (firstQuestion?.question || '').toLowerCase();
      return tokens.every((token) => questionText.includes(token));
    });
  }, [sortedChapters, searchQuery, firstQuestionMap]);

  // Calculate current progress position across all chapters
  // Sum questions from all previous chapters + current question index + 1
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
    [sortedChapters, navigate, lectureId, basePath],
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

  const isFirstQuestion =
    selectedChapterIndex === 0 && selectedQuestionIndex === 0;
  const isLastQuestion =
    selectedChapterIndex === sortedChapters.length - 1 &&
    selectedQuestionIndex === currentChapterQuestions.length - 1;

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
            rightElement={
              mode === 'randomized' ? (
                <span className="px-3 py-1 text-sm font-medium bg-accent-soft text-accent-soft-ink rounded-full whitespace-nowrap">
                  {t('lectureTrain.randomizedMode')}
                </span>
              ) : undefined
            }
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

            <div className="min-w-0 overflow-hidden bg-surface-container border border-border rounded-xl shadow-sm">
              {currentChapter ? (
                <>
                  {/* Progress Bar - at top of card, below border */}
                  {totalQuestionsQuery.data && totalQuestionsQuery.data > 0 && (
                    <ProgressBar
                      current={currentProgressPosition}
                      total={totalQuestionsQuery.data}
                      flush
                    />
                  )}

                  <div className="p-8 pt-0">
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-2xl font-bold text-on-background"></h2>
                      {currentChapter.association && (
                        <span className="px-3 py-1 text-sm font-medium bg-accent-soft text-accent-soft-ink rounded-full">
                          {currentChapter.association}
                        </span>
                      )}
                    </div>

                    {currentChapterQuestions.length > 0 ? (
                      (() => {
                        const question =
                          currentChapterQuestions[selectedQuestionIndex];
                        if (!question) return null;
                        return (
                          <div>
                            <div className="text-sm text-on-surface-variant mb-4">
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
                                  className="flex-1 max-w-[220px] py-3.5 rounded-lg font-semibold inline-flex items-center justify-center gap-2 bg-success text-accent-ink transition-colors"
                                  onClick={() => {
                                    updateQuestion.mutate({
                                      id: question.id,
                                      isAnnotated: false,
                                    });
                                    handleNextQuestion();
                                  }}
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
                    )}
                  </div>
                </>
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
