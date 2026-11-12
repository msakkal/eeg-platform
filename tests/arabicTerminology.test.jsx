import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import i18n from '../src/i18n/i18n'
import ar from '../src/i18n/locales/ar.json'
import { translateDisplay } from '../src/i18n/localize'
import { READING_SECTIONS } from '../src/content/readingAlgorithm'
import { DEFAULT_REPORT_DATA, generateEEGReport } from '../src/engine/reportGenerator'
import ConceptsPage from '../src/pages/ConceptsPage'

afterEach(cleanup)

describe('Arabic clinical translation regressions', () => {
  it.each([
    ['spikes', 'شوكات'],
    ['polyspikes', 'شوكات متعددة'],
    ['phase reversal', 'انعكاس الطور'],
    ['hypsarrhythmia', 'اضطراب النظم العالي السعة'],
    ['dyshormia', 'الديسهورميا'],
    ['Temporal electrodes', 'أقطاب صدغية'],
    ['Absence epilepsy', 'صرع الغياب'],
    ['sink', 'مصرف التيار'],
  ])('uses the intended medical meaning for %s', (source, expected) => {
    expect(translateDisplay(source, 'ar')).toBe(expected)
  })

  it('preserves units, duration cutoffs, and the distinction between epilepsy and EEG findings', () => {
    const membrane = translateDisplay(
      ') flow inward and the membrane depolarises by 5–15 mV — pushing the cell closer to its action-potential threshold.',
      'ar',
    )
    expect(membrane).toContain('5–15 ميلي فولت')
    expect(membrane).not.toMatch(/ميجا|ميغا/)
    const criterion = READING_SECTIONS.find(({ id }) => id === 'rhythmic-events').items[2][1]
    const translatedCriterion = translateDisplay(criterion, 'ar')
    expect(translatedCriterion).toContain('>2.5 هرتز')
    expect(translatedCriterion).toContain('≥10 ثوانٍ')
    expect(translateDisplay('A normal interictal EEG does not exclude epilepsy', 'ar')).toBe(
      'التخطيط الطبيعي بين النوبات لا يستبعد الصرع',
    )
    expect(translateDisplay('spikes', 'en')).toBe('spikes')
  })

  it('renders translated figure captions rather than English prop text', async () => {
    await i18n.changeLanguage('ar')
    render(<ConceptsPage />)
    fireEvent.click(screen.getByRole('button', { name: ar.concepts.neuron_dipole }))
    expect(screen.getByText(/عصبون هرمي يعمل كثنائي قطب/)).toHaveTextContent('Na⁺')
    expect(screen.getByText(/عصبون هرمي يعمل كثنائي قطب/)).toHaveTextContent('مصرف للتيار')
  })

  it.each([
    ['one', 'electrographic', 'نوبة كهربائية واحدة'],
    ['two', 'electrographic', 'نوبتان كهربائيتان'],
    ['three', 'electroclinical', 'ثلاث نوبات كهربائية سريرية'],
    ['multiple', 'electroclinical', 'نوبات كهربائية سريرية متعددة'],
  ])('formats Arabic seizure number and type: %s / %s', (count, type, expected) => {
    const data = JSON.parse(JSON.stringify(DEFAULT_REPORT_DATA))
    Object.assign(data.events, { status: 'seizures', eventCount: count, seizureType: type })
    const report = generateEEGReport(data, 'ar')
    expect(report).toContain(expected)
    expect(report).not.toMatch(/One|Two|Three|Multiple|electroclinical|electrographic|\{\d+\}/)
  })

  it('localizes negative report findings, absent activation, and sleep-related epileptiform findings', () => {
    const data = JSON.parse(JSON.stringify(DEFAULT_REPORT_DATA))
    data.study.activations = []
    let report = generateEEGReport(data, 'ar')
    expect(report).toContain('لم تُجرَ إجراءات تنشيط.')
    expect(report).toContain('لا يُلاحظ تباطؤ بؤري')
    expect(report).not.toContain('No focal slowing')
    data.sleep.kComplexes = 'present with associated epileptiform discharges (dyshormia)'
    report = generateEEGReport(data, 'ar')
    expect(report).toContain('الديسهورميا')
    expect(report).not.toContain('Epileptiform discharges')
    expect(report).not.toMatch(/عسر الهضم|خلل الشهية|عدم نضج/)
  })
})
