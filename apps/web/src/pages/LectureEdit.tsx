import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useEffect, useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { Accordion } from '../components/Accordion';
import { AppHeader } from '../components/AppHeader';
import { Card } from '../components/Card';
import {
  EditChapterModal,
  type EditingQuestion,
} from '../components/EditChapterModal';
import { trpc } from '../utils/trpc';

export const EditLecture = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const [newChapterQuestion, setNewChapterQuestion] = useState('');
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [isCreatingNewChapter, setIsCreatingNewChapter] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState('');
  const [editingQuestions, setEditingQuestions] = useState<EditingQuestion[]>(
    [],
  );

  // Fetch questions for the editing chapter (only for existing chapters)
  const chapterQuestionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: editingChapter?.id || '' },
    { enabled: !!editingChapter?.id && !isCreatingNewChapter },
  );

  // Sync fetched questions to editing state when modal opens (only for existing chapters)
  useEffect(() => {
    // Skip for new chapters - they're pre-populated in handleAddChapter
    if (isCreatingNewChapter) return;

    if (editingChapter && chapterQuestionsQuery.data !== undefined) {
      const questions = chapterQuestionsQuery.data;
      if (questions.length > 0) {
        // Load existing questions from database
        setEditingQuestions(
          questions.map((q, index) => ({
            id: q.id,
            question: q.question,
            answer: q.answer,
            order: q.order,
            isExpanded: index === 0, // First question expanded by default
            showPreview: false,
          })),
        );
      } else if (editingQuestions.length === 0) {
        // No questions in DB and none set locally (existing chapter with no questions)
        setEditingQuestions([
          {
            id: null,
            question: '',
            answer: '',
            order: 0,
            isExpanded: true,
            showPreview: false,
          },
        ]);
      }
    }
  }, [editingChapter?.id, chapterQuestionsQuery.data, isCreatingNewChapter]);

  const lectureQuery = trpc.lectures.getLecture.useQuery(
    { id: id! },
    {
      enabled: !!id,
      onSuccess: (data) => {
        if (data && !isInitialized) {
          setTitle(data.title);
          setDescription(data.description);
          setIsInitialized(true);
        }
      },
    },
  );

  const chaptersQuery = trpc.chapters.getChapters.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  // Fetch distinct associations for autocomplete
  const associationsQuery = trpc.chapters.getDistinctAssociations.useQuery();
  const existingAssociations = associationsQuery.data || [];

  const chapters = chaptersQuery.data || [];

  // Fetch all first questions for this lecture in a single call
  const firstQuestionsQuery = trpc.questions.getFirstQuestionsByLecture.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  // Build a map of chapterId -> firstQuestion
  const firstQuestionMap = new Map<string, Question | undefined>();
  if (firstQuestionsQuery.data) {
    for (const [chapterId, question] of Object.entries(firstQuestionsQuery.data)) {
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
    },
  });

  const updateChapter = trpc.chapters.updateChapter.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
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
    setEditingQuestions([
      {
        id: null,
        question: newChapterQuestion,
        answer: '',
        order: 0,
        isExpanded: true,
        showPreview: false,
      },
    ]);
    setNewChapterQuestion('');
  };

  const handleStartEdit = async (chapter: Chapter) => {
    setEditingChapter(chapter);
    setIsCreatingNewChapter(false); // Ensure we're in edit mode, not create mode
    setEditingAssociation(chapter.association);
    setEditingQuestions([]); // Will be populated by useEffect when query loads
  };

  const handleSaveEdit = async () => {
    if (!editingChapter) return;

    // Check that at least the first question has content
    const hasValidQuestion = editingQuestions.some((q) => q.question.trim());
    if (!hasValidQuestion) return;

    let chapterId = editingChapter.id;

    // If creating a new chapter, save it to the database first
    if (isCreatingNewChapter) {
      const newChapter = await createChapter.mutateAsync({
        lectureId: editingChapter.lectureId,
        order: editingChapter.order,
        association: editingAssociation,
      });
      chapterId = newChapter.id;
    } else {
      // Update chapter association if changed (only for existing chapters)
      if (editingAssociation !== editingChapter.association) {
        updateChapter.mutate({
          id: chapterId,
          association: editingAssociation,
        });
      }
    }

    // Collect all mutation promises
    const mutationPromises: Promise<unknown>[] = [];

    // Save all questions
    for (const eq of editingQuestions) {
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
    await utils.questions.getFirstQuestionsByLecture.invalidate({ lectureId: id! });

    // Close modal after saving
    handleCancelEdit();
  };

  const handleCancelEdit = () => {
    setEditingChapter(null);
    setIsCreatingNewChapter(false);
    setEditingAssociation('');
    setEditingQuestions([]);
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
            className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
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
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
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
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors resize-none"
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
                  disabled={updateLecture.isLoading}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {updateLecture.isLoading
                    ? t('lectureEdit.saving')
                    : t('lectureEdit.saveChanges')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="px-6 py-3 rounded-lg border border-gray-300 text-on-surface hover:bg-gray-50 transition-colors"
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
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={createChapter.isLoading || !newChapterQuestion.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
              >
                {createChapter.isLoading
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
                chapters.map((chapter) => {
                  const firstQuestion = firstQuestionMap.get(chapter.id);
                  return (
                    <div
                      key={chapter.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-700 font-semibold rounded-full text-sm">
                          {chapter.order + 1}
                        </span>
                        <span className="flex-1 text-on-surface font-medium">
                          {firstQuestion?.question || t('common.untitled')}
                        </span>
                        <button
                          onClick={() => handleStartEdit(chapter)}
                          className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDeleteChapter(chapter.id)}
                          disabled={deleteChapter.isLoading}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                      {firstQuestion?.answer && (
                        <div className="mt-3 pl-11 text-sm text-gray-500 truncate">
                          {firstQuestion.answer.substring(0, 100)}
                          {firstQuestion.answer.length > 100 && '...'}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Chapter Edit Modal */}
        {editingChapter && (
          <EditChapterModal
            association={editingAssociation}
            questions={editingQuestions}
            isSaving={updateQuestion.isLoading || createQuestion.isLoading}
            existingAssociations={existingAssociations}
            onAssociationChange={setEditingAssociation}
            onAddQuestion={handleAddQuestion}
            onUpdateQuestion={handleUpdateEditingQuestion}
            onToggleQuestionExpanded={handleToggleQuestionExpanded}
            onDeleteQuestion={handleDeleteEditingQuestion}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        )}
      </main>
    </div>
  );
};
