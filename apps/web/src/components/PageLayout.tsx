import React from 'react';

import { AppHeader } from './AppHeader';

interface PageLayoutProps {
  /** Page content */
  children: React.ReactNode;
  /** Optional container class overrides */
  containerClassName?: string;
  /** Optional main class overrides */
  mainClassName?: string;
}

/**
 * A standard layout component for all pages, providing consistent padding,
 * background, and the application header.
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  containerClassName = '',
  mainClassName = '',
}) => {
  return (
    <div className={`min-h-screen bg-background ${containerClassName}`}>
      <AppHeader />
      <main className={`container mx-auto px-4 py-8 md:py-12 ${mainClassName}`}>
        {children}
      </main>
    </div>
  );
};
