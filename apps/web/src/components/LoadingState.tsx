import { useTranslation } from 'react-i18next';

import React from 'react';

import { AppHeader } from './AppHeader';

interface LoadingStateProps {
  /** Custom message to display, defaults to 'common.loading' translation */
  message?: string;
}

/**
 * A full-page loading state component with AppHeader.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ message }) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <p className="text-on-surface-variant">
          {message || t('common.loading')}
        </p>
      </main>
    </div>
  );
};
