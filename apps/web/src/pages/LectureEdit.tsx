import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { Accordion } from '../components/Accordion';
import { AppHeader } from '../components/AppHeader';
import { Card } from '../components/Card';
import { EditChapterModal } from '../components/EditChapterModal';
import { MoveChapterModal } from '../components/MoveChapterModal';
import { Toast } from '../components/Toast';
import { IconButtonDelete } from '../components/buttons/IconButtonDelete';
import { IconButtonEdit } from '../components/buttons/IconButtonEdit';
import { IconButtonMove } from '../components/buttons/IconButtonMove';
import { useChapterEditor } from '../hooks/useChapterEditor';
import { trpc } from '../utils/trpc';

export const EditLecture = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState<string | null>(null);

  const [newChapterQuestion, setNewChapterQuestion] = useState('');
  const [movingChapter, setMovingChapter] = useState<Chapter | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showReorderErrorToast, setShowReorderErrorToast] = useState(false);
  const chapterEditor = useChapterEditor({
    lectureId: id!,
    onAutoSaved: () => setShowSavedToast(true),
  });

  const lectureQuery = trpc.lectures.getLecture.useQuery(
    { id: id! },
    {
      enabled: !!id,
    },
  );

  const title = draftTitle ?? lectureQuery.data?.title ?? '';
  const description = draftDescription ?? lectureQuery.data?.description ?? '';

  const chaptersQuery = trpc.chapters.getChapters.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  // Fetch distinct associations for autocomplete
  const associationsQuery = trpc.chapters.getDistinctAssociations.useQuery();
  const existingAssociations = associationsQuery.data || [];

  const chapters = chaptersQuery.data || [];

  // Fetch all first questions for this lecture in a single call
  const firstQuestionsQuery =
    trpc.questions.getFirstQuestionsByLecture.useQuery(
      { lectureId: id! },
      { enabled: !!id },
    );

  // Build a map of chapterId -> firstQuestion
  const firstQuestionMap = new Map<string, Question | undefined>();
  if (firstQuestionsQuery.data) {
    for (const [chapterId, question] of Object.entries(
      firstQuestionsQuery.data,
    )) {
      firstQuestionMap.set(chapterId, question);
    }
  }

  const updateLecture = trpc.lectures.updateLecture.useMutation({
    onSuccess: () => {
      utils.lectures.getLectures.invalidate();
      utils.lectures.getLecture.invalidate({ id: id! });
    },
  });

  const deleteChapter = trpc.chapters.deleteChapter.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
    },
  });

  const moveChapter = trpc.chapters.moveChapter.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      setMovingChapter(null);
    },
  });

  const reorderChapter = trpc.chapters.reorderChapter.useMutation({
    onError: () => setShowReorderErrorToast(true),
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
    },
  });

  // Fetch all lectures for the move chapter modal
  const lecturesQuery = trpc.lectures.getLectures.useQuery();

  const handleUpdateLecture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    updateLecture.mutate({ id, title, description });
  };

  const handleAddChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newChapterQuestion.trim()) return;

    // Calculate the next order number for the new chapter
    const chapters = chaptersQuery.data || [];
    const maxOrder =
      chapters.length > 0 ? Math.max(...chapters.map((c) => c.order)) : -1;

    // A new Chapter is only persisted once the editor saves it.
    chapterEditor.openNew(maxOrder + 1, newChapterQuestion);
    setNewChapterQuestion('');
  };

  const handleDeleteChapter = (chapterId: string) => {
    if (confirm(t('lectureEdit.confirmDeleteChapter'))) {
      deleteChapter.mutate({ id: chapterId });
    }
  };

  if (lectureQuery.isLoading) {
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
            className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-on-primary hover:bg-primary-700"
          >
            {t('lectureEdit.backToOverview')}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <Accordion title={title} description={description}>
            <form onSubmit={handleUpdateLecture} className="space-y-6">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-on-surface mb-2"
                >
                  {t('lectureAdd.titleLabel')}
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                  placeholder={t('lectureAdd.titlePlaceholder')}
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-on-surface mb-2"
                >
                  {t('lectureAdd.descriptionLabel')}
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors resize-none"
                  placeholder={t('lectureAdd.descriptionPlaceholder')}
                />
              </div>

              {updateLecture.error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 border border-red-200">
                  <p className="text-sm text-error">
                    Error: {updateLecture.error.message}
                  </p>
                </div>
              )}

              {updateLecture.isSuccess && (
                <div className="rounded-lg bg-green-50 px-4 py-3 border border-green-200">
                  <p className="text-sm text-green-700">
                    {t('lectureEdit.savedSuccessfully')}
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={updateLecture.isPending}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-on-primary font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {updateLecture.isPending
                    ? t('lectureEdit.saving')
                    : t('lectureEdit.saveChanges')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="px-6 py-3 rounded-lg bg-surface border border-border text-on-surface hover:bg-bg-tint transition-colors"
                >
                  {t('common.back')}
                </button>
              </div>
            </form>
          </Accordion>
        </div>

        <div className="grid gap-8">
          {/* Chapters Section */}
          <Card className="space-y-6">
            <h3 className="text-xl font-semibold text-on-surface">
              {t('lectureEdit.chapters')}
            </h3>

            {/* Add Chapter Form */}
            <form onSubmit={handleAddChapter} className="flex gap-3">
              <input
                type="text"
                value={newChapterQuestion}
                onChange={(e) => setNewChapterQuestion(e.target.value)}
                placeholder={t('lectureEdit.newChapterQuestion')}
                className="flex-1 px-4 py-2 rounded-lg bg-surface border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!newChapterQuestion.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-on-primary font-medium rounded-lg transition-colors"
              >
                {t('common.add')}
              </button>
            </form>

            {/* Chapters List */}
            <div className="space-y-3">
              {chaptersQuery.isLoading || firstQuestionsQuery.isLoading ? (
                <p className="text-on-surface-variant">
                  {t('lectureEdit.loadingChapters')}
                </p>
              ) : chapters.length === 0 ? (
                <p className="text-on-surface-variant text-center py-8">
                  {t('lectureEdit.noChaptersYet')}
                </p>
              ) : (
                (() => {
                  const sortedChapters = [...chapters].sort(
                    (a, b) => a.order - b.order,
                  );

                  return sortedChapters.map((chapter, index) => {
                    const firstQuestion = firstQuestionMap.get(chapter.id);
                    const isFirst = index === 0;
                    const isLast = index === sortedChapters.length - 1;
                    const totalChapters = sortedChapters.length;

                    const handleMoveUp = () => {
                      if (!isFirst) {
                        const targetChapter = sortedChapters[index - 1];
                        reorderChapter.mutate({
                          chapterId: chapter.id,
                          lectureId: id!,
                          newOrder: targetChapter.order,
                        });
                      }
                    };

                    const handleMoveDown = () => {
                      if (!isLast) {
                        const targetChapter = sortedChapters[index + 1];
                        reorderChapter.mutate({
                          chapterId: chapter.id,
                          lectureId: id!,
                          newOrder: targetChapter.order,
                        });
                      }
                    };

                    const handleReorderTo = (targetIndex: number) => {
                      if (targetIndex !== index) {
                        const targetChapter = sortedChapters[targetIndex];
                        reorderChapter.mutate({
                          chapterId: chapter.id,
                          lectureId: id!,
                          newOrder: targetChapter.order,
                        });
                      }
                    };

                    const getPositionLabel = (order: number) => {
                      return String(order + 1);
                    };

                    return (
                      <div
                        key={chapter.id}
                        className="p-3 sm:p-4 bg-bg-tint rounded-lg border border-border grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 sm:gap-3">
                            {/* Position dropdown */}
                            <select
                              value={index}
                              onChange={(e) =>
                                handleReorderTo(Number(e.target.value))
                              }
                              disabled={reorderChapter.isPending}
                              className="shrink-0 w-12 sm:w-14 px-1.5 sm:px-2 py-1 sm:py-1.5 text-sm bg-surface border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors disabled:opacity-50"
                              aria-label="Chapter position"
                            >
                              {Array.from({ length: totalChapters }, (_, i) => (
                                <option key={i} value={i}>
                                  {getPositionLabel(i)}
                                </option>
                              ))}
                            </select>

                            <span className="flex-1 text-on-surface font-medium text-sm sm:text-base line-clamp-2 sm:line-clamp-none">
                              {firstQuestion?.question || t('common.untitled')}
                            </span>
                          </div>
                          {firstQuestion?.answer && (
                            <div className="mt-3 pl-11 text-sm text-ink-faint truncate hidden sm:block">
                              {firstQuestion.answer.substring(0, 100)}
                              {firstQuestion.answer.length > 100 && '...'}
                            </div>
                          )}
                        </div>

                        {/* Chapter action icons */}
                        <div className="flex gap-1 sm:gap-2 shrink-0">
                          <IconButtonEdit
                            onClick={() => chapterEditor.openExisting(chapter)}
                            aria-label={t('lectureEdit.editChapter')}
                          />
                          <IconButtonMove
                            onClick={() => setMovingChapter(chapter)}
                            aria-label={t('lectureEdit.moveChapterTooltip')}
                          />
                          <IconButtonDelete
                            onClick={() => handleDeleteChapter(chapter.id)}
                            disabled={deleteChapter.isPending}
                            aria-label={t('lectureEdit.deleteChapter')}
                          />
                        </div>

                        {/* Reorder controls - Centered vertically */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={handleMoveUp}
                            disabled={isFirst || reorderChapter.isPending}
                            className="p-1 text-ink-faint hover:text-primary-600 hover:bg-primary-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label={t('lectureEdit.moveUp')}
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            onClick={handleMoveDown}
                            disabled={isLast || reorderChapter.isPending}
                            className="p-1 text-ink-faint hover:text-primary-600 hover:bg-primary-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label={t('lectureEdit.moveDown')}
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </Card>
        </div>

        {/* Chapter Edit Modal */}
        {chapterEditor.edit && (
          <EditChapterModal
            edit={chapterEditor.edit}
            existingAssociations={existingAssociations}
          />
        )}

        {/* Move Chapter Modal */}
        {movingChapter && (
          <MoveChapterModal
            currentLectureId={id!}
            lectures={lecturesQuery.data || []}
            isMoving={moveChapter.isPending}
            onMove={(targetLectureId) =>
              moveChapter.mutate({
                chapterId: movingChapter.id,
                targetLectureId,
              })
            }
            onCancel={() => setMovingChapter(null)}
          />
        )}

        {/* Auto-save Toast */}
        <Toast
          message={t('editChapterModal.autoSaved')}
          visible={showSavedToast}
          onDismiss={() => setShowSavedToast(false)}
        />

        <Toast
          message={t('lectureEdit.reorderFailed')}
          variant="error"
          visible={showReorderErrorToast}
          onDismiss={() => setShowReorderErrorToast(false)}
        />
      </main>
    </div>
  );
};
