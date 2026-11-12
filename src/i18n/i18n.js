import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import de from './locales/de.json'
import ar from './locales/ar.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
      ar: { translation: ar },
    },
    supportedLngs: ['en', 'de', 'ar'],
    load: 'languageOnly',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      // Start in English; honor only an explicitly saved language selection.
      order: ['localStorage'],
      caches: ['localStorage'],
    },
  })

export default i18n

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  { code: 'ar', label: 'العربية', dir: 'rtl', flag: '🇸🇦' },
]
