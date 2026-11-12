import { useTranslation } from 'react-i18next'
import i18n from './i18n'
import de from './locales/de.content.json'
import ar from './locales/ar.content.json'

const catalogs = { de, ar }
const normalize = (text) => text.replace(/\s+/g, ' ').trim()
const folded = Object.fromEntries(
  Object.entries(catalogs).map(([language, catalog]) => [
    language,
    new Map(Object.entries(catalog).map(([key, value]) => [key.toLowerCase(), value])),
  ]),
)
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const languageCode = (language) => language?.split('-')[0]
const VERBATIM = Symbol('verbatim')
export const literalText = (text) => ({ [VERBATIM]: true, text })

// Source text is an editorial identifier. Localize only at the display boundary;
// option values, simulation IDs, and clinical decision logic stay stable.
export function translateText(value, language = i18n.resolvedLanguage || i18n.language) {
  if (Array.isArray(value)) return value.map((item) => translateText(item, language))
  if (typeof value !== 'string' || !value.trim()) return value
  if (
    value === 'NeuroLearn' ||
    /^(?:Fp[12z]|F[3478z]|C[34z]|T[378]|P[3478z]|O[12z]|A[12]|M[12])(?:[–-](?:Fp[12z]|F[3478z]|C[34z]|T[378]|P[3478z]|O[12z]|A[12]|M[12]|avg))?$/.test(
      value,
    )
  )
    return value
  const catalog = catalogs[languageCode(language)]
  if (!catalog) return value
  const key = normalize(value)
  const translated = catalog[key] ?? folded[languageCode(language)].get(key.toLowerCase())
  if (translated !== undefined) {
    return `${value.match(/^\s*/)[0]}${translated}${value.match(/\s*$/)[0]}`
  }
  return value
}

export function formatText(template, values, language = i18n.resolvedLanguage || i18n.language) {
  const translated = translateText(template, language)
  return translated.replace(/\{(\d+)\}/g, (_, index) => {
    const value = values[Number(index)]
    return String(value?.[VERBATIM] ? value.text : (translateDisplay(value, language) ?? ''))
  })
}

// Data-driven labels occasionally join source strings before rendering (for
// example a region and laterality). Match only catalogued templates with words.
const templates = Object.keys(de)
  .filter(
    (key) => /\{\d+\}/.test(key) && key.replace(/\{\d+\}/g, '').replace(/[^a-z]/gi, '').length >= 5,
  )
  .map((key) => {
    const indices = [...key.matchAll(/\{(\d+)\}/g)].map((match) => Number(match[1]))
    const pattern = key
      .split(/\{\d+\}/)
      .map(escape)
      .join('(.+?)')
    return { key, indices, pattern: new RegExp(`^${pattern}$`, 'i') }
  })
  .sort((a, b) => b.key.length - a.key.length)

export function translateDisplay(
  value,
  language = i18n.resolvedLanguage || i18n.language,
  depth = 0,
) {
  if (Array.isArray(value)) return value.map((item) => translateDisplay(item, language, depth))
  if (typeof value !== 'string' || depth > 4) return value
  const direct = translateText(value, language)
  if (direct !== value || !catalogs[languageCode(language)] || !value.trim()) return direct
  const text = normalize(value)
  for (const { key, indices, pattern } of templates) {
    const match = text.match(pattern)
    if (!match) continue
    const values = []
    indices.forEach((index, position) => {
      values[index] = translateDisplay(match[position + 1], language, depth + 1)
    })
    return formatText(key, values, language)
  }
  return value
}

export function useLocale() {
  const { i18n: instance } = useTranslation()
  return instance.resolvedLanguage || instance.language
}
