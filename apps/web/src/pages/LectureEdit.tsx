import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { Accordion } from '../components/Accordion';
import { AppHeader } from '../components/AppHeader';
import { Card } from '../components/Card';
import {
  EditChapterModal,
  type EditingQuestion,
} from '../components/EditChapterModal';
import { MoveChapterModal } from '../components/MoveChapterModal';
import { Toast } from '../components/Toast';
import { IconButtonDelete } from '../components/buttons/IconButtonDelete';
import { IconButtonEdit } from '../components/buttons/IconButtonEdit';
import { IconButtonMove } from '../components/buttons/IconButtonMove';
import { trpc } from '../utils/trpc';

export const EditLecture = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState<string | null>(null);

  const [newChapterQuestion, setNewChapterQuestion] = useState('');
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [isCreatingNewChapter, setIsCreatingNewChapter] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState('');
  const [editingQuestions, setEditingQuestions] = useState<EditingQuestion[]>(
    [],
  );
  const [initialAssociation, setInitialAssociation] = useState('');
  const [initialQuestions, setInitialQuestions] = useState<EditingQuestion[]>(
    [],
  );
  const [movingChapter, setMovingChapter] = useState<Chapter | null>(null);
  const [isSavingChapter, setIsSavingChapter] = useState(false);

  // Auto-save state
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showReorderErrorToast, setShowReorderErrorToast] = useState(false);
  const savedChapterIdRef = useRef<string | null>(null);
  // Association used when the chapter row was persisted, so a manual save
  // can tell whether the association actually changed afterwards.
  const savedAssociationRef = useRef<string | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoSavingRef = useRef(false);
  // In-flight auto-save promise, resolving to the IDs of questions it created
  // (keyed by question order). A manual save awaits this to avoid duplicates.
  const autoSavePromiseRef = useRef<Promise<
    Map<number, string> | undefined
  > | null>(null);

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

  const createChapter = trpc.chapters.createChapter.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      utils.chapters.getDistinctAssociations.invalidate();
    },
  });

  const updateChapter = trpc.chapters.updateChapter.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      utils.chapters.getDistinctAssociations.invalidate();
    },
  });

  const createQuestion = trpc.questions.createQuestion.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      utils.questions.getQuestions.invalidate({
        chapterId: editingChapter?.id || '',
      });
      utils.questions.getFirstQuestionsByLecture.invalidate({ lectureId: id! });
    },
  });

  const updateQuestion = trpc.questions.updateQuestion.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      utils.questions.getQuestions.invalidate({
        chapterId: editingChapter?.id || '',
      });
      utils.questions.getFirstQuestionsByLecture.invalidate({ lectureId: id! });
    },
  });

  const deleteQuestion = trpc.questions.deleteQuestion.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      utils.questions.getQuestions.invalidate({
        chapterId: editingChapter?.id || '',
      });
      utils.questions.getFirstQuestionsByLecture.invalidate({ lectureId: id! });
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

  // Auto-save logic for questions - only called from handleAddQuestion
  const autoSaveQuestions = useCallback(async () => {
    if (!editingChapter || isAutoSavingRef.current) return;

    // Need at least one question with content to save
    const questionsWithContent = editingQuestions.filter((q) =>
      q.question.trim(),
    );
    if (questionsWithContent.length === 0) return;

    isAutoSavingRef.current = true;

    try {
      // Determine the chapter ID (reuse the ref if we already created this chapter)
      let chapterId = savedChapterIdRef.current || editingChapter.id;

      // If creating a new chapter and haven't saved it yet, create it first
      if (isCreatingNewChapter && !savedChapterIdRef.current) {
        const newChapter = await createChapter.mutateAsync({
          lectureId: editingChapter.lectureId,
          order: editingChapter.order,
          association: editingAssociation,
        });
        chapterId = newChapter.id;
        savedChapterIdRef.current = chapterId;
        savedAssociationRef.current = editingAssociation;
      }

      // IDs of questions created here, keyed by question order, so a manual
      // save running afterwards can skip recreating them.
      const createdQuestionIds = new Map<number, string>();

      // Collect all mutation promises
      const mutationPromises: Promise<unknown>[] = [];

      // Save questions - only new ones or modified existing ones
      for (const eq of editingQuestions) {
        if (!eq.question.trim()) continue; // Skip empty questions

        if (eq.id) {
          // Check if this existing question was actually modified
          const initial = initialQuestions.find((iq) => iq.id === eq.id);
          const wasModified =
            !initial ||
            initial.question !== eq.question ||
            initial.answer !== eq.answer;

          if (wasModified) {
            // Update existing question only if changed
            mutationPromises.push(
              updateQuestion.mutateAsync({
                id: eq.id,
                question: eq.question.trim(),
                answer: eq.answer,
                order: eq.order,
              }),
            );
          }
        } else {
          // Create new question and update local state with the returned ID
          mutationPromises.push(
            createQuestion
              .mutateAsync({
                chapterId: chapterId,
                question: eq.question.trim(),
                answer: eq.answer,
                order: eq.order,
              })
              .then((newQuestion) => {
                createdQuestionIds.set(eq.order, newQuestion.id);
                // Update the local question with its new ID
                setEditingQuestions((prev) =>
                  prev.map((q) =>
                    q.order === eq.order && !q.id
                      ? { ...q, id: newQuestion.id }
                      : q,
                  ),
                );
                // Also update initial questions to prevent isDirty issues
                setInitialQuestions((prev) =>
                  prev.map((q) =>
                    q.order === eq.order && !q.id
                      ? { ...q, id: newQuestion.id }
                      : q,
                  ),
                );
                return newQuestion;
              }),
          );
        }
      }

      // Wait for all mutations to complete
      await Promise.all(mutationPromises);

      // Only show toast and update state if we actually saved something
      if (mutationPromises.length > 0) {
        // Update initial questions to match current state (prevents isDirty issues)
        setInitialQuestions(
          editingQuestions.map((q) => ({
            ...q,
            // Preserve the ID if we just created it
          })),
        );

        // Show toast
        setShowSavedToast(true);
      }

      return createdQuestionIds;
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [
    editingChapter,
    editingQuestions,
    editingAssociation,
    isCreatingNewChapter,
    initialQuestions,
    createChapter,
    createQuestion,
    updateQuestion,
  ]);
  // Note: Auto-save is now triggered directly from handleAddQuestion, not on every change

  // Cleanup auto-save timeout when modal closes
  useEffect(() => {
    if (!editingChapter) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      savedChapterIdRef.current = null;
      savedAssociationRef.current = null;
      autoSavePromiseRef.current = null;
    }
  }, [editingChapter]);

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

    // Create a temporary chapter object (not saved to DB yet)
    const tempChapter: Chapter = {
      id: '', // Empty ID indicates a new chapter
      lectureId: id,
      order: maxOrder + 1,
      association: '',
    };

    // Open the modal for the new chapter
    setEditingChapter(tempChapter);
    setIsCreatingNewChapter(true);
    setEditingAssociation('');
    // Pre-populate with the entered question
    const newQuestion: EditingQuestion = {
      id: null,
      question: newChapterQuestion,
      answer: '',
      order: 0,
      isExpanded: true,
      showPreview: false,
    };
    setEditingQuestions([newQuestion]);
    setInitialAssociation('');
    setInitialQuestions([{ ...newQuestion }]);
    setNewChapterQuestion('');
  };

  const handleStartEdit = async (chapter: Chapter) => {
    setEditingChapter(chapter);
    setIsCreatingNewChapter(false);
    setEditingAssociation(chapter.association);
    setInitialAssociation(chapter.association);
    setEditingQuestions([]);
    setInitialQuestions([]);

    try {
      const questions = await utils.questions.getQuestions.fetch({
        chapterId: chapter.id,
      });
      if (questions.length > 0) {
        const mappedQuestions = questions.map((q, index) => ({
          id: q.id,
          question: q.question,
          answer: q.answer,
          order: q.order,
          isExpanded: index === 0,
          showPreview: false,
        }));
        setEditingQuestions(mappedQuestions);
        setInitialQuestions(mappedQuestions.map((q) => ({ ...q })));
      } else {
        const emptyQuestion: EditingQuestion = {
          id: null,
          question: '',
          answer: '',
          order: 0,
          isExpanded: true,
          showPreview: false,
        };
        setEditingQuestions([emptyQuestion]);
        setInitialQuestions([{ ...emptyQuestion }]);
      }
    } catch {
      const emptyQuestion: EditingQuestion = {
        id: null,
        question: '',
        answer: '',
        order: 0,
        isExpanded: true,
        showPreview: false,
      };
      setEditingQuestions([emptyQuestion]);
      setInitialQuestions([{ ...emptyQuestion }]);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingChapter) return;

    // Check that at least the first question has content
    const hasValidQuestion = editingQuestions.some((q) => q.question.trim());
    if (!hasValidQuestion) return;

    setIsSavingChapter(true);

    // Cancel an auto-save that is scheduled but has not started yet.
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    // Wait for any in-flight auto-save to finish so we don't recreate the
    // chapter or its questions. It reports the IDs of the questions it
    // created (keyed by order); merge them in so we update those rather
    // than create duplicates.
    let questionsToSave = editingQuestions;
    if (autoSavePromiseRef.current) {
      try {
        const createdIds = await autoSavePromiseRef.current;
        if (createdIds && createdIds.size > 0) {
          questionsToSave = editingQuestions.map((q) =>
            !q.id && createdIds.has(q.order)
              ? { ...q, id: createdIds.get(q.order)! }
              : q,
          );
        }
      } catch {
        // Auto-save failed; the manual save below recreates what's missing.
      }
    }

    let chapterId = savedChapterIdRef.current || editingChapter.id;

    // If creating a new chapter and it hasn't been auto-saved, save it first
    if (isCreatingNewChapter && !savedChapterIdRef.current) {
      const newChapter = await createChapter.mutateAsync({
        lectureId: editingChapter.lectureId,
        order: editingChapter.order,
        association: editingAssociation,
      });
      chapterId = newChapter.id;
      savedChapterIdRef.current = chapterId;
      savedAssociationRef.current = editingAssociation;
    }

    // Collect all mutation promises
    const mutationPromises: Promise<unknown>[] = [];

    // Update the chapter's association if it changed since the row was
    // persisted. A brand-new chapter is created with the current association,
    // so this only fires for an association edited after an earlier auto-save,
    // or for an existing chapter.
    const persistedAssociation = isCreatingNewChapter
      ? (savedAssociationRef.current ?? editingAssociation)
      : editingChapter.association;
    if (editingAssociation !== persistedAssociation) {
      mutationPromises.push(
        updateChapter.mutateAsync({
          id: chapterId,
          association: editingAssociation,
        }),
      );
    }

    // Save all questions
    for (const eq of questionsToSave) {
      if (!eq.question.trim()) continue; // Skip empty questions

      if (eq.id) {
        // Update existing question
        mutationPromises.push(
          updateQuestion.mutateAsync({
            id: eq.id,
            question: eq.question.trim(),
            answer: eq.answer,
            order: eq.order,
          }),
        );
      } else {
        // Create new question
        mutationPromises.push(
          createQuestion.mutateAsync({
            chapterId: chapterId,
            question: eq.question.trim(),
            answer: eq.answer,
            order: eq.order,
          }),
        );
      }
    }

    // Wait for all mutations to complete
    await Promise.all(mutationPromises);

    // Invalidate first question query for this chapter to update the list
    await utils.questions.getFirstQuestionsByLecture.invalidate({
      lectureId: id!,
    });

    // Close modal after saving
    handleCancelEdit();
  };

  const handleCancelEdit = () => {
    setEditingChapter(null);
    setIsCreatingNewChapter(false);
    setEditingAssociation('');
    setEditingQuestions([]);
    setIsSavingChapter(false);
  };

  const handleAddQuestion = () => {
    const maxOrder =
      editingQuestions.length > 0
        ? Math.max(...editingQuestions.map((q) => q.order))
        : -1;
    setEditingQuestions([
      ...editingQuestions.map((q) => ({ ...q, isExpanded: false })), // Collapse others
      {
        id: null,
        question: '',
        answer: '',
        order: maxOrder + 1,
        isExpanded: true,
        showPreview: false,
      },
    ]);

    // Trigger auto-save after adding question (with small delay to let state
    // update). Track the timeout and resulting promise so a manual save can
    // cancel a pending run or await an in-flight one.
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      autoSavePromiseRef.current = autoSaveQuestions();
    }, 100);
  };

  const handleUpdateEditingQuestion = (
    index: number,
    updates: Partial<EditingQuestion>,
  ) => {
    setEditingQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q)),
    );
  };

  const handleToggleQuestionExpanded = (index: number) => {
    setEditingQuestions((prev) =>
      prev.map((q, i) => ({
        ...q,
        isExpanded: i === index ? !q.isExpanded : false,
      })),
    );
  };

  const handleDeleteEditingQuestion = (index: number) => {
    const question = editingQuestions[index];
    if (question.id) {
      // Delete from database
      deleteQuestion.mutate({ id: question.id });
    }
    // Remove from local state
    setEditingQuestions((prev) => prev.filter((_, i) => i !== index));
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
                disabled={createChapter.isPending || !newChapterQuestion.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-on-primary font-medium rounded-lg transition-colors"
              >
                {createChapter.isPending
                  ? t('lectureEdit.adding')
                  : t('common.add')}
              </button>
            </form>

            {createChapter.error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 border border-red-200">
                <p className="text-sm text-error">
                  Error: {createChapter.error.message}
                </p>
              </div>
            )}

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
                            onClick={() => handleStartEdit(chapter)}
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
        {editingChapter && (
          <EditChapterModal
            association={editingAssociation}
            questions={editingQuestions}
            isSaving={isSavingChapter}
            existingAssociations={existingAssociations}
            initialAssociation={initialAssociation}
            initialQuestions={initialQuestions}
            onAssociationChange={setEditingAssociation}
            onAddQuestion={handleAddQuestion}
            onUpdateQuestion={handleUpdateEditingQuestion}
            onToggleQuestionExpanded={handleToggleQuestionExpanded}
            onDeleteQuestion={handleDeleteEditingQuestion}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
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
