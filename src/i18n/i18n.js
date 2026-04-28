import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import ar from './locales/ar.json'
import es from './locales/es.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      de: { translation: de },
      ar: { translation: ar },
      es: { translation: es },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',  dir: 'ltr', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', dir: 'ltr', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',  dir: 'ltr', flag: '🇩🇪' },
  { code: 'es', label: 'Español',  dir: 'ltr', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية',  dir: 'rtl', flag: '🇸🇦' },
]
