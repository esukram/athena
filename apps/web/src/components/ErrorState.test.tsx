import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from './ErrorState';

// Mock AppHeader to avoid complex dependencies
vi.mock('./AppHeader', () => ({
  AppHeader: () => <header data-testid="app-header">Header</header>,
}));

describe('ErrorState', () => {
  it('renders the error message', () => {
    render(<ErrorState message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders without action button when actionLabel is not provided', () => {
    render(<ErrorState message="Error message" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = vi.fn();
    render(
      <ErrorState
        message="Error"
        actionLabel="Try Again"
        onAction={onAction}
      />
    );
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', () => {
    const onAction = vi.fn();
    render(
      <ErrorState
        message="Error"
        actionLabel="Retry"
        onAction={onAction}
      />
    );
    
    fireEvent.click(screen.getByText('Retry'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders AppHeader', () => {
    render(<ErrorState message="Error" />);
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
  });
});
