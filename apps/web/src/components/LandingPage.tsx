import { trpc } from "../utils/trpc";
import { AppHeader } from "./AppHeader";
import { LectureCard, LectureProps } from "./LectureCard";

export const LandingPage = () => {
  const lecturesQuery = trpc.getLectures.useQuery();

  if (lecturesQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-lg font-medium text-on-surface">Loading...</p>
        </div>
      </div>
    );
  }

  if (lecturesQuery.isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="rounded-lg bg-red-50 px-6 py-4 border border-red-200">
          <p className="text-lg font-medium text-error">
            Error loading lectures
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
          <h2 className="text-4xl font-bold text-on-background mb-2">
            Available Lectures
          </h2>
          <p className="text-lg text-on-surface-variant">
            Explore our collection of educational content
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {lectures?.map((lecture: LectureProps) => (
            <LectureCard key={lecture.id} lecture={lecture} />
          ))}
        </div>
      </main>
    </div>
  );
};
