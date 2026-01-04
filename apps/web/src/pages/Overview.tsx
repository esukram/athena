import { useTranslation } from 'react-i18next';

import { ErrorState } from '../components/ErrorState';
import { LectureCard } from '../components/LectureCard';
import { LoadingState } from '../components/LoadingState';
import { PageLayout } from '../components/PageLayout';
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
    <PageLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-on-background mb-2">
          {t('overview.availableLectures')}
        </h2>
        <p className="text-lg text-on-surface-variant">
          {t('overview.exploreCollection')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {lectures?.map((lecture) => (
          <LectureCard key={lecture.id} lecture={lecture} />
        ))}
      </div>
    </PageLayout>
  );
};
