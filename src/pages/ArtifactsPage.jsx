import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import CollapsiblePanel from '@/components/ui/CollapsiblePanel'
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ARTIFACT_CATALOGUE } from '@/engine/artifacts'
import { makeTimeAxis, SAMPLE_RATE } from '@/engine/signalGenerator'
import { applyMontage, DEFAULT_MONTAGE, MONTAGES } from '@/engine/montages'
import EEGViewer from '@/components/eeg/EEGViewer'
import EEGViewerControls, {
  buildViewerThemeOverrides,
  DEFAULT_VIEWER_STYLE,
} from '@/components/eeg/EEGViewerControls'
import CollapsibleChannelPanel from '@/components/eeg/CollapsibleChannelPanel'
import { getViewerTheme } from '@/engine/viewerThemes'

// Tabs within the detail panel — labels resolved via i18n (`artifacts.detail_tabs.<id>`)
const DETAIL_TABS = [
  { id: 'overview'      },
  { id: 'identify'      },
  { id: 'differentiate' },
  { id: 'reduce'        },
  { id: 'clinical'      },
]

const ARTIFACT_VIEWER_MAX_CHANNEL_HEIGHT = 46
const ARTIFACT_VIEWER_MIN_CHANNEL_HEIGHT = 34
const ARTIFACT_VIEWER_FOOTER_HEIGHT = 24
const ARTIFACT_VIEWER_CHROME_HEIGHT = 97
const ARTIFACT_VIEWER_VERTICAL_PADDING = 18
const ECG_CHANNEL_TOP_PADDING = 18
const ARTIFACT_DETAIL_MIN_HEIGHT = {
  overview: 330,
  identify: 300,
  differentiate: 280,
  reduce: 340,
  clinical: 260,
}

function channelPairFromLabel(label) {
  const parts = String(label ?? '').split(/(?:[\u2013\u2014-]|\u00e2\u20ac\u201c)/).map(part => part.trim())
  return parts.length === 2 && parts[0] && parts[1] ? parts : null
}

function derivePseudoRawChannels(channels) {
  const electrodeNames = new Set()
  const usableChannels = channels.filter(ch => {
    const pair = channelPairFromLabel(ch.label)
    if (!pair || !ch.data?.length) return false
    electrodeNames.add(pair[0])
    electrodeNames.add(pair[1])
    return true
  })
  const first = usableChannels[0]?.data
  if (!first) return null

  const raw = Object.fromEntries(
    Array.from(electrodeNames).map(label => [label, new Float32Array(first.length)])
  )
  raw.A1 = new Float32Array(first.length)
  raw.A2 = new Float32Array(first.length)
  const counts = Object.fromEntries(Array.from(electrodeNames).map(label => [label, 0]))

  usableChannels.forEach(ch => {
    const [pos, neg] = channelPairFromLabel(ch.label)
    counts[pos] += 1
    counts[neg] += 1
    for (let i = 0; i < ch.data.length; i++) {
      raw[pos][i] += ch.data[i] * 0.5
      raw[neg][i] -= ch.data[i] * 0.5
    }
  })

  for (const [label, data] of Object.entries(raw)) {
    const divisor = Math.max(1, counts[label])
    for (let i = 0; i < data.length; i++) data[i] /= divisor
  }

  return raw
}

