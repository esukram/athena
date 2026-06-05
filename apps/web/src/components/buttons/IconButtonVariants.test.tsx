import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { IconButtonDelete } from './IconButtonDelete';
import { IconButtonEdit } from './IconButtonEdit';
import { IconButtonMove } from './IconButtonMove';

describe('IconButtonEdit', () => {
  it('renders with edit icon', () => {
    render(<IconButtonEdit aria-label="Edit item" />);
    expect(
      screen.getByRole('button', { name: 'Edit item' }),
    ).toBeInTheDocument();
  });

  it('uses primary variant styling', () => {
    render(<IconButtonEdit aria-label="Edit" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('hover:bg-surface-2');
  });

  it('forwards onClick handler', () => {
    const onClick = vi.fn();
    render(<IconButtonEdit aria-label="Edit" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('IconButtonDelete', () => {
  it('renders with delete icon', () => {
    render(<IconButtonDelete aria-label="Delete item" />);
    expect(
      screen.getByRole('button', { name: 'Delete item' }),
    ).toBeInTheDocument();
  });

  it('uses danger variant styling', () => {
    render(<IconButtonDelete aria-label="Delete" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('hover:!bg-red-50');
  });

  it('can be disabled', () => {
    render(<IconButtonDelete aria-label="Delete" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('IconButtonMove', () => {
  it('renders with move icon', () => {
    render(<IconButtonMove aria-label="Move item" />);
    expect(
      screen.getByRole('button', { name: 'Move item' }),
    ).toBeInTheDocument();
  });

  it('uses primary variant styling', () => {
    render(<IconButtonMove aria-label="Move" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('hover:bg-surface-2');
  });

  it('forwards custom title', () => {
    render(
      <IconButtonMove aria-label="Move" title="Move to another lecture" />,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Move to another lecture');
  });
});
