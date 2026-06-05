import { Pencil } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('renders with the provided icon', () => {
    render(<IconButton icon={Pencil} aria-label="Edit" />);
    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button).toBeInTheDocument();
  });

  it('uses aria-label for accessible name', () => {
    render(<IconButton icon={Pencil} aria-label="Edit item" />);
    expect(
      screen.getByRole('button', { name: 'Edit item' }),
    ).toBeInTheDocument();
  });

  it('uses aria-label as title when title not provided', () => {
    render(<IconButton icon={Pencil} aria-label="Edit item" />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Edit item');
  });

  it('uses custom title when provided', () => {
    render(
      <IconButton icon={Pencil} aria-label="Edit" title="Custom tooltip" />,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Custom tooltip');
  });

  it('applies primary variant classes by default', () => {
    render(<IconButton icon={Pencil} aria-label="Edit" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('hover:bg-surface-2');
  });

  it('applies danger variant classes when specified', () => {
    render(<IconButton icon={Pencil} aria-label="Delete" variant="danger" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('hover:!bg-red-50');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<IconButton icon={Pencil} aria-label="Edit" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables the button when disabled prop is true', () => {
    render(<IconButton icon={Pencil} aria-label="Edit" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies size sm classes correctly', () => {
    render(<IconButton icon={Pencil} aria-label="Edit" size="sm" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('p-1.5');
  });

  it('applies size md classes correctly', () => {
    render(<IconButton icon={Pencil} aria-label="Edit" size="md" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('p-2');
  });
});
