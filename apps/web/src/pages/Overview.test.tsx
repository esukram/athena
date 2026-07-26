import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import { Overview } from './Overview';

const { reorderMutate, reorderMutationOptions, reorderState } = vi.hoisted(
  () => ({
    reorderMutate: vi.fn(),
    reorderMutationOptions: {
      current: undefined as { onError?: () => void } | undefined,
    },
    reorderState: { isPending: false },
  }),
);

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      if (key === 'overview.dragHandle') return `Reorder ${values?.title}`;
      if (key === 'overview.movedTo') {
        return `Moved to position ${values?.position} of ${values?.total}`;
      }
      if (key === 'overview.reorderFailed') return 'Reordering failed';
      return key;
    },
  }),
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
      reorderLecture: {
        useMutation: (options: { onError?: () => void }) => {
          reorderMutationOptions.current = options;
          return { mutate: reorderMutate, isPending: reorderState.isPending };
        },
      },
      deleteLecture: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

const titles = () =>
  screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

const gripOf = (title: string) =>
  screen.getByRole('button', { name: `Reorder ${title}` });

const cardOf = (title: string) =>
  screen
    .getByRole('heading', { level: 2, name: title })
    .closest('.grid > div') as HTMLElement;

const renderOverview = () =>
  render(
    <MemoryRouter>
      <Overview />
    </MemoryRouter>,
  );

beforeEach(() => {
  reorderMutate.mockClear();
  reorderState.isPending = false;
  reorderMutationOptions.current = undefined;
});

describe('Overview drag and drop', () => {
  it('reverts to the server order when the drag is cancelled without a drop', () => {
    renderOverview();

    fireEvent.dragStart(gripOf('Alpha'));
    fireEvent.dragOver(cardOf('Gamma'));
    expect(titles()).toEqual(['Beta', 'Gamma', 'Alpha']);

    // No drop event: Esc / dropped outside the grid.
    fireEvent.dragEnd(cardOf('Alpha'));

    expect(reorderMutate).not.toHaveBeenCalled();
    expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('persists the new order when the drag ends in a drop', () => {
    renderOverview();

    fireEvent.dragStart(gripOf('Alpha'));
    fireEvent.dragOver(cardOf('Gamma'));
    fireEvent.drop(cardOf('Gamma'));
    fireEvent.dragEnd(cardOf('Alpha'));

    expect(reorderMutate).toHaveBeenCalledWith({ lectureId: 'a', newOrder: 2 });
    expect(titles()).toEqual(['Beta', 'Gamma', 'Alpha']);
  });
});

describe('Overview reorder controls', () => {
  it('renders a grip handle button for every lecture', () => {
    renderOverview();

    expect(gripOf('Alpha')).toHaveAttribute('type', 'button');
    expect(gripOf('Beta')).toHaveAttribute('type', 'button');
    expect(gripOf('Gamma')).toHaveAttribute('type', 'button');
  });

  it('makes only the grip handles draggable', () => {
    renderOverview();

    for (const title of ['Alpha', 'Beta', 'Gamma']) {
      expect(cardOf(title)).not.toHaveAttribute('draggable');
      expect(cardOf(title)).not.toHaveClass('cursor-grab');
      expect(gripOf(title)).toHaveAttribute('draggable', 'true');
    }

    expect(document.querySelectorAll('[draggable="true"]')).toHaveLength(3);
  });

  it('moves a lecture down with Alt+ArrowDown and persists its new order', () => {
    renderOverview();

    fireEvent.keyDown(gripOf('Alpha'), { altKey: true, key: 'ArrowDown' });

    expect(titles()).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(reorderMutate).toHaveBeenCalledWith({
      lectureId: 'a',
      newOrder: 1,
    });
  });

  it('does nothing when moving the first lecture up', () => {
    renderOverview();

    fireEvent.keyDown(gripOf('Alpha'), { altKey: true, key: 'ArrowUp' });

    expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(reorderMutate).not.toHaveBeenCalled();
  });

  it('announces the new position after a keyboard move', () => {
    renderOverview();

    fireEvent.keyDown(gripOf('Alpha'), { altKey: true, key: 'ArrowDown' });

    expect(screen.getByText('Moved to position 2 of 3')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('prevents grip dragstart while a reorder is pending', () => {
    reorderState.isPending = true;
    renderOverview();
    const dragStart = createEvent.dragStart(gripOf('Alpha'));

    fireEvent(gripOf('Alpha'), dragStart);
    fireEvent.dragOver(cardOf('Gamma'));

    expect(dragStart.defaultPrevented).toBe(true);
    expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(reorderMutate).not.toHaveBeenCalled();
  });

  it('ignores keyboard moves while a reorder is pending', () => {
    reorderState.isPending = true;
    renderOverview();

    fireEvent.keyDown(gripOf('Alpha'), { altKey: true, key: 'ArrowDown' });

    expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(reorderMutate).not.toHaveBeenCalled();
  });

  it('shows a toast when reordering fails', () => {
    renderOverview();

    act(() => reorderMutationOptions.current?.onError?.());

    expect(screen.getByText('Reordering failed')).toBeInTheDocument();
  });

  it('uses a view transition for a keyboard move when available', () => {
    const originalStartViewTransition = document.startViewTransition;
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {};
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
      writable: true,
    });

    try {
      renderOverview();
      fireEvent.keyDown(gripOf('Alpha'), { altKey: true, key: 'ArrowDown' });

      expect(startViewTransition).toHaveBeenCalledOnce();
    } finally {
      if (originalStartViewTransition) {
        Object.defineProperty(document, 'startViewTransition', {
          configurable: true,
          value: originalStartViewTransition,
          writable: true,
        });
      } else {
        Reflect.deleteProperty(document, 'startViewTransition');
      }
    }
  });
});
