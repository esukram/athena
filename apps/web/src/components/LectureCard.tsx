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

  return (
    <div className="group flex flex-col overflow-visible rounded-2xl bg-white shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border border-gray-100">
      <div className="relative h-52 w-full overflow-hidden bg-gradient-to-br from-primary-100 to-primary-50">
        <div className="absolute top-3 right-3 z-10 flex gap-2">
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

        <div className="h-full w-full flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-700 mb-2 text-center">
              {lecture.title}
            </h2>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      <div className="flex flex-col flex-1 p-6">
        <div className="flex-1 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
            {lecture.description}
          </p>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button
            variant="secondary"
            onClick={() => navigate(`/learn/${lecture.id}`)}
            className="flex-1 py-2.5 active:bg-primary-200"
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
            buttonClassName="py-2.5 active:from-primary-800 active:to-primary-900"
          >
            {t('lectureCard.train')}
          </ExpandableButton>
        </div>
      </div>
    </div>
  );
};