function remapHotChannels(hot, montageId) {
  if (montageId === DEFAULT_MONTAGE) return hot
  const hotElectrodes = new Set()
  hot.forEach(label => {
    const pair = channelPairFromLabel(label)
    pair?.forEach(electrode => hotElectrodes.add(electrode))
  })
  if (hotElectrodes.size === 0) return []

  return (MONTAGES[montageId]?.channels ?? [])
    .filter(({ pos, neg }) => hotElectrodes.has(pos) || hotElectrodes.has(neg))
    .map(({ label }) => label)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArtifactsPage() {
  useLocale()
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedId = searchParams.get('id')
  const selectedId = ARTIFACT_CATALOGUE.some(artifact => artifact.id === requestedId) ? requestedId : ARTIFACT_CATALOGUE[0].id
  const setSelectedId = id => setSearchParams(previous => {
    const next = new URLSearchParams(previous)
    next.set('id', id)
    return next
  })
  const [detailTab,  setDetailTab]  = useState('overview')
  const [viewState,  setViewState]  = useState({ channels: [], events: [], hot: [] })
  const [generating, setGenerating] = useState(false)
  const [filter,     setFilter]     = useState('all')
  const [hoveredChannel, setHoveredChannel] = useState(null)
  const [montageId, setMontageId] = useState(DEFAULT_MONTAGE)
  const [sensitivity, setSensitivity] = useState(7)
  const [filterConfig, setFilterConfig] = useState({ hp: null, lp: null, notch: null })
  const [viewerTheme, setViewerTheme] = useState('midnight')
  const [viewerStyle, setViewerStyle] = useState(DEFAULT_VIEWER_STYLE)

  const artifact = useMemo(
    () => ARTIFACT_CATALOGUE.find(a => a.id === selectedId),
    [selectedId]
  )

  useEffect(() => {
    if (!artifact) return
    setGenerating(true)
    const tid = setTimeout(() => {
      try {
        const result = artifact.generator()
        // Support legacy array shape and new { channels, events, hot } shape
        if (Array.isArray(result)) {
          setViewState({ channels: result, events: [], hot: [] })
        } else {
          setViewState({
            channels: result.channels ?? [],
            events:   result.events   ?? [],
            hot:      result.hot      ?? [],
          })
        }
      } catch (e) {
        console.error(e)
      }
      setGenerating(false)
    }, 30)
    return () => clearTimeout(tid)
  }, [artifact])

  useEffect(() => {
    setDetailTab('overview')
    setHoveredChannel(null)
  }, [selectedId])

  const timeAxis = useMemo(() => makeTimeAxis(8 * SAMPLE_RATE, SAMPLE_RATE), [])
  const baseTheme = getViewerTheme(viewerTheme)
  const themeOverrides = useMemo(
    () => viewerTheme === 'custom' ? buildViewerThemeOverrides(viewerStyle) : {},
    [viewerStyle, viewerTheme]
  )
  const effectiveTheme = useMemo(() => ({ ...baseTheme, ...themeOverrides }), [baseTheme, themeOverrides])

  const filterGroups = [
    { id: 'all',           label: 'All'      },
    { id: 'ocular',        label: 'Ocular'   },
    { id: 'muscular',      label: 'Muscular' },
    { id: 'technical',     label: 'Technical'},
    { id: 'physiological', label: 'Physiol.' },
  ]
  const filterMap = {
    eye_blink:      'ocular',
    lateral_eye:    'ocular',
    roving_eye:     'ocular',
    nystagmus:      'ocular',
    photomyogenic:  'ocular',
    muscle:         'muscular',
    chewing:        'muscular',
    tremor:         'muscular',
    glossokinetic:  'muscular',
    powerline:      'technical',
    electrode_pop:  'technical',
    ecg:            'physiological',
    sweat:          'physiological',
    respiration:    'physiological',
    ventilator:     'physiological',
  }
  const filtered = filter === 'all'
    ? ARTIFACT_CATALOGUE
    : ARTIFACT_CATALOGUE.filter(a => filterMap[a.id] === filter)

  const { channels: sourceChannels, events, hot: sourceHot } = viewState
  const rawChannels = useMemo(
    () => derivePseudoRawChannels(sourceChannels),
    [sourceChannels]
  )
  const channels = useMemo(() => {
    if (montageId === DEFAULT_MONTAGE || !rawChannels) return sourceChannels
    const derived = applyMontage(rawChannels, montageId)
    const auxiliaryChannels = sourceChannels.filter(ch => !channelPairFromLabel(ch.label))
    return [...derived, ...auxiliaryChannels]
  }, [montageId, rawChannels, sourceChannels])
  const hot = useMemo(
    () => remapHotChannels(sourceHot, montageId),
    [montageId, sourceHot]
  )
  const ecgChannelPadding = channels.some(ch => ch.label === 'ECG') ? ECG_CHANNEL_TOP_PADDING : 0
  const viewerChannelCount = Math.max(channels.length, 16)
  const detailMinHeight = ARTIFACT_DETAIL_MIN_HEIGHT[detailTab] ?? ARTIFACT_DETAIL_MIN_HEIGHT.overview
  const dynamicChannelHeight = viewerChannelCount > 18
    ? ARTIFACT_VIEWER_MIN_CHANNEL_HEIGHT
    : ARTIFACT_VIEWER_MAX_CHANNEL_HEIGHT
  const viewerCanvasHeight = viewerChannelCount * dynamicChannelHeight + ARTIFACT_VIEWER_VERTICAL_PADDING * 2 + ecgChannelPadding + ARTIFACT_VIEWER_FOOTER_HEIGHT
  const viewerPanelHeight = ARTIFACT_VIEWER_CHROME_HEIGHT + viewerCanvasHeight
  const eventAnnotations = useMemo(() => (
    events.map(ev => ({
      id: `${selectedId}-${ev.t}-${ev.text ?? 'event'}`,
      timeS: ev.t,
      label: ev.text ?? 'Event',
      color: artifact?.color ?? '#00FFB0',
    }))
  ), [artifact?.color, events, selectedId])

  return (
    <div className="flex min-h-[100dvh] overflow-visible">

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <CollapsiblePanel title="Artifact topics" widthClass="w-52">

        <div className="px-4 py-4 border-b border-eeg-border">
          <p className="font-display font-bold text-sm text-eeg-text">{localize("Artifacts")}</p>
          <p className="font-mono text-xs text-eeg-muted mt-0.5">
            {localize(ARTIFACT_CATALOGUE.length)}{localize(" patterns")}</p>
        </div>

        <div className="px-3 pt-3 pb-2 flex flex-wrap gap-1 border-b border-eeg-border">
          {filterGroups.map(fg => (
            <button key={fg.id}
              onClick={() => setFilter(fg.id)}
              className={`text-xs font-mono px-2 py-0.5 rounded-full border transition-all
                ${filter === fg.id
                  ? 'border-eeg-accent text-eeg-accent bg-eeg-accent bg-opacity-10'
                  : 'border-eeg-border text-eeg-muted hover:text-eeg-text'
                }`}
            >
              {localize(fg.label)}
            </button>
          ))}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {filtered.map(art => (
            <button
              key={art.id}
              onClick={() => setSelectedId(art.id)}
              className={`w-full text-start flex items-center gap-2.5 px-3 py-2.5 rounded-lg
                          transition-all mb-0.5
                ${selectedId === art.id
                  ? 'bg-eeg-card border border-eeg-border text-eeg-text'
                  : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                }`}
            >
              <span className="text-base leading-none flex-shrink-0">{localize(art.icon)}</span>
              <div className="min-w-0">
                <p className="font-body text-xs font-medium leading-tight truncate">
                  {localize(art.shortLabel)}
                </p>
                <p className="font-mono text-xs opacity-50 leading-tight truncate">
                  {localize(art.frequency.split('(')[0].trim())}
                </p>
              </div>
            </button>
          ))}
        </nav>
      </CollapsiblePanel>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-visible">

        {/* Multi-channel EEG viewer */}
        <div
          className="flex-shrink-0 overflow-visible border-b border-eeg-border"
          style={{ minHeight: `${viewerPanelHeight}px` }}
        >

          {/* Viewer header */}
          <div className="px-5 py-2.5 border-b border-eeg-border flex items-center justify-between bg-eeg-surface">
            <div className="flex items-center gap-3">
              <span className="text-xl">{localize(artifact?.icon)}</span>
              <div>
                <h2 className="font-display font-bold text-base text-eeg-text leading-tight">
                  {localize(artifact?.label)}
                </h2>
                <p className="font-mono text-xs text-eeg-muted">
                  {localize(artifact?.frequency)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-mono px-2.5 py-1 rounded border"
                style={{ color: artifact?.color, borderColor: artifact?.color + '44', background: artifact?.color + '11' }}
              >
                {localize(artifact?.amplitude)}
              </span>
              <div className="text-xs font-mono text-eeg-muted hidden md:block">{localize("Longitudinal bipolar · ")}{localize(channels.length)}{localize(" ch · 8 s")}</div>
            </div>
          </div>

          <EEGViewerControls
            montageId={montageId}
            onMontageChange={setMontageId}
            sensitivity={sensitivity}
            onSensitivityChange={setSensitivity}
            filterConfig={filterConfig}
            onFilterChange={setFilterConfig}
            viewerTheme={viewerTheme}
            onViewerThemeChange={setViewerTheme}
            baseTheme={baseTheme}
            viewerStyle={viewerStyle}
            onViewerStyleChange={setViewerStyle}
          />

          {/* Canvas */}
          <div className="flex flex-col lg:flex-row" style={{ minHeight: `${viewerCanvasHeight}px` }}>
            <div className="flex-1 min-w-0 overflow-visible" style={{ background: effectiveTheme.pageBg, minHeight: `${viewerCanvasHeight}px` }}>
            {generating || channels.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2 text-eeg-muted font-mono text-sm animate-pulse">
                  <span>{localize("Generating trace…")}</span>
                </div>
              </div>
            ) : (
              <EEGViewer
                channels={channels}
                timeAxis={timeAxis}
                isPlaying={false}
                annotations={eventAnnotations}
                sensitivity={sensitivity}
                filterConfig={filterConfig}
                theme={viewerTheme}
                themeOverrides={themeOverrides}
                curveWidth={viewerTheme === 'custom' ? viewerStyle.curveWidth : DEFAULT_VIEWER_STYLE.curveWidth}
                polarity={viewerTheme === 'custom' ? viewerStyle.polarity : DEFAULT_VIEWER_STYLE.polarity}
                channelHeight={dynamicChannelHeight}
                leftLabelWidth={88}
                footerHeight={ARTIFACT_VIEWER_FOOTER_HEIGHT}
                verticalPadding={ARTIFACT_VIEWER_VERTICAL_PADDING}
                highlightedChannels={hot}
                highlightColor={artifact?.color}
                channelScale={(label) => label === 'ECG' ? 0.18 : 1}
                channelGapBefore={(label) => label === 'ECG' ? ECG_CHANNEL_TOP_PADDING : 0}
                chainGap={montageId?.includes('bipolar') ? 18 : 0}
                showChannelAmplitudes
                onHoverChannel={setHoveredChannel}
              />
            )}
            </div>
            <CollapsibleChannelPanel
              channelLabel={hoveredChannel}
              className="border-t lg:border-t-0"
            />
          </div>
        </div>

        {/* Detail panel */}
        <div
          className="relative z-10 flex flex-col bg-eeg-bg"
          style={{ minHeight: `${detailMinHeight}px` }}
        >
          <div className="flex border-b border-eeg-border flex-shrink-0 bg-eeg-surface overflow-x-auto">
            {DETAIL_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id)}
                className={`flex-shrink-0 px-5 py-2.5 text-xs font-mono uppercase tracking-wider
                            border-b-2 transition-all
                  ${detailTab === tab.id
                    ? 'border-eeg-accent text-eeg-accent'
                    : 'border-transparent text-eeg-muted hover:text-eeg-text'
                  }`}
              >
                {t(`artifacts.detail_tabs.${tab.id}`)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {artifact && (
              <DetailContent artifact={artifact} tab={detailTab} hot={hot} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Content ───────────────────────────────────────────────────────────

function DetailContent({ artifact, tab, hot }) {
  useLocale()
  return (
    <div className="px-7 pt-5 pb-12 max-w-3xl">
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Frequency',    artifact.frequency],
              ['Amplitude',    artifact.amplitude],
              ['Morphology',   artifact.morphology],
              ['Distribution', artifact.distribution],
            ].map(([k, v]) => (
              <div key={k} className="card px-4 py-3">
                <p className="text-xs font-mono text-eeg-muted uppercase tracking-widest mb-1">{localize(k)}</p>
                <p className="font-body text-sm text-eeg-text leading-snug">{localize(v)}</p>
              </div>
            ))}
          </div>

          <div>
            <SectionTitle>{localize("Mechanism")}</SectionTitle>
            <p className="font-body text-sm text-eeg-muted leading-relaxed mt-2">
              {localize(artifact.mechanism)}
            </p>
          </div>

          {hot && hot.length > 0 && (
            <div>
              <SectionTitle>{localize("Channels Highlighted in Trace")}</SectionTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hot.map(ch => (
                  <span key={ch}
                    className="text-xs font-mono px-2 py-0.5 rounded border"
                    style={{ color: artifact.color, borderColor: artifact.color + '44', background: artifact.color + '11' }}
                  >
                    {localize(ch)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'identify' && (
        <div>
          <SectionTitle>{localize("How to Identify")}</SectionTitle>
          <p className="font-body text-sm text-eeg-muted mt-2 mb-4 leading-relaxed">{localize("Look for these features in the trace above — channels with the artifact maximum are highlighted and flagged with a dot.")}</p>
          <ul className="space-y-3">
            {artifact.identification.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: artifact.color + '22', color: artifact.color }}
                >
                  {localize(i + 1)}
                </span>
                <p className="font-body text-sm text-eeg-text leading-relaxed">{localize(item)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'differentiate' && (
        <div>
          <SectionTitle>{localize("Differentiation from Pathological Patterns")}</SectionTitle>
          <div className="mt-4 card p-5 border-l-4" style={{ borderLeftColor: artifact.color }}>
            <p className="font-body text-sm text-eeg-text leading-relaxed">
              {localize(artifact.differentiation)}
            </p>
          </div>
          <div className="mt-5">
            <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">{localize("Key Rule")}</p>
            <div className="card p-4 bg-eeg-card">
              <p className="font-mono text-xs text-eeg-accent leading-relaxed">
                {localize(getDifferentiationRule(artifact.id))}
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'reduce' && (
        <div>
          <SectionTitle>{localize("Reduction Strategies")}</SectionTitle>
          <p className="font-body text-sm text-eeg-muted mt-2 mb-4 leading-relaxed">{localize("Apply these in order — start with technical improvements before resorting to filtering, which can alter genuine EEG features.")}</p>
          <ol className="space-y-3">
            {artifact.reduction.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 font-mono text-xs text-eeg-muted w-6 mt-0.5">
                  {localize(String(i + 1).padStart(2, '0'))}
                </span>
                <p className="font-body text-sm text-eeg-text leading-relaxed">{localize(item)}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === 'clinical' && (
        <div>
          <SectionTitle>{localize("Clinical Note")}</SectionTitle>
          <div className="mt-4 card p-6 border-l-4" style={{ borderLeftColor: artifact.color }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{localize(artifact.icon)}</span>
              <p className="font-body text-sm text-eeg-text leading-relaxed">
                {localize(artifact.clinicalNote)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  useLocale()
  return (
    <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted">
      {localize(children)}
    </p>
  )
}

function getDifferentiationRule(id) {
  const rules = {
    eye_blink:      'Blink: BILATERAL SYMMETRIC, frontopolar maximum, no phase reversal. Epileptiform: field across multiple channels, phase reversal in bipolar montage.',
    lateral_eye:    'OPPOSITE POLARITY at Fp1 vs Fp2 = eye movement. SAME POLARITY at Fp1 and Fp2 = blink. Frontal EDs: no systematic mirror-opposite relationship.',
    roving_eye:     'Roving eye movement: very slow smooth wandering frontal drift, often mixed symmetric vertical plus mirror-opposite horizontal components. FIRDA or ictal rhythmic delta has a cerebral field and is not locked to visible eye drift.',
    nystagmus:      'Nystagmus: repetitive sawtooth slow phase plus fast reset, frontopolar/frontotemporal maximum, mirror-opposite between sides. Cerebral rhythmic activity has a physiologic field and is not time-locked to eye oscillation.',
    muscle:         'EMG artifact: high-frequency (>30 Hz), temporal maximum, no coherent field. Spikes: sharply contoured with field, < 70 ms, propagate across channels.',
    chewing:        'Chewing: rhythmic HIGH-FREQUENCY BURSTS at temporal chains at 1–2 Hz. Ictal activity: may start focally but has lower-frequency cerebral field; video correlation is key.',
    tremor:         'Tremor: regular 4-6 Hz movement rhythm with EMG texture, often side-predominant and video-locked. Cerebral rhythmic activity should have a physiologic field and not be strictly tied to visible tremor.',
    shiver:         'Shiver: rhythmic tremulous EMG bursts, usually 4-10 Hz, with high-frequency texture and no coherent cerebral field. Filter effect: low-pass filters may smooth the EMG and leave a misleading rhythmic envelope; high-pass filters do not remove the bursts.',
    powerline:      'Powerline: exact 50 Hz in this demo, perfectly sinusoidal, strongest in channels sharing the bad electrode. Genuine HFOs are brief, variable, and not a continuous mains-locked sine wave.',
    electrode_pop:  'Pop: SINGLE CHANNEL, no field, long DC-recovery tail, no after-going slow wave. Genuine spike: FIELD in adjacent channels, appropriate gradient, followed by slow wave.',
    ecg:            'ECG artifact: phase-locked to simultaneous ECG, temporal-maximum. GPDs: NOT locked to ECG, variable morphology, not perfectly regular. Use simultaneous ECG channel.',
    sweat:          'Sweat: INCOHERENT phase across channels, removed by HP filter. Cerebral delta: COHERENT bilateral distribution, not removed by HP filter (genuine signal).',
    glossokinetic:  'Glossokinetic: stops IMMEDIATELY when tongue is held still. FIRDA: persists regardless of tongue position, correlates with encephalopathy, not oral movement.',
    respiration:    'Respiration: smooth low-frequency drift phase-locked to breathing markers, often subtle in bipolar montage. Cerebral slow activity has a physiologic field and should not remain locked to inspiration/expiration.',
    ventilator:     'Ventilator: PERFECTLY REGULAR, stereotyped every cycle, generalized. GPDs: inter-discharge interval variability, evolving morphology, may correlate with clinical state changes.',
    photomyogenic:  'Photomyogenic: FRONTOPOLAR only, EMG morphology, starts early after the flash (~40-70 ms). PPR (photoparoxysmal): OCCIPITAL then GENERALISED spike-wave, cerebral morphology, may outlast stimulation.',
  }
  return rules[id] ?? 'Apply standard artifact identification criteria: distribution, morphology, reactivity.'
}
