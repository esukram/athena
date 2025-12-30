import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'de' | 'en';

interface LanguageOption {
  code: Language;
  flag: string;
  label: string;
}

const languages: LanguageOption[] = [
  { code: 'de', flag: '🇩🇪', label: 'language.german' },
  { code: 'en', flag: '🇬🇧', label: 'language.english' },
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary-50 transition-colors text-lg"
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{currentLanguage.flag}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
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
              <span className="text-lg">{lang.flag}</span>
              <span>{t(lang.label)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
