import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { ChapterSidebar } from './ChapterSidebar';

describe('ChapterSidebar', () => {
  const mockChapters = [
    { id: '1', order: 0 },
    { id: '2', order: 1 },
    { id: '3', order: 2 },
  ];

  const defaultProps = {
    title: 'Test Sidebar',
    chapters: mockChapters,
    filteredChapters: mockChapters,
    selectedIndex: 0,
    onSelect: vi.fn(),
    isSearchOpen: false,
    onSearchToggle: vi.fn(),
    searchQuery: '',
    onSearchChange: vi.fn(),
    getDisplayText: (chapter: { id: string; order: number }) =>
      `Chapter ${chapter.id}`,
  };

  it('renders fixed title', () => {
    render(<ChapterSidebar {...defaultProps} />);
    expect(screen.getByText('Test Sidebar')).toBeInTheDocument();
  });

  it('renders all chapters', () => {
    render(<ChapterSidebar {...defaultProps} />);
    expect(screen.getByText('1. Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('2. Chapter 2')).toBeInTheDocument();
    expect(screen.getByText('3. Chapter 3')).toBeInTheDocument();
  });

  it('calls onSelect when a chapter is clicked', () => {
    render(<ChapterSidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('2. Chapter 2'));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockChapters[1]);
  });

  it('calls onSearchToggle when search button is clicked', () => {
    render(<ChapterSidebar {...defaultProps} />);
    const searchButton = screen.getByRole('button', {
      name: /globalSearch\.openSearch/i,
    });
    fireEvent.click(searchButton);
    expect(defaultProps.onSearchToggle).toHaveBeenCalled();
  });

  it('renders search input when isSearchOpen is true', () => {
    render(<ChapterSidebar {...defaultProps} isSearchOpen={true} />);
    expect(
      screen.getByPlaceholderText(/lectureTrain\.searchChapters/i),
    ).toBeInTheDocument();
  });

  it('calls onSearchChange when search input value changes', () => {
    render(<ChapterSidebar {...defaultProps} isSearchOpen={true} />);
    const input = screen.getByPlaceholderText(/lectureTrain\.searchChapters/i);
    fireEvent.change(input, { target: { value: 'test' } });
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('test');
  });

  it('highlights chapters if highlightedChapterIds is provided', () => {
    const highlightedIds = new Set(['2']);
    render(
      <ChapterSidebar
        {...defaultProps}
        highlightedChapterIds={highlightedIds}
      />,
    );

    // Filter button for chapter 2
    const chapter2Button = screen.getByText('2. Chapter 2').closest('button');
    expect(chapter2Button?.className).toContain('border-l-4');
    expect(chapter2Button?.className).toContain('border-amber-400');
  });

  it('applies selected styling to the active chapter', () => {
    render(<ChapterSidebar {...defaultProps} selectedIndex={1} />);
    const chapter2Button = screen.getByText('2. Chapter 2').closest('button');
    expect(chapter2Button?.className).toContain('bg-primary-100');
    expect(chapter2Button?.className).toContain('text-primary-700');
  });

  it('shows empty state when no chapters are filtered', () => {
    render(<ChapterSidebar {...defaultProps} filteredChapters={[]} />);
    expect(
      screen.getByText(/lectureTrain\.noChaptersFound/i),
    ).toBeInTheDocument();
  });
});
