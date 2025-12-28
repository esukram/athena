import { useNavigate, useParams } from 'react-router-dom';

import { useState } from 'react';

import type { Chapter } from '@athena/api';

import { trpc } from '../utils/trpc';
import { AppHeader } from './AppHeader';

export const EditLecture = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const lectureQuery = trpc.getLecture.useQuery(
    { id: id! },
    {
      enabled: !!id,
      onSuccess: (data) => {
        if (data && !isInitialized) {
          setTitle(data.title);
          setSubtitle(data.subtitle);
          setDescription(data.description);
          setIsInitialized(true);
        }
      },
    },
  );

  const chaptersQuery = trpc.getChapters.useQuery(
    { lectureId: id! },
    { enabled: !!id },
  );

  const updateLecture = trpc.updateLecture.useMutation({
    onSuccess: () => {
      utils.getLectures.invalidate();
      utils.getLecture.invalidate({ id: id! });
    },
  });

  const createChapter = trpc.createChapter.useMutation({
    onSuccess: () => {
      utils.getChapters.invalidate({ lectureId: id! });
      setNewChapterTitle('');
    },
  });

  const updateChapter = trpc.updateChapter.useMutation({
    onSuccess: () => {
      utils.getChapters.invalidate({ lectureId: id! });
      setEditingChapter(null);
      setEditingTitle('');
    },
  });

  const deleteChapter = trpc.deleteChapter.useMutation({
    onSuccess: () => {
      utils.getChapters.invalidate({ lectureId: id! });
    },
  });

  const handleUpdateLecture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    updateLecture.mutate({ id, title, subtitle, description });
  };

  const handleAddChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newChapterTitle.trim()) return;
    const chapters = chaptersQuery.data || [];
    const maxOrder = chapters.length > 0 ? Math.max(...chapters.map((c) => c.order)) : -1;
    createChapter.mutate({
      lectureId: id,
      title: newChapterTitle.trim(),
      order: maxOrder + 1,
    });
  };

  const handleStartEdit = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setEditingTitle(chapter.title);
  };

  const handleSaveEdit = () => {
    if (!editingChapter || !editingTitle.trim()) return;
    updateChapter.mutate({
      id: editingChapter.id,
      title: editingTitle.trim(),
    });
  };

  const handleCancelEdit = () => {
    setEditingChapter(null);
    setEditingTitle('');
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-on-background mb-2">
            Edit Lecture
          </h2>
          <p className="text-lg text-on-surface-variant">
            Update lecture details and manage chapters
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Lecture Details Form */}
          <form
            onSubmit={handleUpdateLecture}
            className="bg-surface rounded-xl shadow-md p-6 space-y-6 h-fit"
          >
            <h3 className="text-xl font-semibold text-on-surface">
              Lecture Details
            </h3>

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
                htmlFor="subtitle"
                className="block text-sm font-medium text-on-surface mb-2"
              >
                Subtitle
              </label>
              <input
                type="text"
                id="subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                placeholder="Enter lecture subtitle"
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

          {/* Chapters Section */}
          <div className="bg-surface rounded-xl shadow-md p-6 space-y-6">
            <h3 className="text-xl font-semibold text-on-surface">Chapters</h3>

            {/* Add Chapter Form */}
            <form onSubmit={handleAddChapter} className="flex gap-3">
              <input
                type="text"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="New chapter title"
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={createChapter.isLoading || !newChapterTitle.trim()}
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
                chapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <span className="shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-700 font-semibold rounded-full text-sm">
                      {chapter.order + 1}
                    </span>

                    {editingChapter?.id === chapter.id ? (
                      <>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveEdit}
                          disabled={updateChapter.isLoading}
                          className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-sm bg-gray-400 hover:bg-gray-500 text-white rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-on-surface">
                          {chapter.title}
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
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
