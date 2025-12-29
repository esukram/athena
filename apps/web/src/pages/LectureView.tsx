import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';

import { trpc } from '../utils/trpc';
import { AppHeader } from '../components/AppHeader';
import { ChapterMenu } from '../components/ChapterMenu';
import { Accordion } from '../components/Accordion';

export const LectureView = () => {
  const { id, chapterId } = useParams<{ id: string; chapterId?: string }>();
  const navigate = useNavigate();
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chapterButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  const lectureQuery = trpc.lectures.getLecture.useQuery({ id: id! }, { enabled: !!id });

  const chaptersQuery = trpc.chapters.getChapters.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  const chapters = chaptersQuery.data || [];

  // Set selected chapter based on URL chapterId parameter
  useEffect(() => {
    if (chapterId && chapters.length > 0) {
      const index = chapters.findIndex((c) => c.id === chapterId);
      if (index !== -1) {
        setSelectedChapterIndex(index);
      }
    }
  }, [chapterId, chapters]);

  // Tokenized search filter
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return chapters.filter((chapter) => {
      const title = chapter.title.toLowerCase();
      return tokens.every((token) => title.includes(token));
    });
  }, [chapters, searchQuery]);

  // Highlight matching tokens in text
  const highlightMatches = (text: string, query: string) => {
    if (!query.trim()) return text;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return text;

    // Build a regex to match any of the tokens (case-insensitive)
    const escapedTokens = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');

    const parts = text.split(regex);
    return parts.map((part, index) => {
      const isMatch = tokens.some((token) => part.toLowerCase() === token);
      if (isMatch) {
        return (
          <mark key={index} className="bg-yellow-200 text-inherit rounded px-0.5">
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
      if (event.key === 'ArrowRight') {
        setSelectedChapterIndex((prev) =>
          prev < chapters.length - 1 ? prev + 1 : prev,
        );
      } else if (event.key === 'ArrowLeft') {
        setSelectedChapterIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chapters.length]);

  if (lectureQuery.isLoading || chaptersQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <p className="text-on-surface-variant">Loading...</p>
        </main>
      </div>
    );
  }

  if (!lectureQuery.data) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <p className="text-error">Lecture not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
          >
            Back to Overview
          </button>
        </main>
      </div>
    );
  }

  const lecture = lectureQuery.data;
  const currentChapter = chapters[selectedChapterIndex];

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
            Back to Lectures
          </button>
          <Accordion title={lecture.title} description={lecture.description} />
        </div>

        {chapters.length === 0 ? (
          <div className="bg-surface rounded-xl shadow-md p-8 text-center">
            <p className="text-on-surface-variant mb-4">
              This lecture has no chapters yet.
            </p>
            <button
              onClick={() => navigate(`/edit-lecture/${id}`)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Add Chapters
            </button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            {/* Chapter Navigation */}
            <div className="bg-surface-container-low rounded-xl shadow-md p-4 h-fit lg:sticky lg:top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
                  Chapters
                </h3>
                <button
                  onClick={() => {
                    setIsSearchOpen(!isSearchOpen);
                    if (isSearchOpen) {
                      setSearchQuery('');
                    }
                  }}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-on-surface-variant hover:text-on-surface"
                  aria-label={isSearchOpen ? 'Close search' : 'Search chapters'}
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
                    placeholder="Search chapters..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-on-surface"
                  />
                </div>
              )}
              <nav className={`space-y-1 ${chapters.length > 10 ? 'max-h-96 overflow-y-auto' : ''}`}>
                {filteredChapters.length === 0 ? (
                  <p className="text-sm text-on-surface-variant italic px-3 py-2">
                    No chapters found
                  </p>
                ) : (
                  filteredChapters.map((chapter) => {
                    const originalIndex = chapters.findIndex((c) => c.id === chapter.id);
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
                        onClick={() => setSelectedChapterIndex(originalIndex)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          selectedChapterIndex === originalIndex
                            ? 'bg-primary-100 text-primary-700 font-medium'
                            : 'text-on-surface hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-sm">
                          {chapter.order + 1}.{' '}
                          {searchQuery.trim() ? (
                            highlightMatches(chapter.title, searchQuery)
                          ) : (
                            chapter.title
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </nav>
            </div>

            {/* Chapter Content */}
            <div className="bg-surface-container rounded-xl shadow-md p-8">
              {currentChapter ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-on-background">
                      {currentChapter.title}
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
                  {currentChapter.body ? (
                    <div className="prose prose-lg max-w-none">
                      <ReactMarkdown>{currentChapter.body}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-on-surface-variant italic">
                      This chapter has no content yet.
                    </p>
                  )}

                  {/* Chapter Navigation */}
                  <div className="flex justify-between mt-12 pt-6 border-t border-gray-300">
                    <button
                      onClick={() =>
                        setSelectedChapterIndex(selectedChapterIndex - 1)
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
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setSelectedChapterIndex(selectedChapterIndex + 1)
                      }
                      disabled={selectedChapterIndex === chapters.length - 1}
                      className="px-4 py-2 text-primary-600 hover:bg-primary-50 disabled:text-gray-400 disabled:hover:bg-transparent rounded-lg transition-colors flex items-center gap-2"
                    >
                      Next
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
                <p className="text-on-surface-variant">Select a chapter</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
