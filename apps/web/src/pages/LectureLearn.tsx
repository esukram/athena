import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { Accordion } from '../components/Accordion';
import { AppHeader } from '../components/AppHeader';
import { ChapterMenu } from '../components/ChapterMenu';
import { ChapterSidebar } from '../components/ChapterSidebar';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { LectureNavigation } from '../components/LectureNavigation';
import { BackButton } from '../components/buttons/BackButton';
import { highlightText } from '../utils/highlightText';
import { trpc } from '../utils/trpc';

export const LectureLearn = () => {
  const { t } = useTranslation();
  const { id, chapterId } = useParams<{ id: string; chapterId?: string }>();
  const navigate = useNavigate();
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
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

  // Set selected chapter based on URL chapterId parameter
  useEffect(() => {
    if (chapters.length > 0) {
      if (chapterId) {
        const index = chapters.findIndex((c) => c.id === chapterId);
        if (index !== -1) {
          setSelectedChapterIndex(index);
        }
      } else {
        setSelectedChapterIndex(0);
      }
    }
  }, [chapterId, chapters]);

  // Tokenized search filter
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return chapters.filter((chapter) => {
      const firstQuestion = firstQuestionMap.get(chapter.id);
      const questionText = (firstQuestion?.question || '').toLowerCase();
      return tokens.every((token) => questionText.includes(token));
    });
  }, [chapters, searchQuery, firstQuestionMap]);

  // Use the reusable highlightText utility
  const highlightMatches = (text: string) => highlightText(text, searchQuery);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger navigation if search is focused
      if (document.activeElement === searchInputRef.current) return;

      if (event.key === 'ArrowRight') {
        const nextIndex = selectedChapterIndex + 1;
        if (nextIndex < chapters.length) {
          navigate(`/learn/${id}/${chapters[nextIndex].id}`);
        }
      } else if (event.key === 'ArrowLeft') {
        const prevIndex = selectedChapterIndex - 1;
        if (prevIndex >= 0) {
          navigate(`/learn/${id}/${chapters[prevIndex].id}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chapters, selectedChapterIndex, id, navigate]);

  // Fetch all questions for the current chapter
  const currentChapter = chapters[selectedChapterIndex];
  const currentChapterQuestionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: currentChapter?.id || '' },
    { enabled: !!currentChapter?.id },
  );
  const currentChapterQuestions = currentChapterQuestionsQuery.data || [];

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
  const currentFirstQuestion = currentChapter
    ? firstQuestionMap.get(currentChapter.id)
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 md:py-12">
        {/* Lecture Header */}
        <div className="mb-8">
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
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            {/* Chapter Navigation */}
            <ChapterSidebar
              title={t('lectureEdit.chapters')}
              chapters={chapters}
              filteredChapters={filteredChapters}
              selectedIndex={selectedChapterIndex}
              onSelect={(chapter: Chapter) =>
                navigate(`/learn/${id}/${chapter.id}`)
              }
              isSearchOpen={isSearchOpen}
              onSearchToggle={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) {
                  setSearchQuery('');
                }
              }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              getDisplayText={(chapter: Chapter) => {
                const firstQ = firstQuestionMap.get(chapter.id);
                const displayText = firstQ?.question || t('common.untitled');
                return searchQuery.trim()
                  ? highlightMatches(displayText)
                  : displayText;
              }}
              searchInputRef={searchInputRef}
              chapterButtonsRef={chapterButtonsRef}
            />

            {/* Chapter Content */}
            <div className="min-w-0 overflow-hidden bg-surface-container rounded-xl shadow-md p-8">
              {currentChapter ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-on-background">
                      {currentFirstQuestion?.question || t('common.untitled')}
                    </h2>
                    <div className="flex items-center gap-2">
                      {currentChapter.association && (
                        <span className="px-3 py-1 text-sm font-medium bg-primary-100 text-primary-700 rounded-full">
                          {currentChapter.association}
                        </span>
                      )}
                      <ChapterMenu chapter={currentChapter} lectureId={id!} />
                    </div>
                  </div>

                  {currentChapterQuestions.length > 0 ? (
                    <div className="space-y-8">
                      {currentChapterQuestions.map((question, index) => (
                        <div
                          key={question.id}
                          className={
                            index > 0 ? 'pt-8 border-t border-gray-200' : ''
                          }
                        >
                          {index > 0 && (
                            <h2 className="text-2xl font-bold text-on-background mb-4">
                              {question.question}
                            </h2>
                          )}
                          {question.answer ? (
                            <div className="prose prose-lg max-w-none">
                              <ReactMarkdown>{question.answer}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-on-surface-variant italic">
                              {t('lectureTrain.noAnswerYet')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-on-surface-variant italic">
                      {t('lectureTrain.noContentYet')}
                    </p>
                  )}

                  <LectureNavigation
                    onPrev={() =>
                      navigate(
                        `/learn/${id}/${chapters[selectedChapterIndex - 1].id}`,
                      )
                    }
                    onNext={() =>
                      navigate(
                        `/learn/${id}/${chapters[selectedChapterIndex + 1].id}`,
                      )
                    }
                    disablePrev={selectedChapterIndex === 0}
                    disableNext={selectedChapterIndex === chapters.length - 1}
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
