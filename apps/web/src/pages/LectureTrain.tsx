import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Question } from '@athena/api';

import { Accordion } from '../components/Accordion';
import { AppHeader } from '../components/AppHeader';
import { ChapterSidebar } from '../components/ChapterSidebar';
import { ErrorState } from '../components/ErrorState';
import { LectureNavigation } from '../components/LectureNavigation';
import { LoadingState } from '../components/LoadingState';
import { SpeechPlayButton } from '../components/SpeechPlayButton';
import { BackButton } from '../components/buttons/BackButton';
import { highlightText } from '../utils/highlightText';
import { trpc } from '../utils/trpc';

export const LectureTrain = () => {
  const { t, i18n } = useTranslation();
  const { id, chapterId, questionId } = useParams<{
    id: string;
    chapterId?: string;
    questionId?: string;
  }>();
  const navigate = useNavigate();
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chapterButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  const lectureQuery = trpc.lectures.getLecture.useQuery(
    { id: id! },
    { enabled: !!id },
  );

  const chaptersQuery = trpc.chapters.getChapters.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  /* const chapters = chaptersQuery.data || []; */
  const chapters = useMemo(
    () => chaptersQuery.data || [],
    [chaptersQuery.data],
  );

  // Fetch all first questions for this lecture in a single call
  const firstQuestionsQuery =
    trpc.questions.getFirstQuestionsByLecture.useQuery(
      { lectureId: id! },
      { enabled: !!id },
    );

  // Fetch chapter IDs that have any annotated questions
  const annotatedChapterIdsQuery =
    trpc.questions.getAnnotatedChapterIdsByLecture.useQuery(
      { lectureId: id! },
      { enabled: !!id },
    );

  // Build a Set of chapter IDs that have annotated questions (for owl display)
  const annotatedChapterIds = useMemo(() => {
    return new Set(annotatedChapterIdsQuery.data || []);
  }, [annotatedChapterIdsQuery.data]);

  // Build a map of chapterId -> firstQuestion
  const firstQuestionMap = useMemo(() => {
    const map = new Map<string, Question | undefined>();
    if (firstQuestionsQuery.data) {
      for (const [chapterId, question] of Object.entries(
        firstQuestionsQuery.data,
      )) {
        map.set(chapterId, question);
      }
    }
    return map;
  }, [firstQuestionsQuery.data]);

  // Track which lecture has been sorted to preserve order during annotation toggles
  const sortedLectureIdRef = useRef<string | null>(null);
  const [sortedChapters, setSortedChapters] = useState<typeof chapters>([]);

  // Sort chapters only on initial load for each lecture
  useEffect(() => {
    // Only sort when we have data and haven't sorted this lecture yet
    if (
      chapters.length > 0 &&
      annotatedChapterIdsQuery.data !== undefined &&
      sortedLectureIdRef.current !== id
    ) {
      const initialAnnotatedSet = new Set(annotatedChapterIdsQuery.data);
      const sorted = [...chapters].sort((a, b) => {
        const aAnnotated = initialAnnotatedSet.has(a.id) ? 1 : 0;
        const bAnnotated = initialAnnotatedSet.has(b.id) ? 1 : 0;
        // Sort annotated first (descending), then by original order (ascending)
        if (bAnnotated !== aAnnotated) {
          return bAnnotated - aAnnotated;
        }
        return a.order - b.order;
      });
      setSortedChapters(sorted);
      sortedLectureIdRef.current = id!;
    }
  }, [id, chapters, annotatedChapterIdsQuery.data]);

  // Set selected chapter based on URL chapterId parameter
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

  // Fetch all questions for the current chapter
  const currentChapter = sortedChapters[selectedChapterIndex];
  const currentChapterQuestionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: currentChapter?.id || '' },
    { enabled: !!currentChapter?.id },
  );
  const currentChapterQuestions = useMemo(
    () => currentChapterQuestionsQuery.data || [],
    [currentChapterQuestionsQuery.data],
  );

  // Set selected question based on URL questionId parameter
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

  // Tokenized search filter
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return sortedChapters;
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return sortedChapters.filter((chapter) => {
      const firstQuestion = firstQuestionMap.get(chapter.id);
      const questionText = (firstQuestion?.question || '').toLowerCase();
      return tokens.every((token) => questionText.includes(token));
    });
  }, [sortedChapters, searchQuery, firstQuestionMap]);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Scroll selected chapter into view
  useEffect(() => {
    const button = chapterButtonsRef.current.get(selectedChapterIndex);
    if (button) {
      button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedChapterIndex]);

  // Navigation helper functions
  const navigateToQuestion = useCallback(
    (
      chapterIndex: number,
      questionIndex: number,
      questions?: typeof currentChapterQuestions,
    ) => {
      const chapter = sortedChapters[chapterIndex];
      if (chapter && questions && questions[questionIndex]) {
        navigate(`/train/${id}/${chapter.id}/${questions[questionIndex].id}`);
      } else if (chapter) {
        // Will load questions and default to first
        navigate(`/train/${id}/${chapter.id}`);
      }
    },
    [sortedChapters, navigate, id],
  );

  const handleNextQuestion = useCallback(() => {
    if (selectedQuestionIndex < currentChapterQuestions.length - 1) {
      // Next question in same chapter
      navigateToQuestion(
        selectedChapterIndex,
        selectedQuestionIndex + 1,
        currentChapterQuestions,
      );
    } else if (selectedChapterIndex < sortedChapters.length - 1) {
      // First question of next chapter
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
      // Previous question in same chapter
      navigateToQuestion(
        selectedChapterIndex,
        selectedQuestionIndex - 1,
        currentChapterQuestions,
      );
    } else if (selectedChapterIndex > 0) {
      // Last question of previous chapter - will be handled after fetch
      const prevChapter = sortedChapters[selectedChapterIndex - 1];
      navigate(`/train/${id}/${prevChapter.id}/__last__`);
    }
  }, [
    selectedQuestionIndex,
    selectedChapterIndex,
    navigateToQuestion,
    currentChapterQuestions,
    sortedChapters,
    navigate,
    id,
  ]);

  // Handle __last__ special questionId to navigate to last question of a chapter
  useEffect(() => {
    if (questionId === '__last__' && currentChapterQuestions.length > 0) {
      const lastQuestion =
        currentChapterQuestions[currentChapterQuestions.length - 1];
      navigate(`/train/${id}/${currentChapter?.id}/${lastQuestion.id}`, {
        replace: true,
      });
    }
  }, [questionId, currentChapterQuestions, id, currentChapter?.id, navigate]);

  const isFirstQuestion =
    selectedChapterIndex === 0 && selectedQuestionIndex === 0;
  const isLastQuestion =
    selectedChapterIndex === sortedChapters.length - 1 &&
    selectedQuestionIndex === currentChapterQuestions.length - 1;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger navigation if search is focused
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
    id,
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
        lectureId: id,
      });
    },
  });

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

  const lecture = lectureQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-4 md:py-12">
        {/* Lecture Header */}
        <div className="mb-4 lg:mb-8">
          <BackButton to="/" label={t('lectureTrain.backToLectures')} />
          <Accordion title={lecture.title} description={lecture.description} />
        </div>

        {chapters.length === 0 ? (
          <div className="bg-surface rounded-xl shadow-md p-8 text-center">
            <p className="text-on-surface-variant mb-4">
              {t('lectureTrain.noChaptersYet')}
            </p>
            <button
              onClick={() => navigate(`/edit/${id}`)}
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
              onSelect={(chapter) => navigate(`/train/${id}/${chapter.id}`)}
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

            {/* Chapter Content */}
            <div className="min-w-0 overflow-hidden bg-surface-container rounded-xl shadow-md p-8">
              {currentChapter ? (
                <>
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
                              {t('lectureTrain.questionProgress', {
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
