import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from './buttons/Button';

interface LectureNavigationProps {
  onPrev: () => void;
  onNext: () => void;
  disablePrev: boolean;
  disableNext: boolean;
  prevLabel?: string;
  nextLabel?: string;
}

export const LectureNavigation = ({
  onPrev,
  onNext,
  disablePrev,
  disableNext,
  prevLabel,
  nextLabel,
}: LectureNavigationProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-between mt-8 lg:mt-12 pt-4 lg:pt-6 border-t border-gray-300">
      <Button
        variant="ghost"
        onClick={onPrev}
        disabled={disablePrev}
        className="flex items-center gap-2"
      >
        <ChevronLeft size={20} />
        {prevLabel || t('common.previous')}
      </Button>
      <Button
        variant="ghost"
        onClick={onNext}
        disabled={disableNext}
        className="flex items-center gap-2"
      >
        {nextLabel || t('common.next')}
        <ChevronRight size={20} />
      </Button>
    </div>
  );
};
