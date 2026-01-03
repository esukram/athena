import { useTranslation } from 'react-i18next';

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
      <button
        onClick={onPrev}
        disabled={disablePrev}
        className="px-4 py-2 text-primary-600 hover:bg-primary-50 disabled:text-gray-400 disabled:hover:bg-transparent rounded-lg transition-colors flex items-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        {prevLabel || t('common.previous')}
      </button>
      <button
        onClick={onNext}
        disabled={disableNext}
        className="px-4 py-2 text-primary-600 hover:bg-primary-50 disabled:text-gray-400 disabled:hover:bg-transparent rounded-lg transition-colors flex items-center gap-2"
      >
        {nextLabel || t('common.next')}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
};
