import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { Overview } from './Overview';

const { reorderMutate } = vi.hoisted(() => ({ reorderMutate: vi.fn() }));

const lectures = [
  {
    id: 'a',
    title: 'Alpha',
    description: '',
    chapterCount: 0,
    questionCount: 0,
  },
  {
    id: 'b',
    title: 'Beta',
    description: '',
    chapterCount: 0,
    questionCount: 0,
  },
  {
    id: 'c',
    title: 'Gamma',
    description: '',
    chapterCount: 0,
    questionCount: 0,
  },
];

// PageLayout only contributes the app chrome (header, theme context) here.
vi.mock('../components/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../utils/trpc', () => ({
  trpc: {
    useUtils: () => ({
      lectures: {
        getLectures: { invalidate: vi.fn().mockResolvedValue(undefined) },
      },
    }),
    lectures: {
      getLectures: {
        useQuery: () => ({ data: lectures, isLoading: false, isError: false }),
      },
      reorderLecture: { useMutation: () => ({ mutate: reorderMutate }) },
      deleteLecture: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

const titles = () =>
  screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

const cardOf = (title: string) =>
  screen.getByText(title).closest('[draggable]') as HTMLElement;

describe('Overview drag and drop', () => {
  it('reverts to the server order when the drag is cancelled without a drop', () => {
    reorderMutate.mockClear();
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>,
    );

    fireEvent.dragStart(cardOf('Alpha'));
    fireEvent.dragOver(cardOf('Gamma'));
    expect(titles()).toEqual(['Beta', 'Gamma', 'Alpha']);

    // No drop event: Esc / dropped outside the grid.
    fireEvent.dragEnd(cardOf('Alpha'));

    expect(reorderMutate).not.toHaveBeenCalled();
    expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('persists the new order when the drag ends in a drop', () => {
    reorderMutate.mockClear();
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>,
    );

    fireEvent.dragStart(cardOf('Alpha'));
    fireEvent.dragOver(cardOf('Gamma'));
    fireEvent.drop(cardOf('Gamma'));
    fireEvent.dragEnd(cardOf('Alpha'));

    expect(reorderMutate).toHaveBeenCalledWith({ lectureId: 'a', newOrder: 2 });
    expect(titles()).toEqual(['Beta', 'Gamma', 'Alpha']);
  });
});
