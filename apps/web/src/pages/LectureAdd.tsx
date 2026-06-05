import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import React, { useState } from 'react';

import { Card } from '../components/Card';
import { PageLayout } from '../components/PageLayout';
import { Button } from '../components/buttons/Button';
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
    <PageLayout>
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
            className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
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
            className="w-full px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors resize-none"
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
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={createLecture.isPending}
            className="flex-1"
          >
            {createLecture.isPending
              ? t('lectureAdd.creating')
              : t('lectureAdd.createLecture')}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate('/')}
            className="border border-border hover:bg-bg-tint"
          >
            {t('common.cancel')}
          </Button>
        </div>
      </Card>
    </PageLayout>
  );
};
