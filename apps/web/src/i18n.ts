import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    // Clamp regional codes (e.g. `de-AT`, `en-GB`) to a supported language so
    // `i18n.resolvedLanguage` is always exactly `de` or `en`.
    supportedLngs: ['de', 'en'],
    nonExplicitSupportedLngs: true,
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false, // React already handles XSS protection
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
