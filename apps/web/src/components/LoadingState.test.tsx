import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoadingState } from './LoadingState';

// Mock AppHeader to avoid complex dependencies
vi.mock('./AppHeader', () => ({
  AppHeader: () => <header data-testid="app-header">Header</header>,
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key === 'common.loading' ? 'Loading...' : key,
  }),
}));

describe('LoadingState', () => {
  it('renders the default loading message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders a custom message when provided', () => {
    render(<LoadingState message="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders AppHeader', () => {
    render(<LoadingState />);
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
  });

  it('has correct container styling', () => {
    const { container } = render(<LoadingState />);
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('min-h-screen');
    expect(mainDiv).toHaveClass('bg-background');
  });
});
