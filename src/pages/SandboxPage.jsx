import React, { useState, useMemo, useCallback } from 'react'
import { useTranslation }         from 'react-i18next'
import { useEEGStore }            from '@/store/eegStore'
import { useAnnotationStore, ANNOTATION_LABELS } from '@/store/annotationStore'
import { useEEGSignal }           from '@/hooks/useEEGSignal'
import { useKeyboardShortcuts }   from '@/hooks/useKeyboardShortcuts'
import EEGViewer                  from '@/components/eeg/EEGViewer'
import SandboxControls            from '@/components/eeg/SandboxControls'
import SpectrumViewer             from '@/components/eeg/SpectrumViewer'
import SpectrogramViewer          from '@/components/eeg/SpectrogramViewer'
import ScalpTopoMap               from '@/components/eeg/ScalpTopoMap'
import FilterControls             from '@/components/eeg/FilterControls'
import KeyboardHelpOverlay        from '@/components/ui/KeyboardHelpOverlay'

const PANELS  = ['traces', 'spectrum', 'spectrogram', 'topo']
const PATTERNS = ['normal_awake','normal_drowsy','normal_sleep','absence','focal_slowing','burst_suppression']

export default function SandboxPage() {
  const { t } = useTranslation()

  // ── EEG state ───────────────────────────────────────────────────────────
  const {
    montageId, setMontage,
    pattern,   setPattern,
    amplitude, setAmplitude,
    noiseLevel,setNoiseLevel,
    sweepSpeed,setSweepSpeed,
    isPlaying, togglePlay,
    pendingSpike, triggerSpike,
    pendingArtifact, triggerArtifact,
    clearPending,
    eyesClosed, toggleEyes,
    blinksEnabled, toggleBlinks,
    blinkRate, setBlinkRate,
  } = useEEGStore()

  // ── UI state ────────────────────────────────────────────────────────────
  const [activePanel,    setActivePanel]    = useState('traces')
  const [specChannel,    setSpecChannel]    = useState('O2')
  const [filterConfig,   setFilterConfig]   = useState({ hp: 0.5, lp: 70, notch: 50 })
  const [annotateMode,   setAnnotateMode]   = useState(false)
  const [activeAnnLabel, setActiveAnnLabel] = useState(ANNOTATION_LABELS[0])
  const [showHelp,       setShowHelp]       = useState(false)

  // ── Annotations ─────────────────────────────────────────────────────────
  const { annotations, addAnnotation, removeAnnotation, clearAnnotations } = useAnnotationStore()

  // ── Signal ──────────────────────────────────────────────────────────────
  const { channels, timeAxis, isReady, windowStart } = useEEGSignal({
    montageId, pattern, amplitude, noiseLevel, sweepSpeed,
    isPlaying, pendingSpike, pendingArtifact,
    onClearPending: clearPending,
    eyesClosed, blinksEnabled, blinkRate,
  })

  const specSignal = useMemo(() => {
    const ch = channels.find(c => c.label.startsWith(specChannel))
      ?? channels[Math.floor(channels.length / 2)]
    return ch?.data ?? null
  }, [channels, specChannel])

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

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useKeyboardShortcuts({
    ' ':           togglePlay,
    's':           triggerSpike,
    'a':           triggerArtifact,
    '+':           () => setAmplitude(v => Math.min(200, v + 10)),
    '=':           () => setAmplitude(v => Math.min(200, v + 10)),
    '-':           () => setAmplitude(v => Math.max(10,  v - 10)),
    'arrowright':  () => setSweepSpeed(v => Math.min(60, v + 5)),
    'arrowleft':   () => setSweepSpeed(v => Math.max(5,  v - 5)),
    '1':           () => setPattern(PATTERNS[0]),
    '2':           () => setPattern(PATTERNS[1]),
    '3':           () => setPattern(PATTERNS[2]),
    '4':           () => setPattern(PATTERNS[3]),
    '5':           () => setPattern(PATTERNS[4]),
    '6':           () => setPattern(PATTERNS[5]),
    'e':           toggleEyes,
    'b':           toggleBlinks,
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
                <div className="relative eeg-paper">
                  <EEGViewer
                    channels={channels}
                    timeAxis={timeAxis}
                    gain={100 / amplitude}
                    isPlaying={isPlaying}
                    filterConfig={filterConfig}
                    annotations={annotations}
                    windowStart={windowStart}
                    onAnnotate={annotateMode ? handleAnnotate : null}
                    className="w-full"
                  />
                  {isPlaying && !annotateMode && <div className="scan-line" />}
                </div>
              )}

              {activePanel === 'spectrum' && specSignal && (
                <div className="p-6 flex flex-col gap-6">
                  <ChannelPicker
                    channels={['O2','O1','C3','C4','F3','F4','T3','T4']}
                    active={specChannel}
                    onSelect={setSpecChannel}
                  />
                  <SpectrumViewer signal={specSignal} color="#00FFB0" maxFreq={40} />
                  <div className="card p-4 text-xs font-body text-eeg-muted leading-relaxed">
                    <span className="font-mono text-eeg-accent">Tip: </span>
                    A normal awake occipital channel shows a dominant alpha peak at 8–13 Hz. Switch to Absence pattern to see how the 3 Hz spike-wave discharge shifts spectral power to the delta/theta range.
                  </div>
                </div>
              )}

              {activePanel === 'spectrogram' && specSignal && (
                <div className="p-6 flex flex-col gap-6">
                  <ChannelPicker
                    channels={['O2','O1','C3','C4','F3','T3']}
                    active={specChannel}
                    onSelect={setSpecChannel}
                  />
                  <SpectrogramViewer signal={specSignal} maxFreq={40} label={specChannel} />
                  <SpectrumViewer signal={specSignal} color="#7B5EA7" maxFreq={40} />
                  <div className="card p-4 text-xs font-body text-eeg-muted leading-relaxed">
                    <span className="font-mono text-eeg-accent">Tip: </span>
                    The spectrogram shows time on the x-axis and frequency on the y-axis. Warm colours indicate high power. Press <kbd className="bg-eeg-card border border-eeg-border rounded px-1">S</kbd> to inject a spike and watch the broadband transient appear.
                  </div>
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
                          const pct = Math.min(100, (rms / amplitude) * 100)
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
          montageId={montageId}       onMontageChange={setMontage}
          pattern={pattern}           onPatternChange={setPattern}
          amplitude={amplitude}       onAmplitudeChange={setAmplitude}
          noiseLevel={noiseLevel}     onNoiseLevelChange={setNoiseLevel}
          sweepSpeed={sweepSpeed}     onSweepSpeedChange={setSweepSpeed}
          isPlaying={isPlaying}       onTogglePlay={togglePlay}
          onInjectSpike={triggerSpike}
          onInjectArtifact={triggerArtifact}
          eyesClosed={eyesClosed}     onToggleEyes={toggleEyes}
          blinksEnabled={blinksEnabled} onToggleBlinks={toggleBlinks}
          blinkRate={blinkRate}       onBlinkRateChange={setBlinkRate}
        />
        <div className="border-t border-eeg-border pt-4">
          <FilterControls config={filterConfig} onChange={setFilterConfig} />
        </div>
      </div>

      {/* Keyboard help overlay */}
      {showHelp && <KeyboardHelpOverlay onClose={() => setShowHelp(false)} />}
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
