import { useTranslation } from 'react-i18next';

import { useRef, useState } from 'react';

import { ErrorState } from '../components/ErrorState';
import { LectureCard } from '../components/LectureCard';
import { LoadingState } from '../components/LoadingState';
import { PageLayout } from '../components/PageLayout';
import { trpc } from '../utils/trpc';

export const Overview = () => {
  const { t } = useTranslation();
  const lecturesQuery = trpc.lectures.getLectures.useQuery();

  // ponytail: native HTML5 drag events only — no touch support (a drag on a
  // touch device is a scroll). Add a pointer-event fallback if that matters.
  // `order` is the optimistic overlay held while a reorder is in flight.
  const [order, setOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const dropped = useRef(false);

  const utils = trpc.useUtils();
  const reorderLecture = trpc.lectures.reorderLecture.useMutation({
    onSettled: async () => {
      await utils.lectures.getLectures.invalidate();
      setOrder(null);
    },
  });

  if (lecturesQuery.isLoading) {
    return <LoadingState />;
  }

  if (lecturesQuery.isError) {
    return <ErrorState message={t('overview.errorLoading')} />;
  }

  const lectures = lecturesQuery.data ?? [];
  const sorted = order
    ? [...lectures].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    : lectures;

  const handleDragOver = (overId: string) => {
    const from = dragId.current;
    if (!from || from === overId) return;
    const ids = sorted.map((l) => l.id);
    ids.splice(ids.indexOf(overId), 0, ...ids.splice(ids.indexOf(from), 1));
    setOrder(ids);
  };

  // Only a real drop commits. dragend also fires on cancel (Esc, drop outside
  // the grid) — that path must throw the optimistic order away.
  const handleDrop = () => {
    dropped.current = true;
    const from = dragId.current;
    if (!from || !order) return;
    const newOrder = sorted.findIndex((l) => l.id === from);
    const serverOrder = lectures.findIndex((l) => l.id === from);
    if (newOrder === serverOrder || newOrder === -1) {
      setOrder(null);
      return;
    }
    reorderLecture.mutate({ lectureId: from, newOrder });
  };

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
        {sorted.map((lecture) => (
          <div
            key={lecture.id}
            draggable
            onDragStart={(e) => {
              dragId.current = lecture.id;
              dropped.current = false;
              setDraggingId(lecture.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              dragId.current = null;
              setDraggingId(null);
              if (!dropped.current) setOrder(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              handleDragOver(lecture.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop();
            }}
            className={`cursor-grab transition-opacity ${
              draggingId === lecture.id ? 'opacity-40' : ''
            }`}
          >
            <LectureCard lecture={lecture} />
          </div>
        ))}
      </div>
    </PageLayout>
  );
};
