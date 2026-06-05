import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { Lecture } from '@athena/api';

import { trpc } from '../utils/trpc';
import { ExpandableButton } from './buttons';
import { Button } from './buttons/Button';
import { IconButtonDelete } from './buttons/IconButtonDelete';
import { IconButtonEdit } from './buttons/IconButtonEdit';

export const LectureCard = ({ lecture }: { lecture: Lecture }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const deleteLecture = trpc.lectures.deleteLecture.useMutation({
    onSuccess: () => {
      utils.lectures.getLectures.invalidate();
    },
  });

  const handleDelete = () => {
    if (confirm(t('lectureCard.confirmDelete', { title: lecture.title }))) {
      deleteLecture.mutate({ id: lecture.id });
    }
  };

  const initial = lecture.title.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="group relative flex flex-col overflow-visible rounded-xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg">
      {/* Cover — soft accent wash with the lecture initial set large and faint */}
      <div
        className="relative flex h-32 items-end overflow-hidden rounded-t-xl bg-surface-2 p-5"
        style={{
          backgroundImage:
            'radial-gradient(120% 140% at 85% 10%, var(--accent-soft) 0%, transparent 55%)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-7 -right-2 font-display text-[150px] leading-none font-extrabold text-accent opacity-20 select-none"
        >
          {initial}
        </span>

        <div className="absolute top-3 right-3 z-10 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <IconButtonEdit
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/edit/${lecture.id}`);
            }}
            aria-label={t('lectureCard.editLecture')}
            data-testid="lecture-edit-button"
          />
          <IconButtonDelete
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            aria-label={t('lectureCard.deleteLecture')}
            data-testid="lecture-delete-button"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex-1">
          <h2 className="mb-2 text-xl text-ink">{lecture.title}</h2>
          <p className="text-sm leading-relaxed text-ink-soft line-clamp-3">
            {lecture.description}
          </p>
        </div>

        <div className="mt-5 flex gap-2.5 border-t border-border-soft pt-4">
          <Button
            variant="secondary"
            onClick={() => navigate(`/learn/${lecture.id}`)}
            className="flex-1 py-2.5"
          >
            {t('lectureCard.learn')}
          </Button>

          <ExpandableButton
            variant="primary"
            onClick={() => navigate(`/train/${lecture.id}`)}
            actions={[
              {
                label: t('lectureCard.trainRandomized'),
                onClick: () => navigate(`/train-random/${lecture.id}`),
              },
            ]}
            className="flex-1"
            buttonClassName="py-2.5"
          >
            {t('lectureCard.train')}
          </ExpandableButton>
        </div>
      </div>
    </div>
  );
};
