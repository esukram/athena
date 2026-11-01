import { useTranslation } from 'react-i18next';

import { useEffect } from 'react';

import type { Chapter } from '@athena/api';

import { useChapterEditor } from '../hooks/useChapterEditor';
import { trpc } from '../utils/trpc';
import { EditChapterModal } from './EditChapterModal';
import { IconButtonEdit } from './buttons/IconButtonEdit';

interface ChapterMenuProps {
  chapter: Chapter;
  lectureId: string;
}

export const ChapterMenu = ({ chapter, lectureId }: ChapterMenuProps) => {
  const { t } = useTranslation();
  const { edit, openExisting } = useChapterEditor({ lectureId });
  const isEditing = edit !== null;

  // Fetch distinct associations for autocomplete
  const associationsQuery = trpc.chapters.getDistinctAssociations.useQuery();
  const existingAssociations = associationsQuery.data || [];

  // Prevent keyboard navigation when modal is open
  useEffect(() => {
    if (isEditing) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.stopPropagation();
        }
      };
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [isEditing]);

  return (
    <>
      <IconButtonEdit
        onClick={(e) => {
          e.stopPropagation();
          openExisting(chapter);
        }}
        aria-label={t('chapterMenu.editChapter')}
        data-testid="chapter-edit-button"
      />

      {/* Chapter Edit Modal */}
      {edit && (
        <EditChapterModal
          edit={edit}
          existingAssociations={existingAssociations}
        />
      )}
    </>
  );
};
