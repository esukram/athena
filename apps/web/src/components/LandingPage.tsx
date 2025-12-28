
import { trpc } from '../utils/trpc';
import { AppHeader } from './AppHeader';
import { LectureCard, LectureProps } from './LectureCard';

export const LandingPage = () => {
  const lecturesQuery = trpc.getLectures.useQuery();

  if (lecturesQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-on-surface">Loading...</div>
      </div>
    );
  }

  if (lecturesQuery.isError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-error">Error loading lectures</div>
      </div>
    );
  }

  const lectures = lecturesQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6 text-on-background">Available Lectures</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {lectures?.map((lecture: LectureProps) => (
            <LectureCard key={lecture.id} lecture={lecture} />
          ))}
        </div>
      </main>
    </div>
  );
};
