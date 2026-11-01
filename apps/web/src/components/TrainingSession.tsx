import { type TFunction } from 'i18next';
import { Check, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type TrainingMode,
  filterChaptersByQuestionText,
} from '@athena/domain/training';

import {
  type TrainingSession as Session,
  useTrainingSession,
} from '../hooks/useTrainingSession';
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
}

interface TrainingSessionContentProps extends TrainingSessionProps {
  lecture: { id: string; title: string; description: string | null };
}

const TrainingSessionContent = ({
  lectureId,
  chapterId,
  questionId,
  mode,
  lecture,
}: TrainingSessionContentProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const flipTimersRef = useRef<number[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chapterButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());

  const clearFlipTimers = useCallback(() => {
    flipTimersRef.current.forEach((id) => window.clearTimeout(id));
    flipTimersRef.current = [];
  }, []);

  const flip = useCallback(() => {
    if (flipping) return;
    setFlipping(true);
    flipTimersRef.current.push(
      window.setTimeout(() => setFlipped((f) => !f), 190),
      window.setTimeout(() => setFlipping(false), 410),
    );
  }, [flipping]);

  const session = useTrainingSession({
    lectureId,
    mode,
    chapterId,
    questionId,
  });
  const {
    chapters: sortedChapters,
    chapterIndex: selectedChapterIndex,
    chapter: currentChapter,
    questions: currentChapterQuestions,
    questionIndex: selectedQuestionIndex,
    isFirst: isFirstQuestion,
    isLast: isLastQuestion,
    next: handleNextQuestion,
    previous: handlePrevQuestion,
    progress,
    firstQuestionText,
  } = session;

  const filteredChapters = useMemo(
    () =>
      filterChaptersByQuestionText(
        sortedChapters,
        searchQuery,
        (chapter) => firstQuestionText(chapter.id) || '',
      ),
    [sortedChapters, searchQuery, firstQuestionText],
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

  const currentQuestionId = session.question?.id;

  // Reset the flip state whenever the active question changes. Sidebar clicks,
  // arrow navigation and the __last__ replace-redirect can all switch questions
  // outside the flip-button path, so this guards every transition. We adjust
  // state during render (React's recommended pattern) instead of in an effect
  // so the reset is applied before paint. The previous id lives in state, not
  // a ref: navigations render as transitions, and an interrupted render that
  // had already written a ref would skip the reset when it restarts, leaving
  // the next card on its answer side.
  const [flipQuestionId, setFlipQuestionId] = useState(currentQuestionId);
  if (flipQuestionId !== currentQuestionId) {
    setFlipQuestionId(currentQuestionId);
    setFlipped(false);
    setFlipping(false);
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
    isFirstQuestion,
    isLastQuestion,
    handleNextQuestion,
    handlePrevQuestion,
    flip,
  ]);

  if (session.status === 'loading' && sortedChapters.length === 0) {
    return <LoadingState />;
  }

  const notice = sessionNotice(session, t);

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

        {sortedChapters.length === 0 && session.status !== 'empty' ? (
          notice
        ) : sortedChapters.length === 0 ? (
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
              onSelect={session.selectChapter}
              isSearchOpen={isSearchOpen}
              onSearchToggle={() => setIsSearchOpen(!isSearchOpen)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              getDisplayText={(chapter) => {
                const displayText =
                  firstQuestionText(chapter.id) || t('common.untitled');
                return highlightText(displayText, searchQuery);
              }}
              highlightedChapterIds={session.annotatedChapterIds}
              searchInputRef={searchInputRef}
              chapterButtonsRef={chapterButtonsRef}
            />

            <div className="min-w-0">
              {notice ??
                (() => {
                  const question = session.question;
                  if (!question || !currentChapter) return null;
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

                      {!!progress.total && (
                        <ProgressBar
                          current={progress.position}
                          total={progress.total}
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
                              onClick={session.toggleAnnotated}
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
                            onClick={session.reviewAgain}
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
                })()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

interface NoticeAction {
  label: string;
  onClick: () => void;
}

const Notice = ({
  message,
  actions = [],
  italic = false,
}: {
  message: string;
  actions?: NoticeAction[];
  italic?: boolean;
}) => (
  <div role="status">
    <p className={`text-on-surface-variant${italic ? ' italic' : ''}`}>
      {message}
    </p>
    {actions.length > 0 && (
      <div className="flex flex-wrap gap-3 mt-4">
        {actions.map(({ label, onClick }) => (
          <Button key={label} variant="secondary" onClick={onClick}>
            {label}
          </Button>
        ))}
      </div>
    )}
  </div>
);

/** What the main pane shows instead of a card, or `null` when ready. */
function sessionNotice(session: Session, t: TFunction) {
  switch (session.status) {
    case 'ready':
      return null;
    case 'loading':
      return <Notice message={t('common.loading')} />;
    case 'empty':
      return <Notice message={t('lectureTrain.noContentYet')} italic />;
    case 'error':
      return (
        <Notice
          message={t('lectureTrain.loadFailed')}
          actions={[{ label: t('common.retry'), onClick: session.retry }]}
        />
      );
    case 'not-found': {
      const chapterMissing = session.notFound === 'chapter';
      return (
        <Notice
          message={t(
            chapterMissing
              ? 'lectureTrain.chapterNotFound'
              : 'lectureTrain.questionNotFound',
          )}
          actions={[
            ...(session.canGoBack
              ? [{ label: t('common.back'), onClick: session.goBack }]
              : []),
            {
              label: t(
                chapterMissing
                  ? 'lectureTrain.goToFirstChapter'
                  : 'lectureTrain.goToChapterStart',
              ),
              onClick: session.goToCanonical,
            },
          ]}
        />
      );
    }
  }
}

export const TrainingSession = ({
  lectureId,
  chapterId,
  questionId,
  mode,
}: TrainingSessionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const lectureQuery = trpc.lectures.getLecture.useQuery(
    { id: lectureId },
    { enabled: !!lectureId },
  );

  if (lectureQuery.isLoading) {
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
      lecture={lectureQuery.data}
    />
  );
};
