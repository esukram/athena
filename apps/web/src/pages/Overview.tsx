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
      <div className="mb-9">
        <p className="mb-3 text-xs font-bold tracking-[0.14em] text-accent-soft-ink uppercase">
          {t('overview.eyebrow')}
        </p>
        <h1 className="text-4xl text-on-background md:text-5xl">
          {t('overview.availableLectures')}
        </h1>
        <p className="mt-3 max-w-[56ch] text-lg text-ink-soft">
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
