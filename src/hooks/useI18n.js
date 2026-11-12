import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '@/i18n/i18n'

export function useI18n() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage || i18n.language?.split('-')[0] || 'en'
  const langMeta = SUPPORTED_LANGUAGES.find((l) => l.code === language)
  return {
    language,
    dir: langMeta?.dir ?? 'ltr',
    isRTL: langMeta?.dir === 'rtl',
    flag: langMeta?.flag ?? '',
  }
}
