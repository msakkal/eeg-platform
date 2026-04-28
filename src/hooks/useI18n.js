import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '@/i18n/i18n'

export function useI18n() {
  const { i18n } = useTranslation()
  const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)
  return {
    language: i18n.language,
    dir:      langMeta?.dir ?? 'ltr',
    isRTL:    langMeta?.dir === 'rtl',
    flag:     langMeta?.flag ?? '',
  }
}
