import React from 'react';

interface PaginationNavProps {
  /** Handler for previous button click */
  onPrev: () => void;
  /** Handler for next button click */
  onNext: () => void;
  /** Whether previous button is disabled */
  disablePrev: boolean;
  /** Whether next button is disabled */
  disableNext: boolean;
  /** Label for previous button */
  prevLabel: string;
  /** Label for next button */
  nextLabel: string;
}

/**
 * A reusable navigation component with previous/next buttons.
 */
export const PaginationNav: React.FC<PaginationNavProps> = ({
  onPrev,
  onNext,
  disablePrev,
  disableNext,
  prevLabel,
  nextLabel,
}) => {
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
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        {prevLabel}
      </button>
      <button
        onClick={onNext}
        disabled={disableNext}
        className="px-4 py-2 text-primary-600 hover:bg-primary-50 disabled:text-gray-400 disabled:hover:bg-transparent rounded-lg transition-colors flex items-center gap-2"
      >
        {nextLabel}
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
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
};
