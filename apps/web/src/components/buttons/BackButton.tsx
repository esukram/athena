import { Link } from 'react-router-dom';

import React from 'react';

interface BackButtonProps {
  /** The route path to navigate to */
  to: string;
  /** The button label text */
  label: string;
}

/**
 * A reusable back navigation button with a chevron icon.
 */
export const BackButton: React.FC<BackButtonProps> = ({ to, label }) => {
  return (
    <Link
      to={to}
      className="text-primary-600 hover:text-primary-700 text-sm mb-4 flex items-center gap-1"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
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
      {label}
    </Link>
  );
};
