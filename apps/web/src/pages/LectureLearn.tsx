import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { BackButton } from '../components/buttons/BackButton';
import { useChapterVoicePlayback } from '../hooks/useChapterVoicePlayback';
import { highlightText } from '../utils/highlightText';
import { trpc } from '../utils/trpc';

export const LectureLearn = () => {
  const { t, i18n } = useTranslation();
  const { id, chapterId } = useParams<{ id: string; chapterId?: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // Hands-free preference: continue voice playback into the next chapter.
  // Storage access is guarded — private mode / disabled storage must not crash
  // the page; the preference simply falls back to session-only in that case.
  const [autoAdvance, setAutoAdvance] = useState(() => {
    try {
      return localStorage.getItem('learnAutoAdvance') === 'true';
    } catch {
      return false;
    }
  });
  // Set when an auto-advance navigation happens so the next chapter resumes
  // playback once its questions have loaded.
  const [pendingAutoStart, setPendingAutoStart] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chapterButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const questionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

  const handleAutoAdvanceChange = (checked: boolean) => {
    setAutoAdvance(checked);
    try {
      localStorage.setItem('learnAutoAdvance', String(checked));
    } catch {
      // Storage unavailable — the preference stays in memory for this session.
    }
  };

  // Navigate to a chapter on explicit user intent. Clears any pending
  // auto-start so a manual jump never triggers a surprise resume.
  const goToChapter = useCallback(
    (index: number) => {
      if (index < 0 || index >= chapters.length) return;
      setPendingAutoStart(false);
      navigate(`/learn/${id}/${chapters[index].id}`);
    },
    [chapters, id, navigate],
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

  // Derive selected chapter index from URL chapterId parameter
  const selectedChapterIndex = useMemo(() => {
    if (chapters.length > 0 && chapterId) {
      const index = chapters.findIndex((c) => c.id === chapterId);
      if (index !== -1) return index;
    }
    return 0;
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
        goToChapter(selectedChapterIndex + 1);
      } else if (event.key === 'ArrowLeft') {
        goToChapter(selectedChapterIndex - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChapterIndex, goToChapter]);

  // Fetch all questions for the current chapter
  const currentChapter = chapters[selectedChapterIndex];
  const currentChapterQuestionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: currentChapter?.id || '' },
    { enabled: !!currentChapter?.id },
  );
  const currentChapterQuestions = useMemo(
    () => currentChapterQuestionsQuery.data || [],
    [currentChapterQuestionsQuery.data],
  );

  // Hands-free auto-play of the current chapter.
  const speechConfigured = trpc.speech.isConfigured.useQuery().data ?? false;
  const voice = useChapterVoicePlayback({
    questions: currentChapterQuestions,
    language: (i18n.resolvedLanguage ?? i18n.language).startsWith('de')
      ? 'de'
      : 'en',
    enabled: speechConfigured,
    chapterId: currentChapter?.id,
  });

  // Keep the question being spoken in view.
  const voiceIndex = voice.currentQuestionIndex;
  useEffect(() => {
    if (voiceIndex === null) return;
    questionRefs.current
      .get(voiceIndex)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [voiceIndex]);

  // Auto-advance: when a chapter's playback finishes and the preference is on,
  // move to the next chapter and flag it to resume playback automatically.
  //
  // Two guards keep this from over-firing:
  //  - Edge detection (`prevVoiceStatusRef`): only the *transition* into
  //    `'finished'` advances. Re-running this effect because another
  //    dependency changed — e.g. the user flipping the auto-advance toggle
  //    while a chapter is already finished — must not trigger a navigation.
  //  - `pendingAutoStart`: navigation updates `selectedChapterIndex` one
  //    render before the voice hook resets `status` away from `'finished'`,
  //    so without it this effect could re-fire on a stale `'finished'` and
  //    navigate a second time, skipping a chapter.
  const voiceStatus = voice.status;
  const prevVoiceStatusRef = useRef(voiceStatus);
  useEffect(() => {
    const prevVoiceStatus = prevVoiceStatusRef.current;
    prevVoiceStatusRef.current = voiceStatus;
    if (voiceStatus !== 'finished' || prevVoiceStatus === 'finished') return;
    if (!autoAdvance || pendingAutoStart) return;
    const nextIndex = selectedChapterIndex + 1;
    if (nextIndex >= chapters.length) return;
    setPendingAutoStart(true);
    navigate(`/learn/${id}/${chapters[nextIndex].id}`);
  }, [
    voiceStatus,
    autoAdvance,
    pendingAutoStart,
    selectedChapterIndex,
    chapters,
    id,
    navigate,
  ]);

  // Auto-advance follow-up: once the freshly-navigated chapter has loaded its
  // questions, resume playback. Chapters with no questions are skipped.
  const voiceToggle = voice.toggle;
  const voiceIsActive = voice.isActive;
  const questionsLoading = currentChapterQuestionsQuery.isLoading;
  useEffect(() => {
    if (!pendingAutoStart) return;
    // The preference was switched off mid-flight — abandon the pending resume.
    if (!autoAdvance) {
      setPendingAutoStart(false);
      return;
    }
    // Playback became active (or errored) through another path — typically a
    // manual Play click in the brief window before this effect resumes. Drop
    // the pending flag so it cannot get stuck `true` and silently disable
    // auto-advance for the rest of the session.
    if (voiceIsActive || voiceStatus === 'error') {
      setPendingAutoStart(false);
      return;
    }
    if (voiceStatus !== 'idle' || questionsLoading) return;
    if (currentChapterQuestions.length > 0) {
      setPendingAutoStart(false);
      voiceToggle();
      return;
    }
    // Empty chapter — keep advancing until one has content or we run out.
    const nextIndex = selectedChapterIndex + 1;
    if (nextIndex < chapters.length) {
      navigate(`/learn/${id}/${chapters[nextIndex].id}`);
    } else {
      setPendingAutoStart(false);
    }
    // `voiceToggle` is deliberately excluded from the deps below: the voice
    // hook returns a fresh `toggle` identity on every render, so depending on
    // it would re-run this effect constantly. Its behavior is stable and it is
    // invoked exactly once per resume (right after `pendingAutoStart` is
    // cleared), so referencing a slightly stale closure is harmless here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingAutoStart,
    autoAdvance,
    voiceStatus,
    voiceIsActive,
    questionsLoading,
    currentChapterQuestions,
    selectedChapterIndex,
    chapters,
    id,
    navigate,
  ]);

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
            <div className="min-w-0 overflow-hidden bg-surface-container rounded-xl shadow-md p-8">
              {currentChapter ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-on-background">
                      {currentFirstQuestion?.question || t('common.untitled')}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {speechConfigured &&
                        currentChapterQuestions.length > 0 && (
                          <>
                            <VoicePlaybackButton
                              status={voice.status}
                              isActive={voice.isActive}
                              isPaused={voice.isPaused}
                              onToggle={voice.toggle}
                            />
                            <AutoAdvanceToggle
                              checked={autoAdvance}
                              onChange={handleAutoAdvanceChange}
                            />
                          </>
                        )}
                      {currentChapter.association && (
                        <span className="px-3 py-1 text-sm font-medium bg-primary-100 text-primary-700 rounded-full">
                          {currentChapter.association}
                        </span>
                      )}
                      <ChapterMenu chapter={currentChapter} lectureId={id!} />
                    </div>
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
                            if (el) questionRefs.current.set(index, el);
                            else questionRefs.current.delete(index);
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
