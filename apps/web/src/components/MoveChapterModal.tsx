import { ArrowRightLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useState } from 'react';

import type { Lecture } from '@athena/api';

interface MoveChapterModalProps {
  currentLectureId: string;
  lectures: Lecture[];
  isMoving: boolean;
  onMove: (targetLectureId: string) => void;
  onCancel: () => void;
}

export const MoveChapterModal = ({
  currentLectureId,
  lectures,
  isMoving,
  onMove,
  onCancel,
}: MoveChapterModalProps) => {
  const { t } = useTranslation();
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(
    null,
  );

  // Filter out the current lecture
  const availableLectures = lectures.filter(
    (lecture) => lecture.id !== currentLectureId,
  );

  const handleMove = () => {
    if (selectedLectureId) {
      onMove(selectedLectureId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-primary-600" />
            {t('lectureEdit.moveChapter')}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            aria-label={t('common.cancel')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {availableLectures.length === 0 ? (
            <p className="text-on-surface-variant text-center py-4">
              {t('lectureEdit.noOtherLectures')}
            </p>
          ) : (
            <>
              <label className="block text-sm font-medium text-on-surface mb-3">
                {t('lectureEdit.selectTargetLecture')}
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableLectures.map((lecture) => (
                  <button
                    key={lecture.id}
                    type="button"
                    onClick={() => setSelectedLectureId(lecture.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedLectureId === lecture.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-on-surface">
                      {lecture.title}
                    </div>
                    {lecture.description && (
                      <div className="text-sm text-on-surface-variant mt-1 line-clamp-2">
                        {lecture.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="min-w-28 px-4 py-2 rounded-lg border border-gray-300 text-on-surface hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleMove}
            disabled={isMoving || !selectedLectureId}
            className="min-w-28 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isMoving ? (
              t('lectureEdit.moving')
            ) : (
              <>
                <ArrowRightLeft size={16} />
                {t('lectureEdit.moveToLecture')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
