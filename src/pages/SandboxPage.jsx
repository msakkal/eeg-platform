import React, { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useTranslation }         from 'react-i18next'
import { useEEGStore }            from '@/store/eegStore'
import { useAnnotationStore, ANNOTATION_LABELS } from '@/store/annotationStore'
import { useEEGSignal }           from '@/hooks/useEEGSignal'
import { useKeyboardShortcuts }   from '@/hooks/useKeyboardShortcuts'
import EEGViewer                  from '@/components/eeg/EEGViewer'
import EEGViewerControls, {
  buildViewerThemeOverrides,
  DEFAULT_VIEWER_STYLE,
} from '@/components/eeg/EEGViewerControls'
import { ChannelHoverPanel }      from '@/components/eeg/ChannelHoverMap'
import SandboxControls            from '@/components/eeg/SandboxControls'
import SpectrumViewer             from '@/components/eeg/SpectrumViewer'
import SpectrogramViewer          from '@/components/eeg/SpectrogramViewer'
import ScalpTopoMap               from '@/components/eeg/ScalpTopoMap'
import KeyboardHelpOverlay        from '@/components/ui/KeyboardHelpOverlay'
import { getViewerTheme, DEFAULT_SENSITIVITY, SENSITIVITY_STEPS } from '@/engine/viewerThemes'
import { getPatternMeta }         from '@/engine/patterns'

const PANELS  = ['traces', 'analysis', 'topo']
const PATTERNS = ['normal_awake','normal_drowsy','normal_sleep','normal_rem','absence','focal_slowing','burst_suppression']
const STANDARD_SWEEP_SPEED = 30
const STANDARD_WINDOW_SECONDS = 10
const MIN_SWEEP_SPEED = 5
const MAX_SWEEP_SPEED = 90
const MAX_SWEEP_WINDOW_SECONDS = STANDARD_WINDOW_SECONDS * STANDARD_SWEEP_SPEED / MIN_SWEEP_SPEED

