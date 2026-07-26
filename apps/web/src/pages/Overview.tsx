import { GripVertical } from 'lucide-react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useRef, useState } from 'react';

import { ErrorState } from '../components/ErrorState';
import { LectureCard } from '../components/LectureCard';
import { LoadingState } from '../components/LoadingState';
import { PageLayout } from '../components/PageLayout';
import { Toast } from '../components/Toast';
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
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const utils = trpc.useUtils();
  const reorderLecture = trpc.lectures.reorderLecture.useMutation({
    onError: () => setShowErrorToast(true),
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
  // Ids the overlay doesn't know about (a refetch added one mid-drag) keep
  // their server position instead of collapsing to the front on indexOf -1.
  const rank = new Map(order?.map((id, i) => [id, i]));
  const sorted = order
    ? [...lectures].sort(
        (a, b) =>
          (rank.get(a.id) ?? lectures.indexOf(a)) -
          (rank.get(b.id) ?? lectures.indexOf(b)),
      )
    : lectures;

  // ponytail: View Transitions where supported, instant elsewhere (Firefox).
  const commitOrder = (update: () => void) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => flushSync(update));
    } else {
      update();
    }
  };

  const moveBy = (id: string, delta: -1 | 1) => {
    if (reorderLecture.isPending) return;
    const ids = sorted.map((l) => l.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    commitOrder(() => setOrder(ids));
    reorderLecture.mutate({ lectureId: id, newOrder: j });
    setAnnouncement(
      t('overview.movedTo', { position: j + 1, total: ids.length }),
    );
  };

  const handleGripKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (!e.altKey) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveBy(id, -1);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveBy(id, 1);
    }
  };

  const handleDragOver = (overId: string) => {
    const from = dragId.current;
    if (!from || from === overId) return;
    const cur = sorted.map((l) => l.id);
    const ids = [...cur];
    ids.splice(ids.indexOf(overId), 0, ...ids.splice(ids.indexOf(from), 1));
    if (ids.join() === cur.join()) return;
    commitOrder(() => setOrder(ids));
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
      commitOrder(() => setOrder(null));
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
            style={{ viewTransitionName: `lecture-${lecture.id}` }}
            onDragEnd={() => {
              dragId.current = null;
              setDraggingId(null);
              if (!dropped.current) commitOrder(() => setOrder(null));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              handleDragOver(lecture.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop();
            }}
            className={`relative transition-opacity ${
              draggingId === lecture.id ? 'opacity-40' : ''
            }`}
          >
            <button
              type="button"
              draggable
              aria-label={t('overview.dragHandle', { title: lecture.title })}
              onDragStart={(e) => {
                if (reorderLecture.isPending) {
                  e.preventDefault();
                  return;
                }
                dragId.current = lecture.id;
                dropped.current = false;
                setDraggingId(lecture.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onKeyDown={(e) => handleGripKeyDown(e, lecture.id)}
              className="absolute top-2 left-2 z-10 cursor-grab p-1 text-ink-soft"
            >
              <GripVertical size={16} />
            </button>
            <LectureCard lecture={lecture} />
          </div>
        ))}
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <Toast
        message={t('overview.reorderFailed')}
        variant="error"
        visible={showErrorToast}
        onDismiss={() => setShowErrorToast(false)}
      />
    </PageLayout>
  );
};
