import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { BackButton } from './BackButton';

describe('BackButton', () => {
  const renderWithRouter = (component: React.ReactNode) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('renders the label text', () => {
    renderWithRouter(<BackButton to="/" label="Go Back" />);
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('renders as a link with correct href', () => {
    renderWithRouter(<BackButton to="/home" label="Back to Home" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/home');
  });

  it('renders the chevron icon', () => {
    renderWithRouter(<BackButton to="/" label="Back" />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    renderWithRouter(<BackButton to="/" label="Back" />);
    const link = screen.getByRole('link');
    expect(link).toHaveClass('text-primary-600');
    expect(link).toHaveClass('flex');
    expect(link).toHaveClass('items-center');
  });
});
