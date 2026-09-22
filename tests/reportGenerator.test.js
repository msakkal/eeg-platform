import { describe, expect, it } from 'vitest'
import { DEFAULT_REPORT_DATA, generateEEGReport } from '../src/engine/reportGenerator.js'

const makeData = () => JSON.parse(JSON.stringify(DEFAULT_REPORT_DATA))

describe('generateEEGReport', () => {
  it('generates a complete normal report from the defaults', () => {
    const report = generateEEGReport(makeData())

    expect(report).toContain('TECHNIQUE')
    expect(report).toContain('BACKGROUND')
    expect(report).toContain('SLEEP')
    expect(report).toContain('ABNORMAL FINDINGS')
    expect(report).toContain('IMPRESSION')
    expect(report).toContain('Normal awake and asleep EEG.')
    expect(report).toContain('No clinical events or electrographic seizures were recorded.')
  })

  it('describes and prioritizes focal slowing and epileptiform discharges', () => {
    const data = makeData()
    data.slowing.present = true
    data.slowing.location = 'right temporal region'
    data.epileptiform.present = true
    data.epileptiform.location = 'right anterior temporal region'
    data.epileptiform.morphology = 'sharp waves'

    const report = generateEEGReport(data)

    expect(report).toContain('theta and delta slowing is seen maximal in the right temporal region')
    expect(report).toContain('sharp waves are seen maximal in the right anterior temporal region')
    expect(report).toContain('suggesting focal cerebral dysfunction')
    expect(report).toContain('increased propensity for focal seizures')
    expect(report).not.toContain('Normal awake and asleep EEG.')
  })

  it('handles electrographic and electroclinical seizures without contradictory correlates', () => {
    const electrographic = makeData()
    electrographic.events.status = 'seizures'
    electrographic.events.seizureType = 'electrographic'
    electrographic.events.eventCount = 'one'

    const electrographicReport = generateEEGReport(electrographic)
    expect(electrographicReport).toContain('One electrographic seizure was recorded')
    expect(electrographicReport).toContain('without a definite clinical correlate')
    expect(electrographicReport).not.toContain('with a clinical correlate of behavioral arrest')

    const electroclinical = makeData()
    electroclinical.events.status = 'seizures'
    electroclinical.events.seizureType = 'electroclinical'
    electroclinical.events.eventCount = 'two'

    const electroclinicalReport = generateEEGReport(electroclinical)
    expect(electroclinicalReport).toContain('Two electroclinical seizures were recorded')
    expect(electroclinicalReport).toContain('with a clinical correlate of behavioral arrest')
  })

  it('omits sleep and unused activation procedures when they were not recorded', () => {
    const data = makeData()
    data.sleep.obtained = false
    data.study.states = ['awake']
    data.study.activations = []

    const report = generateEEGReport(data)

    expect(report).toContain('Sleep was not obtained.')
    expect(report).toContain('No activation procedures were performed.')
    expect(report).toContain('Normal awake EEG.')
    expect(report).not.toContain('Normal awake and asleep EEG.')
  })

  it('includes custom findings, limitations, and clinical correlation', () => {
    const data = makeData()
    data.study.limitations = 'Frequent movement artifact limits the temporal regions'
    data.impression.customFinding = 'An irregular rhythm is seen in the ECG channel'
    data.impression.customImpression = 'Clinical significance is uncertain'
    data.impression.correlation = 'Correlate with the cardiac rhythm strip'

    const report = generateEEGReport(data)

    expect(report).toContain(
      'Technical limitations: Frequent movement artifact limits the temporal regions.',
    )
    expect(report).toContain('An irregular rhythm is seen in the ECG channel.')
    expect(report).toContain('Clinical significance is uncertain.')
    expect(report).toContain('CLINICAL CORRELATION\nCorrelate with the cardiac rhythm strip.')
  })

  it('does not call the report normal when dyshormia or abnormal activation is selected', () => {
    const data = makeData()
    data.sleep.kComplexes = 'present with associated epileptiform discharges (dyshormia)'
    data.activation.photic = 'a photoparoxysmal response'

    const report = generateEEGReport(data)

    expect(report).toContain(
      'Epileptiform discharges associated with K-complexes during NREM sleep (dyshormia).',
    )
    expect(report).toContain('Photoparoxysmal response during intermittent photic stimulation.')
    expect(report).not.toContain('Normal awake and asleep EEG.')
  })

  it('labels a severely limited otherwise-negative study as technically limited', () => {
    const data = makeData()
    data.study.limitations = 'Recording is technically limited'

    const report = generateEEGReport(data)

    expect(report).toContain('Technically limited awake and asleep EEG.')
    expect(report).not.toContain('Normal awake and asleep EEG.')
  })
})
