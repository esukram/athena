import React from 'react';

import { PageLayout } from './PageLayout';

interface ErrorStateProps {
  /** Error message to display */
  message: string;
  /** Label for the action button */
  actionLabel?: string;
  /** Callback when action button is clicked */
  onAction?: () => void;
}

/**
 * A full-page error state component with AppHeader.
 * Optionally includes an action button.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  actionLabel,
  onAction,
}) => {
  return (
    <PageLayout>
      <p className="text-error">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-on-primary hover:bg-primary-700"
        >
          {actionLabel}
        </button>
      )}
    </PageLayout>
  );
};
