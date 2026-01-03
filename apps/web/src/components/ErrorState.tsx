import React from 'react';

import { AppHeader } from './AppHeader';

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
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <p className="text-error">{message}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
          >
            {actionLabel}
          </button>
        )}
      </main>
    </div>
  );
};