const PATTERN_ANALYSIS = {
  normal_awake: {
    spectrum: 'Posterior channels should show a dominant alpha peak around 8-13 Hz, especially with eyes closed, with lower-amplitude beta and little delta.',
    spectrogram: 'Alpha power should appear as a fairly stable horizontal band near 10 Hz, strongest in occipital/parietal channels.',
  },
  fast_alpha_variant: {
    spectrum: 'A posterior peak around 16–18 Hz should dominate with eyes closed, representing a fast harmonic variant of the posterior dominant rhythm rather than frontal beta.',
    spectrogram: 'Expect a coherent posterior fast-alpha band that waxes and wanes and attenuates with eye opening.',
  },
  mu_rhythm: {
    spectrum: 'Central average-reference channels C3–avg/C4–avg should show a dominant 8–10 Hz peak with much less corresponding posterior power.',
    spectrogram: 'Expect a clearly visible waxing and waning central alpha-range band with arciform cycles rather than a posterior eye-reactive rhythm.',
  },
  lambda_waves: {
    spectrum: 'The eyes-open background should remain low voltage; individual lambda waves are transient and should not create a sustained rhythmic spectral peak.',
    spectrogram: 'Look for irregular, sharply contoured positive transients over O1/O2 during visual scanning, often asymmetric or unilateral, with little central spread.',
  },
  rmtd: {
    spectrum: 'Mid-temporal T7/T8 derivations should show a stable 5–7 Hz theta peak during runs, without progressive frequency or amplitude evolution.',
    spectrogram: 'Expect intermittent, smoothly waxing and waning temporal theta bands with a notched contour, often unilateral or independently bilateral, on a drowsy background.',
  },
  wicket_rhythm: {
    spectrum: 'Temporal derivations should show intermittent 6–11 Hz activity, usually around 8–10 Hz, without a broad after-going slow-wave component.',
    spectrogram: 'Expect brief unilateral or bilateral temporal trains with a stable frequency and arciform morphology; isolated wickets may appear between runs.',
  },
  sreda: {
    spectrum: 'Posterior temporal and parietal derivations should show a prominent, bilateral 5–7 Hz theta peak during the SREDA run without progressive frequency evolution.',
    spectrogram: 'Expect an abruptly appearing, sustained posterior temporoparietal theta band with a sharply contoured onset, stable field, and relatively abrupt offset.',
  },
  small_sharp_spikes: {
    spectrum: 'BETS are isolated low-amplitude transients, so the drowsy theta background should dominate the spectrum without a sustained epileptiform-frequency peak.',
    spectrogram: 'Look for sparse, brief broadband transients over one or both temporal regions during drowsiness, without an after-going slow wave or background disruption.',
  },
  phantom_spike_wave: {
    spectrum: 'Posterior derivations should show brief bursts of approximately 6 Hz activity; the very small spikes add limited broadband power compared with true epileptiform spike-wave.',
    spectrogram: 'Expect clearly visible, short, non-evolving 5–7 Hz posterior bursts during drowsiness with small spikes riding on rounded slow waves. Average reference is selected automatically to display their low amplitude.',
  },
  normal_drowsy: {
    spectrum: 'Posterior alpha/PDR should be largely absent; low-voltage theta and mixed frequencies dominate with slow horizontal roving eye movements frontotemporally.',
    spectrogram: 'Expect attenuated background, slow lateral EOG drifts, intermittent theta, brief central vertex waves, posterior POSTS trains, and sparse low-amplitude temporal BETS without an after-going slow wave.',
  },
  normal_sleep: {
    spectrum: 'N2 should show mixed theta/delta background plus brief sigma power at 12-14 Hz during sleep spindles.',
    spectrogram: 'Look for waxing-waning sigma bursts, large K-complexes, and occasional low-amplitude temporal BETS that leave the N2 background undisturbed.',
  },
  slow_wave_sleep: {
    spectrum: 'Delta power below 4 Hz should dominate, often overwhelming faster background frequencies.',
    spectrogram: 'High-amplitude slow activity should appear as sustained low-frequency power, most prominent below 2 Hz.',
  },
  normal_rem: {
    spectrum: 'REM should show a low-voltage mixed-frequency background dominated by theta, without sustained posterior alpha, spindles, or K-complexes.',
    spectrogram: 'Expect desynchronized mixed-frequency activity with intermittent rapid conjugate eye-movement transients strongest frontotemporally.',
  },
  absence: {
    spectrum: 'A strong rhythmic component near 3 Hz should emerge during the generalized spike-wave run.',
    spectrogram: 'The absence discharge should appear as a time-limited, high-power band around 3 Hz with broadband spike transients.',
  },
  slow_spike_wave: {
    spectrum: 'Power should concentrate around 1.5-2.5 Hz, reflecting slow spike-and-wave complexes.',
    spectrogram: 'Expect repeated slow periodic bursts with intermittent broadband sharp components.',
  },
  polyspike_jme: {
    spectrum: 'Polyspike-wave runs add broadband fast transients plus slower after-going wave power.',
    spectrogram: 'Runs should appear as brief high-energy vertical/broadband bursts, often frontocentral.',
  },
  centrotemporal_spikes: {
    spectrum: 'Interictal spikes add brief broadband power but may not dominate the average spectrum unless frequent.',
    spectrogram: 'Look for isolated sharp broadband events, most visible when viewing centrotemporal channels.',
  },
  temporal_sharps: {
    spectrum: 'Temporal sharp waves create intermittent broadband power over a slower drowsy background.',
    spectrogram: 'Events should appear as isolated broadband transients, best seen in left temporal channels.',
  },
  hypsarrhythmia: {
    spectrum: 'Expect broad, disorganized power across slow and faster frequencies from chaotic high-amplitude activity.',
    spectrogram: 'The spectrogram should look irregular and high-energy, with multifocal spikes appearing as broadband transients.',
  },
  photoparoxysmal: {
    spectrum: 'Photoparoxysmal activity adds rhythmic spike-wave/polyspike-wave power during the response window.',
    spectrogram: 'Expect time-limited bursts with posterior driving plus generalized spike-wave activity.',
  },
  gpds: {
    spectrum: 'Periodic discharges should produce a low-frequency peak near their repetition rate, often around 1 Hz.',
    spectrogram: 'Expect regularly spaced broadband transients on a diffusely slowed background.',
  },
  lpds: {
    spectrum: 'LPDs should add a periodic low-frequency component plus sharp broadband energy, strongest over the involved hemisphere.',
    spectrogram: 'Regular unilateral discharges should appear as repeated broadband events, most visible in left hemisphere channels.',
  },
  triphasic_waves: {
    spectrum: 'Triphasic waves add rhythmic slow power, usually around 1-2 Hz, on an encephalopathic background.',
    spectrogram: 'Expect repeated slow complexes with a broad low-frequency signature and less fast spike energy than epileptiform GPDs.',
  },
  focal_slowing: {
    spectrum: 'The affected region should show excess delta/theta compared with other channels.',
    spectrogram: 'Slow activity should persist or wax and wane focally, most apparent in left temporal channels.',
  },
  firda: {
    spectrum: 'Frontal intermittent rhythmic delta should emphasize low-frequency delta, often around 2-3 Hz during bursts.',
    spectrogram: 'Expect intermittent frontal delta bursts rather than continuous generalized slowing.',
  },
  diffuse_slowing: {
    spectrum: 'Theta and delta power should dominate diffusely, with reduced normal alpha organization.',
    spectrogram: 'Low-frequency power should be broadly sustained across time rather than appearing only as isolated events.',
  },
  breach_rhythm: {
    spectrum: 'Breach rhythm accentuates sharply contoured alpha/beta activity over the skull defect region.',
    spectrogram: 'Expect persistent focal enhancement of faster activity, especially over the left central/temporal region.',
  },
  burst_suppression: {
    spectrum: 'Average power depends on burst density: bursts add broad mixed-frequency power, while suppressions lower total power.',
    spectrogram: 'Alternating high-energy bursts and low-power suppressions should be obvious over time.',
  },
  alpha_coma: {
    spectrum: 'Alpha-range power should dominate but be anteriorly weighted and poorly reactive compared with normal posterior alpha.',
    spectrogram: 'The alpha band should appear relatively monotonous and sustained rather than physiologically waxing and reactive.',
  },
  electrocerebral_silence: {
    spectrum: 'Power should be near the noise floor, without organized physiologic rhythms or cardiac contamination.',
    spectrogram: 'The display should remain low-energy across frequencies, aside from minimal residual noise.',
  },
}

