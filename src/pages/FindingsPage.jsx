import { useLocale } from '@/i18n/localize'
import { LegacyAtlasRedirect } from './AtlasPage'

export default function LegacyPage() {
  useLocale()
  return <LegacyAtlasRedirect source="findings" />
}
