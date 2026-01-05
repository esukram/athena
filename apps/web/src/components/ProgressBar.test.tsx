import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { ProgressBar } from './ProgressBar';

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'lectureTrain.progressLabel') {
        return `Training progress: ${params?.current} of ${params?.total} questions (${params?.percent}%)`;
      }
      return key;
    },
  }),
}));

describe('ProgressBar', () => {
  it('renders with correct percentage width', () => {
    render(<ProgressBar current={5} total={10} />);

    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill.style.width).toBe('50%');
  });

  it('displays 0% when current is 0', () => {
    render(<ProgressBar current={0} total={10} />);

    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill.style.width).toBe('0%');
  });

  it('displays 100% when current equals total', () => {
    render(<ProgressBar current={10} total={10} />);

    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill.style.width).toBe('100%');
  });

  it('handles edge case of total being 0', () => {
    render(<ProgressBar current={0} total={0} />);

    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill.style.width).toBe('0%');
  });

  it('has correct ARIA attributes', () => {
    render(<ProgressBar current={3} total={10} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('3');
    expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressbar.getAttribute('aria-valuemax')).toBe('10');
    expect(progressbar.getAttribute('aria-label')).toBe(
      'Training progress: 3 of 10 questions (30%)',
    );
  });

  it('clamps percentage to max 100%', () => {
    render(<ProgressBar current={15} total={10} />);

    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill.style.width).toBe('100%');
  });

  it('displays percentage text below the progress bar', () => {
    render(<ProgressBar current={3} total={10} />);

    const percentText = screen.getByTestId('progress-bar-percent');
    expect(percentText.textContent).toBe('30%');
  });
});
