import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PaginationNav } from './PaginationNav';

describe('PaginationNav', () => {
  const defaultProps = {
    onPrev: vi.fn(),
    onNext: vi.fn(),
    disablePrev: false,
    disableNext: false,
    prevLabel: 'Previous',
    nextLabel: 'Next',
  };

  it('renders both navigation buttons with labels', () => {
    render(<PaginationNav {...defaultProps} />);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('calls onPrev when previous button is clicked', () => {
    const onPrev = vi.fn();
    render(<PaginationNav {...defaultProps} onPrev={onPrev} />);
    
    fireEvent.click(screen.getByText('Previous'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('calls onNext when next button is clicked', () => {
    const onNext = vi.fn();
    render(<PaginationNav {...defaultProps} onNext={onNext} />);
    
    fireEvent.click(screen.getByText('Next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables previous button when disablePrev is true', () => {
    render(<PaginationNav {...defaultProps} disablePrev={true} />);
    
    const prevButton = screen.getByText('Previous').closest('button');
    expect(prevButton).toBeDisabled();
  });

  it('disables next button when disableNext is true', () => {
    render(<PaginationNav {...defaultProps} disableNext={true} />);
    
    const nextButton = screen.getByText('Next').closest('button');
    expect(nextButton).toBeDisabled();
  });

  it('does not call onPrev when button is disabled', () => {
    const onPrev = vi.fn();
    render(<PaginationNav {...defaultProps} onPrev={onPrev} disablePrev={true} />);
    
    const prevButton = screen.getByText('Previous').closest('button');
    fireEvent.click(prevButton!);
    expect(onPrev).not.toHaveBeenCalled();
  });
});
