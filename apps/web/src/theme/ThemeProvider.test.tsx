import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './themeContext';

const STORAGE_KEY = 'athena-theme';

// jsdom has no matchMedia; capture the change listener so tests can simulate
// an OS colour-scheme switch.
let osListener: ((event: MediaQueryListEvent) => void) | undefined;

const Probe = () => {
  const { theme, setTheme, toggle } = useTheme();
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggle}>toggle</button>
      <button onClick={() => setTheme('dark')}>dark</button>
      {/* Several calls in one handler are batched into a single render. */}
      <button
        onClick={() => {
          toggle();
          toggle();
        }}
      >
        double toggle
      </button>
      <button
        onClick={() => {
          setTheme('dark');
          toggle();
        }}
      >
        dark then toggle
      </button>
    </>
  );
};

const renderProvider = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

const emitOsChange = (dark: boolean) =>
  act(() => osListener?.({ matches: dark } as MediaQueryListEvent));

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = 'light';
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: (_: string, cb: typeof osListener) => {
          osListener = cb;
        },
        removeEventListener: () => {
          osListener = undefined;
        },
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('toggle switches the theme and persists it', () => {
    renderProvider();
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('setTheme applies and persists the theme', () => {
    renderProvider();
    fireEvent.click(screen.getByText('dark'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('applies batched calls sequentially', () => {
    renderProvider();
    fireEvent.click(screen.getByText('double toggle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');

    fireEvent.click(screen.getByText('dark then toggle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('follows the OS preference until the user makes a choice', () => {
    renderProvider();
    emitOsChange(true);
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('light');

    emitOsChange(true);
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('keeps working when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    renderProvider();
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });
});
