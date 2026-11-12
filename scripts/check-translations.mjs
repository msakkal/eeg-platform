import fs from 'node:fs'
import { collectSources } from './localization-source.mjs'

const sources = collectSources()
const catalogs = ['de', 'ar'].map((language) => [
  language,
  JSON.parse(fs.readFileSync(`src/i18n/locales/${language}.content.json`, 'utf8')),
])
let failures = 0
for (const [language, catalog] of catalogs) {
  for (const source of sources) {
    if (!(source in catalog)) {
      console.error(`${language}: missing ${source}`)
      failures++
    }
  }
  for (const [source, target] of Object.entries(catalog)) {
    const parameters = (text) => (text.match(/\{\d+\}/g) || []).sort().join(',')
    if (parameters(source) !== parameters(target) || /[⁇�]|\?{2,}/.test(target)) {
      console.error(`${language}: invalid translation: ${source}`)
      failures++
    }
  }
}
if (failures) process.exitCode = 1
else
  console.log(
    `German and Arabic: ${sources.length} source strings covered; template parameters match.`,
  )
