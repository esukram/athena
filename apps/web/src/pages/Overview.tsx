import { useTranslation } from 'react-i18next';

import type { Lecture } from '@athena/api';

import { AppHeader } from '../components/AppHeader';
import { ErrorState } from '../components/ErrorState';
import { LectureCard } from '../components/LectureCard';
import { LoadingState } from '../components/LoadingState';
import { trpc } from '../utils/trpc';

export const Overview = () => {
  const { t } = useTranslation();
  const lecturesQuery = trpc.lectures.getLectures.useQuery();

  if (lecturesQuery.isLoading) {
    return <LoadingState />;
  }

  if (lecturesQuery.isError) {
    return <ErrorState message={t('overview.errorLoading')} />;
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