export default function SandboxPage() {
  const { t } = useTranslation()

  // ── EEG state ───────────────────────────────────────────────────────────
  const {
    montageId, setMontage,
    pattern,   setPattern,
    sensitivity, setSensitivity,
    noiseLevel,setNoiseLevel,
    sweepSpeed,setSweepSpeed,
    isPlaying, togglePlay,
    pendingSpike, triggerSpike,
    pendingArtifact, triggerArtifact,
    clearPending,
    eyesClosed, toggleEyes,
    blinksEnabled, toggleBlinks,
    blinkRate, setBlinkRate,
    viewerTheme, setViewerTheme,
    activationProcedure, setActivationProcedure,
  } = useEEGStore()

  const theme = getViewerTheme(viewerTheme)

  // ── UI state ────────────────────────────────────────────────────────────
  const [activePanel,    setActivePanel]    = useState('traces')
  const [specChannel,    setSpecChannel]    = useState('O2')
  const [filterConfig,   setFilterConfig]   = useState({ hp: null, lp: null, notch: null })
  const [annotateMode,   setAnnotateMode]   = useState(false)
  const [activeAnnLabel, setActiveAnnLabel] = useState(ANNOTATION_LABELS[0])
  const [showHelp,       setShowHelp]       = useState(false)
  const [hoveredTraceChannel, setHoveredTraceChannel] = useState(null)
  const [analysisRateHz, setAnalysisRateHz] = useState(12)
  const [viewerStyle, setViewerStyle] = useState(DEFAULT_VIEWER_STYLE)

  const viewerThemeOverrides = useMemo(
    () => viewerTheme === 'custom' ? buildViewerThemeOverrides(viewerStyle) : {},
    [viewerStyle, viewerTheme]
  )
  const effectiveTheme = useMemo(
    () => ({ ...theme, ...viewerThemeOverrides }),
    [theme, viewerThemeOverrides]
  )
  const sweepWindowSecs = STANDARD_WINDOW_SECONDS * STANDARD_SWEEP_SPEED / sweepSpeed
  const effectiveBlinksEnabled = !eyesClosed && blinksEnabled

  // ── Annotations ─────────────────────────────────────────────────────────
  const { annotations, addAnnotation, removeAnnotation, clearAnnotations } = useAnnotationStore()

  // ── Signal ──────────────────────────────────────────────────────────────
  const { channels, timeAxis, isReady, events, windowStart } = useEEGSignal({
    montageId, pattern, noiseLevel, activationProcedure,
    isPlaying, pendingSpike, pendingArtifact,
    onClearPending: clearPending,
    eyesClosed, blinksEnabled: effectiveBlinksEnabled, blinkRate,
    windowSecs: sweepWindowSecs,
    maxWindowSecs: MAX_SWEEP_WINDOW_SECONDS,
  })

  const specSignal = useMemo(() => {
    const ch = channels.find(c => c.label.startsWith(specChannel))
      ?? channels[Math.floor(channels.length / 2)]
    return ch?.data ?? null
  }, [channels, specChannel])
  const analysisRevision = Math.floor(windowStart * analysisRateHz)

  // ── Annotation handler ───────────────────────────────────────────────────
  // Translate the preset id to a display string at creation time (the canvas
  // renderer reads `ann.label` directly, so we resolve it once here).
  const handleAnnotate = useCallback((timeS, channelLabel) => {
    if (!annotateMode) return
    addAnnotation({
      timeS,
      label: t(`annotations.labels.${activeAnnLabel.id}`),
      color: activeAnnLabel.color,
      channelLabel,
    })
  }, [annotateMode, activeAnnLabel, addAnnotation, t])

  // ── Sensitivity stepping (keyboard) ──────────────────────────────────────
  // dir = -1 steps to a smaller µV/mm value → more amplification → larger
  // trace; dir = +1 does the reverse.
  const stepSensitivity = useCallback((dir) => {
    setSensitivity(cur => {
      let i = SENSITIVITY_STEPS.indexOf(cur)
      if (i < 0) i = SENSITIVITY_STEPS.indexOf(DEFAULT_SENSITIVITY)
      const next = Math.min(SENSITIVITY_STEPS.length - 1, Math.max(0, i + dir))
      return SENSITIVITY_STEPS[next]
    })
  }, [setSensitivity])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useKeyboardShortcuts({
    ' ':           togglePlay,
    's':           triggerSpike,
    'a':           triggerArtifact,
    '+':           () => stepSensitivity(-1),
    '=':           () => stepSensitivity(-1),
    '-':           () => stepSensitivity(1),
    'arrowright':  () => setSweepSpeed(v => Math.min(MAX_SWEEP_SPEED, v + 5)),
    'arrowleft':   () => setSweepSpeed(v => Math.max(MIN_SWEEP_SPEED,  v - 5)),
    '1':           () => setPattern(PATTERNS[0]),
    '2':           () => setPattern(PATTERNS[1]),
    '3':           () => setPattern(PATTERNS[2]),
    '4':           () => setPattern(PATTERNS[3]),
    '5':           () => setPattern(PATTERNS[4]),
    '6':           () => setPattern(PATTERNS[5]),
    '7':           () => setPattern(PATTERNS[6]),
    'e':           toggleEyes,
    'b':           () => {
      if (!eyesClosed) toggleBlinks()
    },
    '?':           () => setShowHelp(v => !v),
  })

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header bar */}
        <div className="px-4 py-2.5 border-b border-eeg-border flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-base text-eeg-text leading-tight">{t('sandbox.title')}</h1>
          </div>

          {/* Panel tabs */}
          <div className="flex bg-eeg-card border border-eeg-border rounded-lg overflow-hidden">
            {PANELS.map(p => (
              <button key={p} onClick={() => setActivePanel(p)}
                className={`px-3 py-1.5 text-xs font-mono capitalize transition-colors
                  ${activePanel === p ? 'bg-eeg-accent bg-opacity-20 text-eeg-accent' : 'text-eeg-muted hover:text-eeg-text'}`}>
                {p}
              </button>
            ))}
          </div>

          {/* Annotate toggle */}
          <button
            onClick={() => setAnnotateMode(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all
              ${annotateMode
                ? 'border-yellow-500 text-yellow-400 bg-yellow-500 bg-opacity-10'
                : 'border-eeg-border text-eeg-muted hover:text-eeg-text'
              }`}
            title="Click on the EEG trace to place annotations"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            {annotateMode ? 'Marking' : 'Mark'}
          </button>

          {/* Annotation label picker (only when in annotate mode) */}
          {annotateMode && (
            <div className="flex gap-1">
              {ANNOTATION_LABELS.slice(0, 4).map(al => {
                const label = t(`annotations.labels.${al.id}`)
                const isActive = activeAnnLabel.id === al.id
                return (
                  <button key={al.id}
                    onClick={() => setActiveAnnLabel(al)}
                    title={label}
                    className={`text-xs font-mono px-2 py-1 rounded border transition-all
                      ${isActive
                        ? 'text-eeg-text border-opacity-60'
                        : 'border-eeg-border text-eeg-muted hover:text-eeg-text'
                      }`}
                    style={isActive
                      ? { borderColor: al.color, background: al.color + '22', color: al.color }
                      : {}}
                  >
                    {al.key}:{label.split(' ')[0]}
                  </button>
                )
              })}
              {annotations.length > 0 && (
                <button onClick={clearAnnotations}
                  className="text-xs font-mono px-2 py-1 rounded border border-eeg-border text-eeg-muted hover:text-red-400 hover:border-red-400 transition-all">
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Live badge */}
          <div className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full border flex-shrink-0
            ${isPlaying
              ? 'text-eeg-signal border-eeg-signal border-opacity-40 bg-eeg-signal bg-opacity-10'
              : 'text-eeg-muted border-eeg-border'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPlaying ? 'bg-eeg-signal animate-pulse' : 'bg-eeg-muted'}`} />
            {isPlaying ? 'LIVE' : 'PAUSED'}
          </div>

          {/* Help */}
          <button onClick={() => setShowHelp(v => !v)}
            className="text-xs font-mono text-eeg-muted hover:text-eeg-text border border-eeg-border rounded px-2 py-1 transition-colors">
            ?
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {!isReady ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-eeg-muted font-mono text-sm animate-pulse">{t('common.loading')}</div>
            </div>
          ) : (
            <>
              {activePanel === 'traces' && (
                <TracePanel
                  channels={channels}
                  timeAxis={timeAxis}
                  sensitivity={sensitivity}
                  filterConfig={filterConfig}
                  annotations={annotations}
                  events={events}
                  windowStart={windowStart}
                  annotateMode={annotateMode}
                  onAnnotate={handleAnnotate}
                  hoveredTraceChannel={hoveredTraceChannel}
                  onHoverChannel={setHoveredTraceChannel}
                  montageId={montageId}
                  onMontageChange={setMontage}
                  noiseLevel={noiseLevel}
                  onNoiseLevelChange={setNoiseLevel}
                  sweepSpeed={sweepSpeed}
                  onSweepSpeedChange={setSweepSpeed}
                  eyesClosed={eyesClosed}
                  onEyesClosedChange={value => {
                    if (value !== eyesClosed) toggleEyes()
                  }}
                  blinksEnabled={effectiveBlinksEnabled}
                  onBlinksEnabledChange={value => {
                    if (eyesClosed) return
                    if (value !== blinksEnabled) toggleBlinks()
                  }}
                  blinkRate={blinkRate}
                  onBlinkRateChange={setBlinkRate}
                  onSensitivityChange={setSensitivity}
                  onFilterChange={setFilterConfig}
                  viewerTheme={viewerTheme}
                  onViewerThemeChange={setViewerTheme}
                  theme={theme}
                  effectiveTheme={effectiveTheme}
                  viewerThemeOverrides={viewerThemeOverrides}
                  viewerStyle={viewerStyle}
                  onViewerStyleChange={setViewerStyle}
                  activationProcedure={activationProcedure}
                  onActivationProcedureChange={setActivationProcedure}
                  pattern={pattern}
                />
              )}

              {activePanel === 'analysis' && specSignal && (
                <div className="p-6 flex flex-col gap-6">
                  <AnalysisPanelControls
                    channels={['O2','O1','C3','C4','F3','F4','T7','T8']}
                    activeChannel={specChannel}
                    onChannelChange={setSpecChannel}
                    updateRateHz={analysisRateHz}
                    onUpdateRateChange={setAnalysisRateHz}
                  />
                  <SpectrogramViewer signal={specSignal} revision={analysisRevision} maxFreq={40} label={specChannel} />
                  <SpectrumViewer signal={specSignal} revision={analysisRevision} color="#00FFB0" maxFreq={40} />
                  <PatternAnalysisSummary pattern={pattern} channel={specChannel} />
                  {/*
                    <span className="font-mono text-eeg-accent">Tip: </span>
                    A normal awake occipital channel shows a dominant alpha peak at 8–13 Hz. Switch to Absence pattern to see how the 3 Hz spike-wave discharge shifts spectral power to the delta/theta range.
                  */}
                </div>
              )}

              {activePanel === 'topo' && (
                <div className="p-8 flex flex-col items-center gap-8">
                  <div className="text-center">
                    <p className="font-body text-sm text-eeg-muted max-w-md">
                      Real-time scalp topographic map showing RMS amplitude distribution across electrode positions. Colour maps from blue (low) to red (high). Update the pattern or inject events to see the topography change.
                    </p>
                  </div>
                  <div className="flex gap-12 items-start">
                    <ScalpTopoMap channels={channels} size={260} />
                    {/* Channel amplitude table */}
                    <div className="card p-4 min-w-[180px]">
                      <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">RMS µV</p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {channels.slice(0, 18).map(ch => {
                          const rms = ch.data?.length
                            ? Math.sqrt(ch.data.reduce((s, v) => s + v*v, 0) / ch.data.length)
                            : 0
                          // Bar scaled against a 60 µV full-scale reference
                          // (a healthy posterior channel sits well within it).
                          const pct = Math.min(100, (rms / 60) * 100)
                          return (
                            <div key={ch.label} className="flex items-center gap-2">
                              <span className="font-mono text-xs text-eeg-muted w-16 flex-shrink-0">{ch.label}</span>
                              <div className="flex-1 h-1.5 bg-eeg-border rounded-full overflow-hidden">
                                <div className="h-full bg-eeg-accent rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <span className="font-mono text-xs text-eeg-muted w-10 text-right">
                                {rms.toFixed(0)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right controls panel ────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 border-l border-eeg-border bg-eeg-surface overflow-y-auto p-4 flex flex-col gap-4">
        <SandboxControls
          pattern={pattern}           onPatternChange={setPattern}
          isPlaying={isPlaying}       onTogglePlay={togglePlay}
          onInjectSpike={triggerSpike}
          onInjectArtifact={triggerArtifact}
        />
      </div>

      {/* Keyboard help overlay */}
      {showHelp && <KeyboardHelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  )
}

const TracePanel = memo(function TracePanel({
  channels,
  timeAxis,
  sensitivity,
  filterConfig,
  annotations,
  events,
  windowStart,
  annotateMode,
  onAnnotate,
  hoveredTraceChannel,
  onHoverChannel,
  montageId,
  onMontageChange,
  noiseLevel,
  onNoiseLevelChange,
  sweepSpeed,
  onSweepSpeedChange,
  eyesClosed,
  onEyesClosedChange,
  blinksEnabled,
  onBlinksEnabledChange,
  blinkRate,
  onBlinkRateChange,
  onSensitivityChange,
  onFilterChange,
  viewerTheme,
  onViewerThemeChange,
  theme,
  effectiveTheme,
  viewerThemeOverrides,
  viewerStyle,
  onViewerStyleChange,
  activationProcedure,
  onActivationProcedureChange,
  pattern,
}) {
  const [hoverPanelOpen, setHoverPanelOpen] = useState(true)
  const [hoveredEvent, setHoveredEvent] = useState(null)

  return (
    <div className="flex flex-col lg:flex-row min-h-full" style={{ background: effectiveTheme.pageBg }}>
      <div className="relative flex-1 min-w-0 overflow-hidden">
        <ViewerTopBar
          montageId={montageId}
          onMontageChange={onMontageChange}
          sensitivity={sensitivity}
          onSensitivityChange={onSensitivityChange}
          noiseLevel={noiseLevel}
          onNoiseLevelChange={onNoiseLevelChange}
          sweepSpeed={sweepSpeed}
          onSweepSpeedChange={onSweepSpeedChange}
          eyesClosed={eyesClosed}
          onEyesClosedChange={onEyesClosedChange}
          blinksEnabled={blinksEnabled}
          onBlinksEnabledChange={onBlinksEnabledChange}
          blinkRate={blinkRate}
          onBlinkRateChange={onBlinkRateChange}
          filterConfig={filterConfig}
          onFilterChange={onFilterChange}
          viewerTheme={viewerTheme}
          onViewerThemeChange={onViewerThemeChange}
          baseTheme={theme}
          viewerStyle={viewerStyle}
          onViewerStyleChange={onViewerStyleChange}
          activationProcedure={activationProcedure}
          onActivationProcedureChange={onActivationProcedureChange}
          pattern={pattern}
        />
        <EEGViewer
          channels={channels}
          timeAxis={timeAxis}
          sensitivity={sensitivity}
          filterConfig={filterConfig}
          annotations={annotations}
          eventHighlight={hoveredEvent}
          windowStart={windowStart}
          onAnnotate={annotateMode ? onAnnotate : null}
          onHoverChannel={onHoverChannel}
          theme={viewerTheme}
          themeOverrides={viewerThemeOverrides}
          curveWidth={viewerTheme === 'custom' ? viewerStyle.curveWidth : DEFAULT_VIEWER_STYLE.curveWidth}
          polarity={viewerTheme === 'custom' ? viewerStyle.polarity : DEFAULT_VIEWER_STYLE.polarity}
          chainGap={montageId?.includes('bipolar') ? 18 : 0}
          className="w-full"
        />
      </div>
      <div className={`lg:flex-shrink-0 border-eeg-border bg-eeg-surface flex flex-col min-h-0 ${hoverPanelOpen ? 'lg:w-52 lg:border-l' : 'lg:w-12 lg:border-l'}`}>
        <button
          type="button"
          onClick={() => setHoverPanelOpen(v => !v)}
          className={`w-full h-9 flex items-center justify-center border-b border-eeg-border text-eeg-muted hover:text-eeg-text transition-colors
            ${hoverPanelOpen ? '' : 'bg-eeg-card bg-opacity-60'}`}
          title={hoverPanelOpen ? 'Collapse channel view' : 'Expand channel view'}
          aria-label={hoverPanelOpen ? 'Collapse channel view' : 'Expand channel view'}
        >
          <span className="w-6 h-6 rounded border border-eeg-border flex items-center justify-center font-mono text-xs">
            {hoverPanelOpen ? '>' : '<'}
          </span>
        </button>
        {hoverPanelOpen && (
          <>
          <ChannelHoverPanel
            channelLabel={hoveredTraceChannel}
            className="flex-shrink-0"
          />
          <SandboxEventList
            events={events}
            windowStart={windowStart}
            duration={timeAxis[timeAxis.length - 1] || 10}
            onHoverEvent={setHoveredEvent}
          />
          </>
        )}
        {!hoverPanelOpen && (
          <div className="h-[calc(100%-2.25rem)] flex items-center justify-center">
            <div className="rotate-90 whitespace-nowrap text-[10px] font-mono uppercase tracking-widest text-eeg-muted">
              Channel
            </div>
          </div>
        )}
      </div>
    </div>
  )
}, (prev, next) => (
  prev.channels === next.channels &&
  prev.timeAxis === next.timeAxis &&
  prev.sensitivity === next.sensitivity &&
  prev.filterConfig === next.filterConfig &&
  prev.annotations === next.annotations &&
  prev.events === next.events &&
  prev.windowStart === next.windowStart &&
  prev.annotateMode === next.annotateMode &&
  prev.hoveredTraceChannel === next.hoveredTraceChannel &&
  prev.montageId === next.montageId &&
  prev.noiseLevel === next.noiseLevel &&
  prev.sweepSpeed === next.sweepSpeed &&
  prev.eyesClosed === next.eyesClosed &&
  prev.blinksEnabled === next.blinksEnabled &&
  prev.blinkRate === next.blinkRate &&
  prev.viewerTheme === next.viewerTheme &&
  prev.theme === next.theme &&
  prev.effectiveTheme === next.effectiveTheme &&
  prev.viewerThemeOverrides === next.viewerThemeOverrides &&
  prev.viewerStyle === next.viewerStyle
))

function SandboxEventList({ events = [], windowStart = 0, duration = 10, onHoverEvent = null }) {
  const [flashEventIds, setFlashEventIds] = useState(() => new Set())
  const knownEventIdsRef = useRef(new Set())
  const initialisedRef = useRef(false)
  const flashTimeoutsRef = useRef(new Map())
  const windowEnd = windowStart + duration
  const visibleEvents = useMemo(() => (
    events
      .filter(event => event.t >= windowStart && event.t <= windowEnd)
      .slice()
      .sort((a, b) => b.t - a.t)
      .slice(0, 12)
  ), [events, windowStart, windowEnd])

  useEffect(() => {
    const currentIds = new Set(events.map(event => event.id))
    if (!initialisedRef.current) {
      knownEventIdsRef.current = currentIds
      initialisedRef.current = true
      return
    }

    const newIds = events
      .map(event => event.id)
      .filter(id => !knownEventIdsRef.current.has(id))

    knownEventIdsRef.current = currentIds
    if (newIds.length === 0) return

    setFlashEventIds(current => {
      const next = new Set(current)
      newIds.forEach(id => next.add(id))
      return next
    })

    newIds.forEach(id => {
      const existing = flashTimeoutsRef.current.get(id)
      if (existing) clearTimeout(existing)
      const timeout = setTimeout(() => {
        flashTimeoutsRef.current.delete(id)
        setFlashEventIds(current => {
          const next = new Set(current)
          next.delete(id)
          return next
        })
      }, 950)
      flashTimeoutsRef.current.set(id, timeout)
    })
  }, [events])

  useEffect(() => () => {
    flashTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    flashTimeoutsRef.current.clear()
  }, [])

  const colorFor = (type) => {
    if (type === 'blink') return '#66AAFF'
    if (type === 'saccade') return '#88CCFF'
    if (type === 'rapid_eye_movement') return '#C084FC'
    if (type === 'mu_rhythm') return '#7FFFD4'
    if (type === 'lambda_wave') return '#A7F3D0'
    if (type === 'rmtd') return '#67E8F9'
    if (type === 'hyperventilation') return '#67E8F9'
    if (type === 'photic_stimulation') return '#FDE047'
    if (type === 'photomyogenic_response') return '#FB923C'
    if (type === 'manual_spike') return '#FF6B6B'
    if (type === 'manual_artifact') return '#FFAA44'
    if (type === 'sharp_wave' || type === 'centrotemporal_spike') return '#FF6B6B'
    if (type === 'multifocal_spike' || type === 'polyspike') return '#FF4FA3'
    if (type === 'spike_wave' || type === 'slow_spike_wave') return '#D66BFF'
    if (type === 'triphasic_wave') return '#FFB347'
    if (type === 'gpd' || type === 'lpd') return '#FFD166'
    if (type === 'photoparoxysmal') return '#7DE3FF'
    if (type === 'burst') return '#F97316'
    return '#00FFB0'
  }

  const durationFor = (type) => {
    if (type === 'blink') return 0.38
    if (type === 'saccade') return 0.16
    if (type === 'rapid_eye_movement') return 0.28
    if (type === 'mu_rhythm') return 3.0
    if (type === 'lambda_wave') return 0.15
    if (type === 'rmtd') return 3.0
    if (type === 'hyperventilation') return 5.0
    if (type === 'photic_stimulation' || type === 'photomyogenic_response') return 1.0
    if (type === 'sleep_spindle') return 1.0
    if (type === 'k_complex') return 1.0
    if (type === 'vertex_wave') return 0.25
    if (type === 'posts') return 0.85
    if (type === 'burst') return 1.0
    if (type === 'manual_artifact') return 0.50
    if (type === 'spike_wave' || type === 'slow_spike_wave') return 0.34
    if (type === 'triphasic_wave' || type === 'gpd' || type === 'lpd') return 0.36
    return 0.20
  }

  const highlightFor = (event, color) => ({
    id: event.id,
    timeS: event.t,
    durationS: event.durationS ?? durationFor(event.type),
    color,
  })

  return (
    <div className="border-t border-eeg-border px-3 py-3 flex-1 min-h-0 overflow-hidden">
      <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-2">
        Event list
      </p>
      {visibleEvents.length === 0 ? (
        <div className="h-full min-h-[96px] flex items-center justify-center text-center">
          <p className="text-[10px] font-mono text-eeg-muted leading-relaxed">
            No visible events in this sweep window.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto pr-1 max-h-full">
          {visibleEvents.map(event => {
            const color = colorFor(event.type)
            const isFlashing = flashEventIds.has(event.id)
            return (
              <div
                key={event.id}
                tabIndex={0}
                onMouseEnter={() => onHoverEvent?.(highlightFor(event, color))}
                onMouseLeave={() => onHoverEvent?.(null)}
                onFocus={() => onHoverEvent?.(highlightFor(event, color))}
                onBlur={() => onHoverEvent?.(null)}
                className={`rounded border border-eeg-border bg-eeg-card bg-opacity-60 px-2 py-1.5 cursor-default outline-none hover:border-opacity-100 focus:border-opacity-100 ${isFlashing ? 'sandbox-event-row-flash' : ''}`}
                style={{ '--event-color': color }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="font-mono text-[10px] text-eeg-muted flex-shrink-0">
                    {event.t.toFixed(2)}s
                  </span>
                  <span className="font-body text-xs text-eeg-text truncate">
                    {event.label}
                  </span>
                </div>
                {event.detail && (
                  <p className="font-mono text-[9px] text-eeg-muted truncate mt-0.5 pl-4">
                    {event.detail}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ViewerTopBar({
  montageId,
  onMontageChange,
  sensitivity,
  onSensitivityChange,
  noiseLevel,
  onNoiseLevelChange,
  sweepSpeed,
  onSweepSpeedChange,
  eyesClosed,
  onEyesClosedChange,
  blinksEnabled,
  onBlinksEnabledChange,
  blinkRate,
  onBlinkRateChange,
  filterConfig,
  onFilterChange,
  viewerTheme,
  onViewerThemeChange,
  baseTheme,
  viewerStyle,
  onViewerStyleChange,
  activationProcedure,
  onActivationProcedureChange,
  pattern,
}) {
  return (
    <EEGViewerControls
      montageId={montageId}
      onMontageChange={onMontageChange}
      sensitivity={sensitivity}
      onSensitivityChange={onSensitivityChange}
      noiseLevel={noiseLevel}
      onNoiseLevelChange={onNoiseLevelChange}
      sweepSpeed={sweepSpeed}
      onSweepSpeedChange={onSweepSpeedChange}
      eyesClosed={eyesClosed}
      onEyesClosedChange={onEyesClosedChange}
      blinksEnabled={blinksEnabled}
      onBlinksEnabledChange={onBlinksEnabledChange}
      blinkRate={blinkRate}
      onBlinkRateChange={onBlinkRateChange}
      filterConfig={filterConfig}
      onFilterChange={onFilterChange}
      viewerTheme={viewerTheme}
      onViewerThemeChange={onViewerThemeChange}
      baseTheme={baseTheme}
      viewerStyle={viewerStyle}
      onViewerStyleChange={onViewerStyleChange}
      activationProcedure={activationProcedure}
      onActivationProcedureChange={onActivationProcedureChange}
      pattern={pattern}
    />
  )
}

function ToolbarRange({ label, value, min, max, step, unit, onChange, wide = false, disabled = false }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'w-40' : 'w-28'} ${disabled ? 'opacity-50' : ''}`}>
      <span className="text-[10px] font-mono uppercase tracking-widest text-eeg-muted">
        {label} <span className="text-eeg-accent">{Number(value).toFixed(step < 1 ? 2 : 0)}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        disabled={disabled}
        className="h-8 w-full accent-eeg-accent disabled:cursor-not-allowed"
      />
    </label>
  )
}

function PatternAnalysisSummary({ pattern, channel }) {
  const meta = getPatternMeta(pattern)
  const analysis = PATTERN_ANALYSIS[pattern] ?? {
    spectrum: 'Compare the dominant frequency bands with the expected background rhythm and any generated events for this pattern.',
    spectrogram: 'Look for whether power is sustained, intermittent, focal, or event-locked over time.',
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-eeg-muted mb-1">
            Current pattern analysis
          </p>
          <h2 className="font-display text-sm font-semibold text-eeg-text truncate">
            {meta?.label ?? pattern}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {meta?.groupLabel && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded border"
              style={{
                color: meta.color,
                borderColor: `${meta.color}66`,
                background: `${meta.color}18`,
              }}
            >
              {meta.groupLabel}
            </span>
          )}
          <span className="text-[10px] font-mono text-eeg-muted">
            {channel}
          </span>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-eeg-accent mb-1">
            Spectrum
          </p>
          <p className="text-xs font-body text-eeg-muted leading-relaxed">
            {analysis.spectrum}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-eeg-accent mb-1">
            Spectrogram
          </p>
          <p className="text-xs font-body text-eeg-muted leading-relaxed">
            {analysis.spectrogram}
          </p>
        </div>
      </div>
    </div>
  )
}

function AnalysisPanelControls({
  channels,
  activeChannel,
  onChannelChange,
  updateRateHz,
  onUpdateRateChange,
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <ChannelPicker
        channels={channels}
        active={activeChannel}
        onSelect={onChannelChange}
      />
      <ToolbarRange
        label="Update"
        value={updateRateHz}
        min={1}
        max={24}
        step={1}
        unit="/s"
        onChange={onUpdateRateChange}
      />
    </div>
  )
}

function ChannelPicker({ channels, active, onSelect }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-mono text-eeg-muted">Channel:</span>
      {channels.map(ch => (
        <button key={ch} onClick={() => onSelect(ch)}
          className={`text-xs font-mono px-2 py-1 rounded border transition-all
            ${active === ch
              ? 'border-eeg-accent text-eeg-accent bg-eeg-accent bg-opacity-10'
              : 'border-eeg-border text-eeg-muted hover:text-eeg-text'
            }`}>
          {ch}
        </button>
      ))}
    </div>
  )
}
