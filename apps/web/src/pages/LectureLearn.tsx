import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { Accordion } from '../components/Accordion';
import { AppHeader } from '../components/AppHeader';
import { AutoAdvanceToggle } from '../components/AutoAdvanceToggle';
import { ChapterMenu } from '../components/ChapterMenu';
import { ChapterSidebar } from '../components/ChapterSidebar';
import { ErrorState } from '../components/ErrorState';
import { LectureNavigation } from '../components/LectureNavigation';
import { LoadingState } from '../components/LoadingState';
import { VoicePlaybackButton } from '../components/VoicePlaybackButton';
import { useLectureVoicePlayback } from '../hooks/useLectureVoicePlayback';
import { highlightText } from '../utils/highlightText';
import { trpc } from '../utils/trpc';

export const LectureLearn = () => {
  const { t, i18n } = useTranslation();
  const { id, chapterId } = useParams<{ id: string; chapterId?: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chapterButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const questionElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

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

  // Chapter selection, its Questions and voice playback across Chapters.
  const voice = useLectureVoicePlayback({
    lectureId: id!,
    chapters,
    chapterId,
    language: (i18n.resolvedLanguage ?? i18n.language).startsWith('de')
      ? 'de'
      : 'en',
  });
  const {
    chapter: currentChapter,
    chapterIndex: selectedChapterIndex,
    questions: currentChapterQuestions,
    available: speechConfigured,
    selectChapter: goToChapter,
  } = voice;

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

  // Scroll selected chapter into view, and keep the focus ring from lingering
  // on a previously-selected entry. Selecting a chapter leaves DOM focus on its
  // sidebar button; keyboard navigation moves the active chapter via the URL
  // without moving focus, so the old button would keep its :focus-visible
  // outline. When a chapter button still holds focus, move it to the active
  // chapter so the outline tracks the highlight (never stealing focus from
  // other controls).
  useEffect(() => {
    const button = chapterButtonsRef.current.get(selectedChapterIndex);
    if (!button) return;
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const active = document.activeElement;
    const focusOnChapterButton =
      active instanceof HTMLButtonElement &&
      active !== button &&
      [...chapterButtonsRef.current.values()].includes(active);
    if (focusOnChapterButton) {
      button.focus({ preventScroll: true });
    }
  }, [selectedChapterIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger navigation if search is focused
      if (document.activeElement === searchInputRef.current) return;

      if (event.key === 'ArrowRight') {
        goToChapter(selectedChapterIndex + 1);
      } else if (event.key === 'ArrowLeft') {
        goToChapter(selectedChapterIndex - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChapterIndex, goToChapter]);

  // Keep the question being spoken in view.
  const voiceIndex = voice.currentQuestionIndex;
  useEffect(() => {
    if (voiceIndex === null) return;
    questionElementsRef.current
      .get(voiceIndex)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [voiceIndex]);

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
      <AppHeader back={{ to: '/', label: t('lectureTrain.backToLectures') }} />

      <main className="container mx-auto px-4 py-8 md:py-12">
        {/* Lecture Header */}
        <div className="mb-8">
          <Accordion title={lecture.title} description={lecture.description} />
        </div>

        {chapters.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl shadow-sm p-8 text-center">
            <p className="text-on-surface-variant mb-4">
              {t('lectureTrain.noChaptersYet')}
            </p>
            <button
              onClick={() => navigate(`/edit/${id}`)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-on-primary rounded-lg transition-colors"
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
                goToChapter(chapters.findIndex((c) => c.id === chapter.id))
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
            <div className="min-w-0 overflow-hidden bg-surface-container border border-border rounded-xl shadow-sm p-8">
              {currentChapter ? (
                <>
                  <div className="mb-6">
                    {/* Title row: keep it compact so it stays clean on narrow
                        screens — only the chapter pill, voice icon, and menu. */}
                    <div className="flex justify-between items-start gap-3">
                      <h2 className="text-2xl font-bold text-on-background">
                        {currentFirstQuestion?.question || t('common.untitled')}
                      </h2>
                      <div className="flex items-center gap-2 shrink-0">
                        {currentChapter.association && (
                          <span className="px-3 py-1 text-sm font-medium bg-accent-soft text-accent-soft-ink rounded-full">
                            {currentChapter.association}
                          </span>
                        )}
                        {speechConfigured &&
                          currentChapterQuestions.length > 0 && (
                            <VoicePlaybackButton
                              status={voice.status}
                              isActive={voice.isActive}
                              isPaused={voice.isPaused}
                              onToggle={voice.toggle}
                            />
                          )}
                        <ChapterMenu chapter={currentChapter} lectureId={id!} />
                      </div>
                    </div>

                    {/* Auto-advance gets its own row beneath the title so the
                        toggle never crowds the header on small screens. */}
                    {speechConfigured && currentChapterQuestions.length > 0 && (
                      <div className="mt-4">
                        <AutoAdvanceToggle
                          checked={voice.autoAdvance}
                          onChange={voice.setAutoAdvance}
                        />
                      </div>
                    )}
                  </div>

                  {/* Announces auto-play position and failures to screen readers. */}
                  <div className="sr-only" aria-live="polite">
                    {voice.status === 'error'
                      ? t('speech.autoPlayError')
                      : voice.currentQuestionIndex !== null &&
                        t('speech.autoPlayNowPlaying', {
                          current: voice.currentQuestionIndex + 1,
                          total: currentChapterQuestions.length,
                        })}
                  </div>

                  {currentChapterQuestions.length > 0 ? (
                    <div className="space-y-8">
                      {currentChapterQuestions.map((question, index) => (
                        <div
                          key={question.id}
                          ref={(el) => {
                            if (el) questionElementsRef.current.set(index, el);
                            else questionElementsRef.current.delete(index);
                          }}
                          aria-current={
                            voice.currentQuestionIndex === index
                              ? 'true'
                              : undefined
                          }
                          className={`${
                            index > 0 ? 'pt-8 border-t border-gray-200' : ''
                          } ${
                            voice.currentQuestionIndex === index
                              ? 'rounded-lg ring-2 ring-primary-300 bg-primary-50/40'
                              : ''
                          }`.trim()}
                        >
                          {index > 0 && (
                            <h2 className="text-2xl font-bold text-on-background mb-4">
                              {question.question}
                            </h2>
                          )}
                          {question.answer ? (
                            <div className="prose prose-lg dark:prose-invert max-w-none">
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
                    onPrev={() => goToChapter(selectedChapterIndex - 1)}
                    onNext={() => goToChapter(selectedChapterIndex + 1)}
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
