import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import '../src/i18n/i18n'
import AtlasPage, { LegacyAtlasRedirect } from '../src/pages/AtlasPage'
import {
  ATLAS_BY_ID,
  ATLAS_CATEGORIES,
  ATLAS_ENTRIES,
  MERGED_TOPICS,
  canonicalFindingId,
  canonicalWaveformId,
  relatedEntries,
  searchAtlas,
} from '../src/content/atlas'
import { CLINICAL_FINDINGS } from '../src/content/clinicalFindings'
import { WAVEFORM_PATTERNS } from '../src/engine/waveforms'
import { SANDBOX_PATTERN_IDS } from '../src/engine/patterns'
import { ADDITIONAL_PATTERN_CONFIG } from '../src/engine/additionalPatterns'
import { MONTAGES } from '../src/engine/montages'
import { useEEGStore } from '../src/store/eegStore'
import { useEEGSignal } from '../src/hooks/useEEGSignal'

// Canvas is checked in the browser; these tests exercise content and routing.
vi.mock('../src/components/eeg/DemoTraceViewer', () => ({
  default: ({ patternId }) => <div data-testid="waveform-preview">{patternId}</div>,
}))
vi.mock('../src/components/eeg/EEGViewer', () => ({
  default: () => <div data-testid="recording-preview" />,
}))
vi.mock('../src/hooks/useEEGSignal', () => ({
  useEEGSignal: vi.fn(() => ({ channels: [], timeAxis: [], isReady: true })),
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

function NavigationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <span data-testid="location">
        {location.pathname}
        {location.search}
      </span>
      <button onClick={() => navigate(-1)}>Browser back</button>
    </>
  )
}

function openPage(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavigationProbe />
      <Routes>
        <Route path="/atlas" element={<AtlasPage />} />
        <Route path="/atlas/:entryId" element={<AtlasPage />} />
        <Route path="/waveforms" element={<LegacyAtlasRedirect source="waveforms" />} />
        <Route path="/findings" element={<LegacyAtlasRedirect source="findings" />} />
        <Route path="/sandbox" element={<div>Simulator</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('canonical atlas catalogue', () => {
  it('gives every source topic a valid canonical destination, merging only explicitly paired topics', () => {
    expect(new Set(ATLAS_ENTRIES.map((entry) => entry.id)).size).toBe(ATLAS_ENTRIES.length)
    for (const waveform of Object.values(WAVEFORM_PATTERNS)) {
      const entry = ATLAS_BY_ID[canonicalWaveformId(waveform.id)]
      expect(entry.waveform).toBe(waveform)
    }
    for (const finding of CLINICAL_FINDINGS) {
      const entry = ATLAS_BY_ID[canonicalFindingId(finding.id)]
      expect(entry.finding).toBe(finding)
      expect(entry.features.every(Boolean)).toBe(true)
      expect(entry.contextFeatures.every(Boolean)).toBe(true)
    }
    expect(ATLAS_ENTRIES).toHaveLength(
      CLINICAL_FINDINGS.length +
        Object.keys(WAVEFORM_PATTERNS).length -
        Object.keys(MERGED_TOPICS).length,
    )
    expect(canonicalWaveformId('mu')).toBe(canonicalFindingId('mu'))
    expect(canonicalWaveformId('burst_suppression')).toBe(canonicalFindingId('burst_suppression'))
    expect(canonicalWaveformId('alpha')).not.toBe(canonicalFindingId('normal_awake'))
    expect(canonicalWaveformId('sleep_spindle')).not.toBe(canonicalFindingId('normal_sleep'))
    expect(canonicalWaveformId('constructor')).toBeNull()
    expect(ATLAS_BY_ID.constructor).toBeUndefined()
  })

  it('links components in both directions and avoids misleading generic previews', () => {
    expect(relatedEntries(ATLAS_BY_ID.alpha).map((entry) => entry.id)).toContain('normal_awake')
    expect(relatedEntries(ATLAS_BY_ID.normal_sleep).map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['sleep_spindle', 'k_complex']),
    )
    expect(relatedEntries(ATLAS_BY_ID.sharp_wave).map((entry) => entry.id)).toContain(
      'temporal_sharps',
    )
    expect(ATLAS_BY_ID.rem_sleep.waveform).toBeNull()
    expect(ATLAS_BY_ID.rem_sleep.simulation.pattern).toBe('normal_rem')
    expect(ATLAS_BY_ID.electrocerebral_silence.componentIds).toEqual([])
    expect(ATLAS_BY_ID.electrocerebral_silence.waveform).toBeNull()
    for (const entry of ATLAS_ENTRIES) {
      for (const id of entry.componentIds) expect(ATLAS_BY_ID[id]).toBeTruthy()
      if (entry.simulation) {
        expect(SANDBOX_PATTERN_IDS).toContain(entry.simulation.pattern)
        expect(MONTAGES[entry.simulation.montageId]).toBeTruthy()
      }
    }
  })

  it('searches aliases and clinical context without duplicating merged topics', () => {
    expect(searchAtlas('mu rhythm').filter((entry) => entry.id === 'mu')).toHaveLength(1)
    expect(searchAtlas('PLEDs').some((entry) => entry.id === 'lpds')).toBe(true)
    expect(searchAtlas('sigma', 'sleep', 'waveform').map((entry) => entry.id)).toContain(
      'sleep_spindle',
    )
    expect(searchAtlas('spindle', 'sleep', 'waveform')[0].id).toBe('sleep_spindle')
    expect(searchAtlas('', 'sleep', 'pattern').map((entry) => entry.id)).toContain('normal_sleep')
    expect(searchAtlas('', 'sleep', 'pattern').map((entry) => entry.id)).not.toContain(
      'sleep_spindle',
    )
  })
})

describe('atlas user journeys', () => {
  it.each(Object.keys(ADDITIONAL_PATTERN_CONFIG))(
    'previews %s and opens its working Sandbox simulation',
    (id) => {
      useEEGStore.setState({ pattern: 'normal_awake', activationProcedure: 'hyperventilation' })
      openPage(`/atlas/${id}`)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(ATLAS_BY_ID[id].title)
      expect(screen.getByTestId('recording-preview')).toBeVisible()
      expect(useEEGSignal).toHaveBeenCalledWith(expect.objectContaining({ pattern: id }))
      expect(screen.getByRole('link', { name: ATLAS_BY_ID[id].finding.source[1] })).toHaveAttribute(
        'href',
        ATLAS_BY_ID[id].finding.source[0],
      )
      fireEvent.click(screen.getByRole('button', { name: /Open in simulator/ }))
      expect(screen.getByTestId('location')).toHaveTextContent(`/sandbox?atlas=${id}`)
      expect(useEEGStore.getState()).toMatchObject({
        pattern: id,
        activationProcedure: 'none',
        isPlaying: false,
      })
    },
  )

  it.each(['/waveforms?id=mu', '/findings?id=mu'])('redirects %s to a single mu entry', (path) => {
    openPage(path)
    expect(screen.getByTestId('location')).toHaveTextContent('/atlas/mu')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mu Rhythm')
    expect(screen.getAllByText('Frequency')).toHaveLength(1)
    expect(screen.queryByText('Key EEG Features')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pitfalls and mimics' })).toBeVisible()
  })

  it('redirects a renamed waveform and preserves search parameters', () => {
    openPage('/waveforms?id=triphasic_waves&q=triphasic')
    expect(screen.getByTestId('location')).toHaveTextContent('/atlas/triphasic?q=triphasic')
  })

  it('retains filters through entry navigation and browser back', () => {
    openPage('/atlas?category=sleep&kind=waveform')
    const search = screen.getByRole('searchbox', { name: 'Search the atlas' })
    fireEvent.change(search, { target: { value: 'spindle' } })
    fireEvent.click(screen.getByRole('link', { name: 'Sleep Spindle' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sleep Spindle')
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
    expect(screen.getByRole('searchbox')).toHaveValue('spindle')
    fireEvent.click(screen.getByText('Filter topics'))
    expect(screen.getByRole('combobox', { name: 'Subject' })).toHaveValue('sleep')
    expect(screen.getByRole('combobox', { name: 'Entry type' })).toHaveValue('waveform')
  })

  it('connects N2 to its components without repeating spindle measurements', () => {
    openPage('/atlas/normal_sleep')
    expect(screen.queryByText(/12–14 Hz/)).not.toBeInTheDocument()
    expect(screen.getByTestId('recording-preview')).toBeVisible()
    fireEvent.click(screen.getByRole('link', { name: 'Sleep Spindle →' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sleep Spindle')
    expect(screen.getByText('12–14 Hz (sigma band)')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Recording pattern Stage N2 Sleep →' }),
    ).toHaveAttribute('href', '/atlas/normal_sleep')
  })

  it('uses a whole-record preview for burst suppression and shares its simulator settings', () => {
    useEEGStore.setState({
      activationProcedure: 'hyperventilation',
      eyesClosed: false,
      montageId: 'average_reference',
      sensitivity: 30,
    })
    openPage('/atlas/burst_suppression')
    expect(useEEGSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        pattern: 'burst_suppression',
        montageId: 'longitudinal_bipolar',
        isPlaying: false,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Waveform shape' }))
    expect(screen.getByTestId('waveform-preview')).toHaveTextContent('burst_suppression')
    fireEvent.click(screen.getByRole('button', { name: 'Open in simulator →' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/sandbox?atlas=burst_suppression')
    expect(useEEGStore.getState()).toMatchObject({
      pattern: 'burst_suppression',
      montageId: 'longitudinal_bipolar',
      activationProcedure: 'none',
      eyesClosed: true,
      sensitivity: 7,
      isPlaying: false,
    })
  })

  it('handles missing entries and unmatched searches without showing unrelated content', () => {
    const view = openPage('/atlas/unknown')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Atlas entry not found')
    view.unmount()
    openPage('/findings?id=nonexistent_pattern')
    expect(screen.getByRole('searchbox')).toHaveValue('nonexistent pattern')
    expect(screen.getByText(/No matching entries/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('status', { name: 'Matching topics' })).not.toHaveTextContent(
      '0 topics',
    )
  })

  it('keeps grouped topic navigation beside the selected entry', () => {
    openPage('/atlas')
    expect(screen.getByRole('navigation', { name: 'Atlas topics' })).toBeVisible()
    for (const name of ['Waveforms', 'Normal awake EEG', 'Normal sleep', 'Normal variants']) {
      expect(screen.getAllByRole('heading', { name, exact: true }).length).toBeGreaterThan(0)
    }
    const topics = screen.getByRole('navigation', { name: 'Atlas topics' })
    const sleep = within(topics).getByRole('region', { name: 'Normal sleep' })
    const waveforms = within(sleep).getByRole('region', { name: 'Individual waveforms' })
    const recordings = within(sleep).getByRole('region', { name: 'Recording patterns' })
    expect(
      within(waveforms).getByRole('link', { name: ATLAS_BY_ID.sleep_spindle.title }),
    ).toBeVisible()
    expect(
      within(recordings).getByRole('link', { name: ATLAS_BY_ID.normal_sleep.title }),
    ).toBeVisible()
    expect(
      waveforms.compareDocumentPosition(recordings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    for (const [category, subjectTitle] of ATLAS_CATEGORIES) {
      const subjectEntries = ATLAS_ENTRIES.filter((entry) => entry.category === category)
      if (!subjectEntries.length) continue
      const subject = within(topics).getByRole('region', { name: subjectTitle })
      for (const entry of subjectEntries) {
        const kind = {
          waveform: 'Individual waveforms',
          pattern: 'Recording patterns',
          comparison: 'Pattern comparisons',
        }[entry.kind]
        const subsection = within(subject).getByRole('region', { name: kind })
        expect(within(subsection).getByRole('link', { name: entry.title })).toHaveAttribute(
          'href',
          `/atlas/${entry.id}`,
        )
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'Collapse atlas topics' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alpha')
    expect(screen.queryByRole('navigation', { name: 'Atlas topics' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand atlas topics' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alpha')
    fireEvent.click(screen.getByRole('link', { name: 'Mu Rhythm' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mu Rhythm')
    expect(screen.getByRole('link', { name: 'Mu Rhythm' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('navigation', { name: 'Atlas topics' })).toBeVisible()
  })
})
