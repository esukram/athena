import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { highlightText } from '../utils/highlightText';
import { trpc } from '../utils/trpc';
import { Accordion } from './Accordion';
import { AppHeader } from './AppHeader';
import { ChapterSidebar } from './ChapterSidebar';
import { ErrorState } from './ErrorState';
import { LectureNavigation } from './LectureNavigation';
import { LoadingState } from './LoadingState';
import { ProgressBar } from './ProgressBar';
import { SpeechPlayButton } from './SpeechPlayButton';
import { BackButton } from './buttons/BackButton';

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
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chapterButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());

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
  ]);

  const utils = trpc.useContext();
  const updateQuestion = trpc.questions.updateQuestion.useMutation({
    onSuccess: () => {
      utils.questions.getQuestions.invalidate({
        chapterId: currentChapter?.id,
      });
      utils.questions.getAnnotatedChapterIdsByLecture.invalidate({
        lectureId,
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-4 md:py-12">
        <div className="mb-4 lg:mb-8">
          <BackButton to="/" label={t('lectureTrain.backToLectures')} />
          <Accordion
            title={lecture.title}
            description={lecture.description ?? undefined}
            rightElement={
              mode === 'randomized' ? (
                <span className="px-3 py-1 text-sm font-medium bg-amber-100 text-amber-700 rounded-full whitespace-nowrap">
                  {t('lectureTrain.randomizedMode')}
                </span>
              ) : undefined
            }
          />
        </div>

        {chapters.length === 0 ? (
          <div className="bg-surface rounded-xl shadow-md p-8 text-center">
            <p className="text-on-surface-variant mb-4">
              {t('lectureTrain.noChaptersYet')}
            </p>
            <button
              onClick={() => navigate(`/edit/${lectureId}`)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
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

            <div className="min-w-0 overflow-hidden bg-surface-container rounded-xl shadow-md p-8">
              {currentChapter ? (
                <>
                  {/* Progress Bar */}
                  {totalQuestionsQuery.data && totalQuestionsQuery.data > 0 && (
                    <ProgressBar
                      current={currentProgressPosition}
                      total={totalQuestionsQuery.data}
                    />
                  )}

                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-on-background"></h2>
                    {currentChapter.association && (
                      <span className="px-3 py-1 text-sm font-medium bg-primary-100 text-primary-700 rounded-full">
                        {currentChapter.association}
                      </span>
                    )}
                  </div>

                  {currentChapterQuestions.length > 0 ? (
                    <div className="space-y-4">
                      {(() => {
                        const question =
                          currentChapterQuestions[selectedQuestionIndex];
                        if (!question) return null;
                        return (
                          <div key={question.id}>
                            <div className="text-sm text-on-surface-variant">
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
                            <Accordion
                              title={question.question}
                              noShadow
                              noPadding
                              leftIcon={
                                <span className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
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
                                  <SpeechPlayButton
                                    text={question.question}
                                    language={
                                      i18n.language.startsWith('de')
                                        ? 'de'
                                        : 'en'
                                    }
                                  />
                                </span>
                              }
                            >
                              {question.answer ? (
                                <div>
                                  <div className="prose prose-lg max-w-none">
                                    <ReactMarkdown>
                                      {question.answer}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-on-surface-variant italic">
                                  {t('lectureTrain.noAnswerYet')}
                                </p>
                              )}
                            </Accordion>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-on-surface-variant italic">
                      {t('lectureTrain.noContentYet')}
                    </p>
                  )}

                  <LectureNavigation
                    onPrev={handlePrevQuestion}
                    onNext={handleNextQuestion}
                    disablePrev={isFirstQuestion}
                    disableNext={isLastQuestion}
                  />
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
