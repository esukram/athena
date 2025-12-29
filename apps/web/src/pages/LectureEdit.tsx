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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const [newChapterQuestion, setNewChapterQuestion] = useState('');
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingAssociation, setEditingAssociation] = useState('');
  const [editingQuestions, setEditingQuestions] = useState<EditingQuestion[]>(
    [],
  );

  // Fetch questions for the editing chapter
  const chapterQuestionsQuery = trpc.questions.getQuestions.useQuery(
    { chapterId: editingChapter?.id || '' },
    { enabled: !!editingChapter?.id },
  );

  // Sync fetched questions to editing state when modal opens
  useEffect(() => {
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
        // For new chapters, questions are pre-populated in createChapter.onSuccess
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
  }, [editingChapter?.id, chapterQuestionsQuery.data]);

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

  // Fetch first question for each chapter (must be before early returns)
  const firstQuestionsQueries = trpc.useQueries((t) =>
    chapters.map((chapter) =>
      t.questions.getFirstQuestion({ chapterId: chapter.id }),
    ),
  );

  // Build a map of chapterId -> firstQuestion
  const firstQuestionMap = new Map<string, Question | undefined>();
  chapters.forEach((chapter, index) => {
    firstQuestionMap.set(chapter.id, firstQuestionsQueries[index]?.data);
  });

  const updateLecture = trpc.lectures.updateLecture.useMutation({
    onSuccess: () => {
      utils.lectures.getLectures.invalidate();
      utils.lectures.getLecture.invalidate({ id: id! });
    },
  });

  const createChapter = trpc.chapters.createChapter.useMutation({
    onSuccess: (newChapter) => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      // Open edit dialog for the new chapter with the entered question
      setEditingChapter(newChapter);
      setEditingAssociation(newChapter.association);
      // Pre-populate the first question with the entered text
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
      utils.questions.getFirstQuestion.invalidate({
        chapterId: editingChapter?.id || '',
      });
    },
  });

  const updateQuestion = trpc.questions.updateQuestion.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      utils.questions.getQuestions.invalidate({
        chapterId: editingChapter?.id || '',
      });
      utils.questions.getFirstQuestion.invalidate({
        chapterId: editingChapter?.id || '',
      });
    },
  });

  const deleteQuestion = trpc.questions.deleteQuestion.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      utils.questions.getQuestions.invalidate({
        chapterId: editingChapter?.id || '',
      });
      utils.questions.getFirstQuestion.invalidate({
        chapterId: editingChapter?.id || '',
      });
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
    const chapters = chaptersQuery.data || [];
    const maxOrder =
      chapters.length > 0 ? Math.max(...chapters.map((c) => c.order)) : -1;
    createChapter.mutate({
      lectureId: id,
      order: maxOrder + 1,
    });
  };

  const handleStartEdit = async (chapter: Chapter) => {
    setEditingChapter(chapter);
    setEditingAssociation(chapter.association);
    setEditingQuestions([]); // Will be populated by useEffect when query loads
  };

  const handleSaveEdit = async () => {
    if (!editingChapter) return;

    // Check that at least the first question has content
    const hasValidQuestion = editingQuestions.some((q) => q.question.trim());
    if (!hasValidQuestion) return;

    // Update chapter association if changed
    if (editingAssociation !== editingChapter.association) {
      updateChapter.mutate({
        id: editingChapter.id,
        association: editingAssociation,
      });
    }

    // Save all questions
    for (const eq of editingQuestions) {
      if (!eq.question.trim()) continue; // Skip empty questions

      if (eq.id) {
        // Update existing question
        updateQuestion.mutate({
          id: eq.id,
          question: eq.question.trim(),
          answer: eq.answer,
          order: eq.order,
        });
      } else {
        // Create new question
        createQuestion.mutate({
          chapterId: editingChapter.id,
          question: eq.question.trim(),
          answer: eq.answer,
          order: eq.order,
        });
      }
    }

    // Close modal after saving
    handleCancelEdit();
  };

  const handleCancelEdit = () => {
    setEditingChapter(null);
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
    if (confirm('Are you sure you want to delete this chapter?')) {
      deleteChapter.mutate({ id: chapterId });
    }
  };

  if (lectureQuery.isLoading) {
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
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                  placeholder="Enter lecture title"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-on-surface mb-2"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors resize-none"
                  placeholder="Enter lecture description"
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
                    Lecture updated successfully!
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={updateLecture.isLoading}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {updateLecture.isLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="px-6 py-3 rounded-lg border border-gray-300 text-on-surface hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </form>
          </Accordion>
        </div>

        <div className="grid gap-8">
          {/* Chapters Section */}
          <Card className="space-y-6">
            <h3 className="text-xl font-semibold text-on-surface">Chapters</h3>

            {/* Add Chapter Form */}
            <form onSubmit={handleAddChapter} className="flex gap-3">
              <input
                type="text"
                value={newChapterQuestion}
                onChange={(e) => setNewChapterQuestion(e.target.value)}
                placeholder="New chapter question"
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={createChapter.isLoading || !newChapterQuestion.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
              >
                {createChapter.isLoading ? 'Adding...' : 'Add'}
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
              {chaptersQuery.isLoading ||
              (chapters.length > 0 &&
                firstQuestionsQueries.some((q) => q.isLoading)) ? (
                <p className="text-on-surface-variant">Loading chapters...</p>
              ) : chapters.length === 0 ? (
                <p className="text-on-surface-variant text-center py-8">
                  No chapters yet. Add your first chapter above.
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
                          {firstQuestion?.question || 'Untitled'}
                        </span>
                        <button
                          onClick={() => handleStartEdit(chapter)}
                          className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteChapter(chapter.id)}
                          disabled={deleteChapter.isLoading}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          Delete
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
