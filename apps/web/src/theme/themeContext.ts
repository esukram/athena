import { createContext, use } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

export const useTheme = (): ThemeContextValue => {
  const ctx = use(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
