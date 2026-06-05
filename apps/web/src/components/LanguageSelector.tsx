import { Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useEffect, useRef, useState } from 'react';

type Language = 'de' | 'en';

interface LanguageOption {
  code: Language;
  tag: string;
  label: string;
}

const languages: LanguageOption[] = [
  { code: 'en', tag: 'EN', label: 'language.english' },
  { code: 'de', tag: 'DE', label: 'language.german' },
];

export const LanguageSelector = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLanguageChange = (langCode: Language) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

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
        className={`grid h-10 w-10 place-items-center rounded-lg transition ${
          isOpen
            ? 'bg-accent-soft text-accent-soft-ink'
            : 'text-ink-soft hover:bg-surface-2 hover:text-ink'
        }`}
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe size={21} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 min-w-[200px] rounded-xl border border-border bg-surface p-1.5 shadow-xl"
          role="listbox"
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink transition hover:bg-surface-2"
              role="option"
              aria-selected={lang.code === i18n.resolvedLanguage}
            >
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                {lang.tag}
              </span>
              <span>{t(lang.label)}</span>
              {lang.code === i18n.resolvedLanguage && (
                <Check size={17} className="ml-auto text-accent" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
