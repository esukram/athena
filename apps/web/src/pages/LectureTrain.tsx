import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Question } from '@athena/api';

import { Accordion } from '../components/Accordion';
import { AppHeader } from '../components/AppHeader';
import { trpc } from '../utils/trpc';

export const LectureTrain = () => {
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

  const chapters = chaptersQuery.data || [];

  // Fetch all first questions for this lecture in a single call
  const firstQuestionsQuery = trpc.questions.getFirstQuestionsByLecture.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  // Fetch chapter IDs that have any annotated questions
  const annotatedChapterIdsQuery = trpc.questions.getAnnotatedChapterIdsByLecture.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  // Build a Set of chapter IDs that have annotated questions
  const annotatedChapterIds = useMemo(() => {
    return new Set(annotatedChapterIdsQuery.data || []);
  }, [annotatedChapterIdsQuery.data]);

  // Build a map of chapterId -> firstQuestion
  const firstQuestionMap = new Map<string, Question | undefined>();
  if (firstQuestionsQuery.data) {
    for (const [chapterId, question] of Object.entries(firstQuestionsQuery.data)) {
      firstQuestionMap.set(chapterId, question);
    }
  }

  // Sort chapters: annotated questions first, then by original order
  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => {
      const aAnnotated = annotatedChapterIds.has(a.id) ? 1 : 0;
      const bAnnotated = annotatedChapterIds.has(b.id) ? 1 : 0;
      // Sort annotated first (descending), then by original order (ascending)
      if (bAnnotated !== aAnnotated) {
        return bAnnotated - aAnnotated;
      }
      return a.order - b.order;
    });
  }, [chapters, annotatedChapterIds]);

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

  // Highlight matching tokens in text
  const highlightMatches = (text: string, query: string) => {
    if (!query.trim()) return text;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return text;

    // Build a regex to match any of the tokens (case-insensitive)
    const escapedTokens = tokens.map((t) =>
      t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');

    const parts = text.split(regex);
    return parts.map((part, index) => {
      const isMatch = tokens.some((token) => part.toLowerCase() === token);
      if (isMatch) {
        return (
          <mark
            key={index}
            className="bg-yellow-200 text-inherit rounded px-0.5"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

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
        if (nextIndex < sortedChapters.length) {
          navigate(`/train/${id}/${sortedChapters[nextIndex].id}`);
        }
      } else if (event.key === 'ArrowLeft') {
        const prevIndex = selectedChapterIndex - 1;
        if (prevIndex >= 0) {
          navigate(`/train/${id}/${sortedChapters[prevIndex].id}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedChapters, selectedChapterIndex, id, navigate]);

  // Fetch all questions for the current chapter
  const currentChapter = sortedChapters[selectedChapterIndex];
  const currentChapterQuestionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: currentChapter?.id || '' },
    { enabled: !!currentChapter?.id },
  );
  const currentChapterQuestions = currentChapterQuestionsQuery.data || [];

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
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <p className="text-on-surface-variant">{t('common.loading')}</p>
        </main>
      </div>
    );
  }

  if (!lectureQuery.data) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <p className="text-error">{t('lectureEdit.lectureNotFound')}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
          >
            {t('lectureEdit.backToOverview')}
          </button>
        </main>
      </div>
    );
  }

  const lecture = lectureQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 md:py-12">
        {/* Lecture Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-primary-600 hover:text-primary-700 text-sm mb-4 flex items-center gap-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            {t('lectureTrain.backToLectures')}
          </button>
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
            <div className="min-w-0 overflow-hidden bg-surface-container-low rounded-xl shadow-md p-4 h-fit lg:sticky lg:top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
                  {t('lectureEdit.chapters')}
                </h3>
                <button
                  onClick={() => {
                    setIsSearchOpen(!isSearchOpen);
                    if (isSearchOpen) {
                      setSearchQuery('');
                    }
                  }}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-on-surface-variant hover:text-on-surface"
                  aria-label={
                    isSearchOpen
                      ? t('globalSearch.closeSearch')
                      : t('globalSearch.openSearch')
                  }
                >
                  {isSearchOpen ? <X size={18} /> : <Search size={18} />}
                </button>
              </div>
              {isSearchOpen && (
                <div className="mb-3">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('lectureTrain.searchChapters')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-on-surface"
                  />
                </div>
              )}
              <nav
                className={`space-y-1 ${sortedChapters.length > 10 ? 'max-h-96 overflow-y-auto' : ''}`}
              >
                {filteredChapters.length === 0 ? (
                  <p className="text-sm text-on-surface-variant italic px-3 py-2">
                    {t('lectureTrain.noChaptersFound')}
                  </p>
                ) : (
                  filteredChapters.map((chapter) => {
                    const originalIndex = sortedChapters.findIndex(
                      (c) => c.id === chapter.id,
                    );
                    return (
                      <button
                        key={chapter.id}
                        ref={(el) => {
                          if (el) {
                            chapterButtonsRef.current.set(originalIndex, el);
                          } else {
                            chapterButtonsRef.current.delete(originalIndex);
                          }
                        }}
                        onClick={() => navigate(`/train/${id}/${chapter.id}`)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          selectedChapterIndex === originalIndex
                            ? 'bg-primary-100 text-primary-700 font-medium'
                            : 'text-on-surface hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-sm wrap-break-words">
                          {chapter.order + 1}.{' '}
                          {(() => {
                            const firstQ = firstQuestionMap.get(chapter.id);
                            const displayText =
                              firstQ?.question || t('common.untitled');
                            return searchQuery.trim()
                              ? highlightMatches(displayText, searchQuery)
                              : displayText;
                          })()}
                          {annotatedChapterIds.has(chapter.id) ? (
                            <span className="ml-1">🦉</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                )}
              </nav>
            </div>

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
                      {currentChapterQuestions.map((question) => (
                        <Accordion
                          key={question.id}
                          title={question.question}
                          leftIcon={
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
                          }
                        >
                          {question.answer ? (
                            <div className="prose prose-lg max-w-none">
                              <ReactMarkdown>{question.answer}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-on-surface-variant italic">
                              {t('lectureTrain.noAnswerYet')}
                            </p>
                          )}
                        </Accordion>
                      ))}
                    </div>
                  ) : (
                    <p className="text-on-surface-variant italic">
                      {t('lectureTrain.noContentYet')}
                    </p>
                  )}

                  {/* Chapter Navigation */}
                  <div className="flex justify-between mt-12 pt-6 border-t border-gray-300">
                    <button
                      onClick={() =>
                        navigate(
                          `/train/${id}/${sortedChapters[selectedChapterIndex - 1].id}`,
                        )
                      }
                      disabled={selectedChapterIndex === 0}
                      className="px-4 py-2 text-primary-600 hover:bg-primary-50 disabled:text-gray-400 disabled:hover:bg-transparent rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                      {t('common.previous')}
                    </button>
                    <button
                      onClick={() =>
                        navigate(
                          `/train/${id}/${sortedChapters[selectedChapterIndex + 1].id}`,
                        )
                      }
                      disabled={selectedChapterIndex === sortedChapters.length - 1}
                      className="px-4 py-2 text-primary-600 hover:bg-primary-50 disabled:text-gray-400 disabled:hover:bg-transparent rounded-lg transition-colors flex items-center gap-2"
                    >
                      {t('common.next')}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
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
