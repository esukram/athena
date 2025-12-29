import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';

import { useState } from 'react';

import type { Chapter, Question } from '@athena/api';

import { trpc } from '../utils/trpc';
import { AppHeader } from '../components/AppHeader';
import { Card } from '../components/Card';

import { Accordion } from '../components/Accordion';

export const EditLecture = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const [newChapterQuestion, setNewChapterQuestion] = useState('');
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingQuestion, setEditingQuestion] = useState('');
  const [editingAnswer, setEditingAnswer] = useState('');
  const [editingAssociation, setEditingAssociation] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

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

  const updateLecture = trpc.lectures.updateLecture.useMutation({
    onSuccess: () => {
      utils.lectures.getLectures.invalidate();
      utils.lectures.getLecture.invalidate({ id: id! });
    },
  });

  const createChapter = trpc.chapters.createChapter.useMutation({
    onSuccess: (newChapter) => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      setNewChapterQuestion('');
      // Open edit dialog for the new chapter
      setEditingChapter(newChapter);
      setEditingQuestion('');
      setEditingAnswer('');
      setEditingAssociation(newChapter.association);
      setEditingQuestionId(null);
      setShowPreview(false);
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
      setEditingChapter(null);
      setEditingQuestion('');
      setEditingAnswer('');
      setEditingAssociation('');
      setEditingQuestionId(null);
      setShowPreview(false);
    },
  });

  const updateQuestion = trpc.questions.updateQuestion.useMutation({
    onSuccess: () => {
      utils.chapters.getChapters.invalidate({ lectureId: id! });
      setEditingChapter(null);
      setEditingQuestion('');
      setEditingAnswer('');
      setEditingAssociation('');
      setEditingQuestionId(null);
      setShowPreview(false);
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

  const handleStartEdit = async (chapter: Chapter, firstQuestion?: Question) => {
    setEditingChapter(chapter);
    setEditingQuestion(firstQuestion?.question || '');
    setEditingAnswer(firstQuestion?.answer || '');
    setEditingAssociation(chapter.association);
    setEditingQuestionId(firstQuestion?.id || null);
    setShowPreview(false);
  };

  const handleSaveEdit = () => {
    if (!editingChapter || !editingQuestion.trim()) return;
    
    // Update chapter association if changed
    if (editingAssociation !== editingChapter.association) {
      updateChapter.mutate({
        id: editingChapter.id,
        association: editingAssociation,
      });
    }
    
    // Update or create the first question
    if (editingQuestionId) {
      updateQuestion.mutate({
        id: editingQuestionId,
        question: editingQuestion.trim(),
        answer: editingAnswer,
      });
    } else {
      createQuestion.mutate({
        chapterId: editingChapter.id,
        question: editingQuestion.trim(),
        answer: editingAnswer,
        order: 0,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingChapter(null);
    setEditingQuestion('');
    setEditingAnswer('');
    setEditingAssociation('');
    setEditingQuestionId(null);
    setShowPreview(false);
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

  const chapters = chaptersQuery.data || [];

  // Fetch first question for each chapter
  const firstQuestionsQueries = trpc.useQueries((t) =>
    chapters.map((chapter) =>
      t.questions.getFirstQuestion({ chapterId: chapter.id })
    )
  );

  // Build a map of chapterId -> firstQuestion
  const firstQuestionMap = new Map<string, Question | undefined>();
  chapters.forEach((chapter, index) => {
    firstQuestionMap.set(chapter.id, firstQuestionsQueries[index]?.data);
  });

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
              {chaptersQuery.isLoading ? (
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
                          onClick={() => handleStartEdit(chapter, firstQuestion)}
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-on-surface">
                  Edit Chapter
                </h3>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-2">
                    Association
                  </label>
                  <input
                    type="text"
                    value={editingAssociation}
                    onChange={(e) => setEditingAssociation(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Enter association"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-on-surface mb-2">
                    Question
                  </label>
                  <input
                    type="text"
                    value={editingQuestion}
                    onChange={(e) => setEditingQuestion(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Enter question"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-on-surface">
                      Answer (Markdown)
                    </label>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      {showPreview ? 'Edit' : 'Preview'}
                    </button>
                  </div>

                  {showPreview ? (
                    <div className="w-full min-h-[300px] px-4 py-3 rounded-lg border border-gray-300 bg-white prose prose-sm max-w-none overflow-y-auto">
                      {editingAnswer ? (
                        <ReactMarkdown>{editingAnswer}</ReactMarkdown>
                      ) : (
                        <p className="text-gray-400 italic">No content yet</p>
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={editingAnswer}
                      onChange={(e) => setEditingAnswer(e.target.value)}
                      rows={12}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm resize-none"
                      placeholder="Write your answer in Markdown..."
                    />
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-on-surface hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={updateQuestion.isLoading || createQuestion.isLoading || !editingQuestion.trim()}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
                >
                  {(updateQuestion.isLoading || createQuestion.isLoading) ? 'Saving...' : 'Save Chapter'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
