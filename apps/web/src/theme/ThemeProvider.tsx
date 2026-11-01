import React, { useCallback, useEffect, useState } from 'react';

import { type Theme, ThemeContext } from './themeContext';

const STORAGE_KEY = 'athena-theme';

/**
 * Resolve the initial theme from the source of truth: the `data-theme`
 * attribute already set on <html> by the blocking inline script in index.html.
 * Falling back to matchMedia only if the attribute is somehow absent avoids a
 * post-mount flash (no light-then-dark correction in an effect).
 */
const getInitialTheme = (): Theme => {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.dataset.theme;
    if (attr === 'light' || attr === 'dark') {
      return attr;
    }
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeTheme, setActiveTheme] = useState<Theme>(getInitialTheme);

  // Reflect the active theme onto <html> whenever it changes.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  const setTheme = useCallback((next: Theme) => {
    setActiveTheme(next);
    // Storage access is guarded — private mode / disabled storage must not
    // crash; the preference simply falls back to session-only in that case.
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // Single persistence path: toggle derives `next` from the committed theme
  // and delegates to setTheme, keeping side effects out of state updaters.
  const toggle = useCallback(() => {
    setTheme(activeTheme === 'dark' ? 'light' : 'dark');
  }, [activeTheme, setTheme]);

  // Follow the OS preference, but only while the user has not made an explicit
  // stored choice. The stored value is read inside the handler so a later
  // toggle correctly stops system-following without re-subscribing.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      let stored: string | null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {
        stored = null;
      }
      if (stored === 'light' || stored === 'dark') {
        return;
      }
      setActiveTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return (
    <ThemeContext value={{ theme: activeTheme, setTheme, toggle }}>
      {children}
    </ThemeContext>
  );
};
