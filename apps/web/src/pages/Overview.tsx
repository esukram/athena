import { useTranslation } from 'react-i18next';

import type { Lecture } from '@athena/api';

import { AppHeader } from '../components/AppHeader';
import { LectureCard } from '../components/LectureCard';
import { trpc } from '../utils/trpc';

export const Overview = () => {
  const { t } = useTranslation();
  const lecturesQuery = trpc.lectures.getLectures.useQuery();

  if (lecturesQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-lg font-medium text-on-surface">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (lecturesQuery.isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="rounded-lg bg-red-50 px-6 py-4 border border-red-200">
          <p className="text-lg font-medium text-error">
            {t('overview.errorLoading')}
          </p>
        </div>
      </div>
    );
  }

  const lectures = lecturesQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-on-background mb-2">
            {t('overview.availableLectures')}
          </h2>
          <p className="text-lg text-on-surface-variant">
            {t('overview.exploreCollection')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {lectures?.map((lecture: Lecture) => (
            <LectureCard key={lecture.id} lecture={lecture} />
          ))}
        </div>
      </main>
    </div>
  );
};

