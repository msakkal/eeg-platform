import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createInstance } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import i18n, { SUPPORTED_LANGUAGES } from '../src/i18n/i18n'
import { formatText, literalText, translateDisplay } from '../src/i18n/localize'
import de from '../src/i18n/locales/de.json'
import ar from '../src/i18n/locales/ar.json'
import en from '../src/i18n/locales/en.json'
import germanContent from '../src/i18n/locales/de.content.json'
import arabicContent from '../src/i18n/locales/ar.content.json'
import HomePage from '../src/pages/HomePage'
import LanguageSwitcher from '../src/components/ui/LanguageSwitcher'
import Layout from '../src/components/layout/Layout'
import { searchAtlas } from '../src/content/atlas'
import { DEFAULT_REPORT_DATA, generateEEGReport } from '../src/engine/reportGenerator'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('English, German and Arabic localization', () => {
  it('offers English, German and Arabic, with English as the unsupported-language fallback', async () => {
    expect(SUPPORTED_LANGUAGES.map(({ code }) => code)).toEqual(['en', 'de', 'ar'])
    for (const [requested, expected] of [
      ['fr', 'en'],
      ['en-US', 'en'],
      ['ar-SA', 'ar'],
      ['de-DE', 'de'],
    ]) {
      const instance = createInstance()
      await instance.init({
        resources: { en: { translation: en }, de: { translation: de }, ar: { translation: ar } },
        supportedLngs: i18n.options.supportedLngs,
        fallbackLng: i18n.options.fallbackLng,
        load: 'languageOnly',
        lng: requested,
      })
      expect(instance.resolvedLanguage).toBe(expected)
    }
  })

  it('starts in English even in an Arabic browser and restores an explicit saved selection', async () => {
    localStorage.removeItem('i18nextLng')
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('ar-SA')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ar-SA', 'de-DE'])
    const firstVisit = createInstance().use(LanguageDetector)
    await firstVisit.init({ ...i18n.options, lng: undefined })
    expect(firstVisit.resolvedLanguage).toBe('en')
    await firstVisit.changeLanguage('ar')
    const returningVisit = createInstance().use(LanguageDetector)
    await returningVisit.init({ ...i18n.options, lng: undefined })
    expect(returningVisit.resolvedLanguage).toBe('ar')
    localStorage.setItem('i18nextLng', 'fr')
    const unsupportedSaved = createInstance().use(LanguageDetector)
    await unsupportedSaved.init({ ...i18n.options, lng: undefined })
    expect(unsupportedSaved.resolvedLanguage).toBe('en')
  })

  it('keeps catalog keys and template parameters aligned', () => {
    expect(Object.keys(germanContent).sort()).toEqual(Object.keys(arabicContent).sort())
    expect(Object.keys(germanContent).length).toBeGreaterThan(2500)
    for (const catalog of [germanContent, arabicContent]) {
      for (const [source, target] of Object.entries(catalog)) {
        expect(target, source).not.toMatch(/[⁇�]|\?{2,}/)
        expect((target.match(/\{\d+\}/g) || []).sort(), source).toEqual(
          (source.match(/\{\d+\}/g) || []).sort(),
        )
      }
    }
  })

  it('translates lessons and dynamic labels without changing electrode identifiers or literal input', async () => {
    await i18n.changeLanguage('ar')
    expect(translateDisplay('Spike')).toBe('شوكة')
    expect(translateDisplay('left temporal region')).toMatch(/صدغي/)
    expect(translateDisplay('Fp1–F7')).toBe('Fp1–F7')
    expect(formatText('Indication: {0}', [literalText('Normal')])).toBe('الاستطباب: Normal')
    expect(searchAtlas('شوكة').length).toBeGreaterThan(0)
    await i18n.changeLanguage('de')
    expect(searchAtlas('Schlafspindel').length).toBeGreaterThan(0)
  })

  it('switches the rendered interface and document direction in place', async () => {
    await i18n.changeLanguage('de')
    render(
      <MemoryRouter>
        <Layout>
          <HomePage />
        </Layout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: de.home.hero_title })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    fireEvent.click(screen.getByRole('button', { name: 'Sprache' }))
    fireEvent.click(screen.getByRole('button', { name: /العربية/ }))
    await act(async () => {})
    expect(screen.getByRole('heading', { name: ar.home.hero_title })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(document.documentElement).toHaveAttribute('lang', 'ar')
    expect(screen.queryByText('English')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: ar.common.language }))
    fireEvent.click(screen.getByRole('button', { name: /English/ }))
    await act(async () => {})
    expect(screen.getByRole('heading', { name: en.home.hero_title })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
  })

  it('keeps the switcher to the three supported native language choices', async () => {
    await i18n.changeLanguage('de')
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: 'Sprache' }))
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: /English/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Deutsch/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /العربية/ })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Sprache' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: /English/ })).not.toBeInTheDocument()
  })

  it.each(['de', 'ar'])(
    'exports a localized %s report and preserves free clinical text',
    (language) => {
      const data = JSON.parse(JSON.stringify(DEFAULT_REPORT_DATA))
      data.study.indication = 'Normal'
      data.impression.customFinding = 'Custom observation 123'
      const before = JSON.stringify(data)
      const report = generateEEGReport(data, language)
      expect(report).toContain(language === 'de' ? 'EEG-BERICHT' : 'تقرير تخطيط الدماغ')
      expect(report).toContain(language === 'de' ? 'TECHNIK' : 'تقنية التسجيل')
      expect(report).toContain('Normal.')
      expect(report).toContain('Custom observation 123.')
      expect(report).not.toMatch(/\{\d+\}|\b(?:awake|drowsy|continuous|symmetric|TECHNIQUE)\b/)
      expect(JSON.stringify(data)).toBe(before)
    },
  )
})
