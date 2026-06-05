import { Link } from 'react-router-dom';

import logoSoftDark from '../../assets/logo-mark-soft-dark.png';
import logoSoftLight from '../../assets/logo-mark-soft-light.png';
import { useTheme } from '../theme/ThemeProvider';
import { GlobalSearch } from './GlobalSearch';
import { LanguageSelector } from './LanguageSelector';
import { NavMenu } from './NavMenu';
import { ThemeToggle } from './ThemeToggle';

export const AppHeader = () => {
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? logoSoftDark : logoSoftLight;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/80 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 hover:opacity-90 transition-opacity"
        >
          <img src={logoSrc} alt="" aria-hidden className="h-7 w-auto" />
          <span className="font-display font-extrabold tracking-[-0.022em] text-accent-soft-ink text-xl">
            Athena
          </span>
        </Link>

        <nav className="flex items-center gap-2 lg:gap-4">
          <GlobalSearch />
          <ThemeToggle />
          <LanguageSelector />
          <NavMenu />
        </nav>
      </div>
    </header>
  );
};
