import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';

import { useEffect, useState } from 'react';

import { trpc } from '../utils/trpc';
import { AppHeader } from '../components/AppHeader';
import { ChapterMenu } from '../components/ChapterMenu';

export const LectureView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);

  const lectureQuery = trpc.lectures.getLecture.useQuery({ id: id! }, { enabled: !!id });

  const chaptersQuery = trpc.chapters.getChapters.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  const chapters = chaptersQuery.data || [];

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
          <h1 className="text-4xl font-bold text-on-background mb-2">
            {lecture.title}
          </h1>
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
              <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-4">
                Chapters
              </h3>
              <nav className={`space-y-1 ${chapters.length > 10 ? 'max-h-96 overflow-y-auto' : ''}`}>
                {chapters.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    onClick={() => setSelectedChapterIndex(index)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedChapterIndex === index
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-on-surface hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm">
                      {chapter.order + 1}. {chapter.title}
                    </span>
                  </button>
                ))}
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
