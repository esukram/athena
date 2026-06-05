import { EllipsisVertical, FilePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useEffect, useRef, useState } from 'react';

export const NavMenu = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-primary-50 transition-colors"
        aria-label={t('header.menuLabel')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-testid="nav-menu-button"
      >
        <EllipsisVertical className="w-6 h-6 text-ink-soft" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-48 bg-surface rounded-lg shadow-sm border border-border py-1 z-50"
          role="menu"
        >
          <Link
            to="/add-lecture"
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-bg-tint transition-colors text-ink"
            role="menuitem"
            data-testid="nav-menu-add-lecture"
          >
            <FilePlus className="w-5 h-5" />
            <span>{t('header.addLecture')}</span>
          </Link>
        </div>
      )}
    </div>
  );
};
