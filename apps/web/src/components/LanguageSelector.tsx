import { useTranslation } from 'react-i18next';

import { useEffect, useRef, useState } from 'react';

import flagDe from '../../assets/flags/de.svg';
import flagGb from '../../assets/flags/gb.svg';

type Language = 'de' | 'en';

interface LanguageOption {
  code: Language;
  flag: string;
  label: string;
}

const languages: LanguageOption[] = [
  { code: 'de', flag: flagDe, label: 'language.german' },
  { code: 'en', flag: flagGb, label: 'language.english' },
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
        <img
          src={currentLanguage.flag}
          alt=""
          className="w-8 h-6 object-cover rounded-sm"
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
              <img
                src={lang.flag}
                alt=""
                className="w-7 h-5 object-cover rounded-sm"
              />
              <span>{t(lang.label)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
