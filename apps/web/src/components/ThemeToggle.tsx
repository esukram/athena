import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/ThemeProvider';

export const ThemeToggle = () => {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();

  const label = t('header.toggleTheme');
  const title = theme === 'dark' ? t('header.toLight') : t('header.toDark');

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent-soft text-ink-soft transition-colors"
      aria-label={label}
      title={title}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
};
