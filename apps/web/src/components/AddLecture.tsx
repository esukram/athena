import { useNavigate } from 'react-router-dom';

import { useState } from 'react';

import { trpc } from '../utils/trpc';
import { AppHeader } from './AppHeader';

export const AddLecture = () => {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');

  const createLecture = trpc.lectures.createLecture.useMutation({
    onSuccess: () => {
      utils.lectures.getLectures.invalidate();
      navigate('/');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLecture.mutate({ title, subtitle, description });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-on-background mb-2">
            Add New Lecture
          </h2>
          <p className="text-lg text-on-surface-variant">
            Create a new lecture
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-w-2xl bg-surface rounded-xl shadow-md p-6 space-y-6"
        >
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

          {createLecture.error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 border border-red-200">
              <p className="text-sm text-error">
                Error: {createLecture.error.message}
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={createLecture.isLoading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {createLecture.isLoading ? 'Creating...' : 'Create Lecture'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-lg border border-gray-300 text-on-surface hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
