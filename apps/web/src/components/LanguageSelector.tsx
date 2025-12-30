import ReactCountryFlag from 'react-country-flag';
import { useTranslation } from 'react-i18next';

import { useEffect, useRef, useState } from 'react';

type Language = 'de' | 'en';

interface LanguageOption {
  code: Language;
  countryCode: string;
  label: string;
}

const languages: LanguageOption[] = [
  { code: 'de', countryCode: 'DE', label: 'language.german' },
  { code: 'en', countryCode: 'GB', label: 'language.english' },
];

export const LanguageSelector = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentLanguage =
    languages.find((lang) => lang.code === i18n.language) || languages[0];

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
        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-primary-50 transition-colors"
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <ReactCountryFlag
          countryCode={currentLanguage.countryCode}
          svg
          style={{ width: '1.5em', height: '1.5em' }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
          role="listbox"
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                lang.code === i18n.language
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-700'
              }`}
              role="option"
              aria-selected={lang.code === i18n.language}
            >
              <ReactCountryFlag
                countryCode={lang.countryCode}
                svg
                style={{ width: '1.25em', height: '1.25em' }}
              />
              <span>{t(lang.label)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
