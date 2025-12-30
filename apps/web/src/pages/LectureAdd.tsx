import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useState } from 'react';

import { AppHeader } from '../components/AppHeader';
import { Card } from '../components/Card';
import { trpc } from '../utils/trpc';

export const AddLecture = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const createLecture = trpc.lectures.createLecture.useMutation({
    onSuccess: () => {
      utils.lectures.getLectures.invalidate();
      navigate('/');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLecture.mutate({ title, description });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-on-background mb-2">
            {t('lectureAdd.title')}
          </h2>
          <p className="text-lg text-on-surface-variant">
            {t('lectureAdd.subtitle')}
          </p>
        </div>

        <Card as="form" onSubmit={handleSubmit} className="max-w-2xl space-y-6">
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

          {createLecture.error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 border border-red-200">
              <p className="text-sm text-error">
                {t('common.error')}: {createLecture.error.message}
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={createLecture.isLoading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {createLecture.isLoading
                ? t('lectureAdd.creating')
                : t('lectureAdd.createLecture')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-lg border border-gray-300 text-on-surface hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </Card>
      </main>
    </div>
  );
};

