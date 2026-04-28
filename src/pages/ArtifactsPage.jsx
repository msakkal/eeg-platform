import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ARTIFACT_CATALOGUE, DEMO_CHANNELS } from '@/engine/artifacts'
import { makeTimeAxis, SAMPLE_RATE } from '@/engine/signalGenerator'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_H    = 38
const LABEL_W      = 88
const HEADER_H     = 24        // event-tick band at top of plot
const FOOTER_H     = 22        // time-axis band at bottom of plot
const SIGNAL_COLOR = '#00FFB0'
const MAJOR_GRID   = 'rgba(0,212,255,0.18)'
const MINOR_GRID   = 'rgba(0,212,255,0.05)'
const BASELINE_COL = 'rgba(0,212,255,0.07)'
const AXIS_COLOR   = 'rgba(0,212,255,0.30)'
const LABEL_COLOR  = '#5A6A82'
const BG_PAPER     = '#0C1220'

// Tabs within the detail panel
const DETAIL_TABS = [
  { id: 'overview',      label: 'Overview'       },
  { id: 'identify',      label: 'Identification' },
  { id: 'differentiate', label: 'Differentiate'  },
  { id: 'reduce',        label: 'Reduction'      },
  { id: 'clinical',      label: 'Clinical Note'  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArtifactsPage() {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState(ARTIFACT_CATALOGUE[0].id)
  const [detailTab,  setDetailTab]  = useState('overview')
  const [viewState,  setViewState]  = useState({ channels: [], events: [], hot: [] })
  const [generating, setGenerating] = useState(false)
  const [filter,     setFilter]     = useState('all')
  const [normalise,  setNormalise]  = useState('global')   // 'global' | 'per-channel'

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

  useEffect(() => { setDetailTab('overview') }, [selectedId])

  const timeAxis = useMemo(() => makeTimeAxis(8 * SAMPLE_RATE, SAMPLE_RATE), [])

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
    photomyogenic:  'ocular',
    muscle:         'muscular',
    chewing:        'muscular',
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

  const { channels, events, hot } = viewState

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 border-r border-eeg-border flex flex-col overflow-hidden">

        <div className="px-4 py-4 border-b border-eeg-border">
          <p className="font-display font-bold text-sm text-eeg-text">Artifacts</p>
          <p className="font-mono text-xs text-eeg-muted mt-0.5">
            {ARTIFACT_CATALOGUE.length} patterns
          </p>
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
              {fg.label}
            </button>
          ))}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {filtered.map(art => (
            <button
              key={art.id}
              onClick={() => setSelectedId(art.id)}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg
                          transition-all mb-0.5
                ${selectedId === art.id
                  ? 'bg-eeg-card border border-eeg-border text-eeg-text'
                  : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                }`}
            >
              <span className="text-base leading-none flex-shrink-0">{art.icon}</span>
              <div className="min-w-0">
                <p className="font-body text-xs font-medium leading-tight truncate">
                  {art.shortLabel}
                </p>
                <p className="font-mono text-xs opacity-50 leading-tight truncate">
                  {art.frequency.split('(')[0].trim()}
                </p>
              </div>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Multi-channel EEG viewer */}
        <div className="flex-shrink-0 border-b border-eeg-border" style={{ height: '52%' }}>

          {/* Viewer header */}
          <div className="px-5 py-2.5 border-b border-eeg-border flex items-center justify-between bg-eeg-surface">
            <div className="flex items-center gap-3">
              <span className="text-xl">{artifact?.icon}</span>
              <div>
                <h2 className="font-display font-bold text-base text-eeg-text leading-tight">
                  {artifact?.label}
                </h2>
                <p className="font-mono text-xs text-eeg-muted">
                  {artifact?.frequency}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-mono px-2.5 py-1 rounded border"
                style={{ color: artifact?.color, borderColor: artifact?.color + '44', background: artifact?.color + '11' }}
              >
                {artifact?.amplitude}
              </span>
              <div className="text-xs font-mono text-eeg-muted hidden md:block">
                Longitudinal bipolar · {channels.length} ch · 8 s
              </div>
              <div className="flex items-center gap-1 border border-eeg-border rounded-md overflow-hidden">
                {['global', 'per-channel'].map(mode => (
                  <button key={mode}
                    onClick={() => setNormalise(mode)}
                    className={`text-[10px] font-mono px-2 py-1 transition-all
                      ${normalise === mode
                        ? 'bg-eeg-accent bg-opacity-15 text-eeg-accent'
                        : 'text-eeg-muted hover:text-eeg-text'}`}
                    title={mode === 'global' ? 'Uniform scale across all channels' : 'Scale each channel to its own peak'}
                  >
                    {mode === 'global' ? 'Global' : 'Per-ch'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="overflow-y-auto overflow-x-hidden" style={{ height: 'calc(100% - 48px)' }}>
            {generating || channels.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2 text-eeg-muted font-mono text-sm animate-pulse">
                  <span>Generating trace…</span>
                </div>
              </div>
            ) : (
              <ArtifactMultiChannelViewer
                channels={channels}
                events={events}
                hotChannels={hot}
                timeAxis={timeAxis}
                artifactColor={artifact?.color}
                normalise={normalise}
              />
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
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
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {artifact && (
              <DetailContent artifact={artifact} tab={detailTab} hot={hot} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Multi-Channel Canvas Viewer ──────────────────────────────────────────────

function ArtifactMultiChannelViewer({ channels, events, hotChannels, timeAxis, artifactColor, normalise }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !channels.length) return

    const dpr  = window.devicePixelRatio || 1
    const W    = canvas.clientWidth
    const nCh  = channels.length
    const plotInner = nCh * CHANNEL_H
    const H    = HEADER_H + plotInner + FOOTER_H

    canvas.width        = W * dpr
    canvas.height       = H * dpr
    canvas.style.height = `${H}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const plotW    = W - LABEL_W
    const plotX0   = LABEL_W
    const plotY0   = HEADER_H
    const plotY1   = HEADER_H + plotInner
    const duration = timeAxis[timeAxis.length - 1] ?? 8

    // ── Plot area background (paper) ──────────────────────────────────────
    ctx.fillStyle = BG_PAPER
    ctx.fillRect(plotX0, 0, plotW, H)

    // ── Hot-channel highlight bands (drawn first, behind grid) ────────────
    if (hotChannels && hotChannels.length) {
      const hotSet = new Set(hotChannels)
      channels.forEach(({ label }, idx) => {
        if (!hotSet.has(label)) return
        const top = plotY0 + idx * CHANNEL_H
        ctx.fillStyle = (artifactColor ?? '#00FFB0') + '12'    // ~7% opacity
        ctx.fillRect(plotX0, top, plotW, CHANNEL_H)
      })
    }

    // ── Minor vertical grid: every 200 ms ─────────────────────────────────
    ctx.strokeStyle = MINOR_GRID
    ctx.lineWidth   = 1
    const minorStep = 0.2
    for (let t = 0; t <= duration + 1e-6; t += minorStep) {
      const x = plotX0 + (t / duration) * plotW
      ctx.beginPath()
      ctx.moveTo(x, plotY0)
      ctx.lineTo(x, plotY1)
      ctx.stroke()
    }

    // ── Major vertical grid: every 1 s ────────────────────────────────────
    ctx.strokeStyle = MAJOR_GRID
    ctx.lineWidth   = 1
    for (let t = 0; t <= duration + 1e-6; t += 1) {
      const x = plotX0 + (t / duration) * plotW
      ctx.beginPath()
      ctx.moveTo(x, plotY0)
      ctx.lineTo(x, plotY1)
      ctx.stroke()
    }

    // ── Per-channel baseline and separator lines ─────────────────────────
    channels.forEach(({ label }, idx) => {
      const cy  = plotY0 + idx * CHANNEL_H + CHANNEL_H / 2
      const sep = plotY0 + (idx + 1) * CHANNEL_H

      // Faint baseline
      ctx.strokeStyle = BASELINE_COL
      ctx.lineWidth   = 0.5
      ctx.beginPath()
      ctx.moveTo(plotX0, cy); ctx.lineTo(W, cy)
      ctx.stroke()

      // Channel separator
      ctx.strokeStyle = 'rgba(0,212,255,0.07)'
      ctx.lineWidth   = 0.5
      ctx.beginPath()
      ctx.moveTo(plotX0, sep); ctx.lineTo(W, sep)
      ctx.stroke()
    })

    // ── Compute normalisation ─────────────────────────────────────────────
    const channelMax = channels.map(ch => {
      if (!ch.data || !ch.data.length) return 1
      let m = 0
      for (let i = 0; i < ch.data.length; i++) {
        const v = Math.abs(ch.data[i])
        if (v > m) m = v
      }
      return m || 1
    })
    const globalMax = channelMax.reduce((a, b) => Math.max(a, b), 1)

    // ── Draw each channel's trace ────────────────────────────────────────
    channels.forEach(({ label, data }, idx) => {
      if (!data || data.length === 0) return
      const cy     = plotY0 + idx * CHANNEL_H + CHANNEL_H / 2
      const halfH  = CHANNEL_H / 2 - 3
      const chMax  = channelMax[idx]
      const scaleMax = normalise === 'per-channel' ? chMax : globalMax
      const isHot  = hotChannels?.includes(label) ||
                     (chMax / globalMax) > 0.55
      const baseCol = artifactColor ?? SIGNAL_COLOR

      ctx.strokeStyle = isHot ? baseCol : SIGNAL_COLOR
      ctx.lineWidth   = isHot ? 1.35 : 0.9
      ctx.shadowColor = ctx.strokeStyle
      ctx.shadowBlur  = isHot ? 5 : 2
      ctx.lineJoin    = 'round'
      ctx.lineCap     = 'round'

      const nPts = data.length
      const step = Math.max(1, Math.floor(nPts / (plotW * 2)))
      ctx.beginPath()
      for (let i = 0; i < nPts; i += step) {
        const x = plotX0 + (i / nPts) * plotW
        const y = cy - (data[i] / scaleMax) * halfH
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    })

    // ── Event band (top) ──────────────────────────────────────────────────
    ctx.fillStyle = '#0A0E1A'
    ctx.fillRect(plotX0, 0, plotW, HEADER_H)
    ctx.strokeStyle = 'rgba(0,212,255,0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(plotX0, HEADER_H); ctx.lineTo(W, HEADER_H); ctx.stroke()

    if (events && events.length) {
      events.forEach(ev => {
        if (ev.t < 0 || ev.t > duration) return
        const x = plotX0 + (ev.t / duration) * plotW
        const col = artifactColor ?? '#00FFB0'

        // Vertical guide line through all channels (faint)
        ctx.strokeStyle = col + '33'
        ctx.lineWidth   = 0.8
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(x, HEADER_H); ctx.lineTo(x, plotY1)
        ctx.stroke()
        ctx.setLineDash([])

        // Tick mark at top
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(x - 4, 4)
        ctx.lineTo(x + 4, 4)
        ctx.lineTo(x, 12)
        ctx.closePath()
        ctx.fill()

        // Label
        if (ev.text) {
          ctx.fillStyle    = col
          ctx.font         = `9px "DM Mono", monospace`
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(ev.text, x, 13)
        }
      })
    }

    // ── Time-axis footer ─────────────────────────────────────────────────
    ctx.fillStyle = '#0A0E1A'
    ctx.fillRect(plotX0, plotY1, plotW, FOOTER_H)
    ctx.strokeStyle = 'rgba(0,212,255,0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(plotX0, plotY1); ctx.lineTo(W, plotY1); ctx.stroke()

    for (let t = 0; t <= duration; t++) {
      const x = plotX0 + (t / duration) * plotW
      ctx.strokeStyle = AXIS_COLOR
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, plotY1); ctx.lineTo(x, plotY1 + 4)
      ctx.stroke()
      ctx.fillStyle    = LABEL_COLOR
      ctx.font         = `9px "DM Mono", monospace`
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`${t}s`, x + 3, plotY1 + 6)
    }

    // ── Scale bar (bottom-right corner) ───────────────────────────────────
    const amplitudeBarUv = 100
    const pxPerUv = (CHANNEL_H / 2 - 3) / globalMax
    const ampPx   = pxPerUv * amplitudeBarUv
    const timePx  = (1 / duration) * plotW      // 1 second
    const barX    = W - 22
    const barY    = plotY1 - 8

    if (isFinite(ampPx) && ampPx > 3 && ampPx < CHANNEL_H * 3) {
      ctx.strokeStyle = '#00FFB0'
      ctx.lineWidth   = 1.5
      // Vertical (amplitude) bar
      ctx.beginPath()
      ctx.moveTo(barX, barY - ampPx); ctx.lineTo(barX, barY)
      ctx.stroke()
      // Horizontal (time) bar
      ctx.beginPath()
      ctx.moveTo(barX, barY); ctx.lineTo(barX - timePx, barY)
      ctx.stroke()

      ctx.fillStyle    = '#00FFB0'
      ctx.font         = `9px "DM Mono", monospace`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${amplitudeBarUv} µV`, barX - 3, barY - ampPx + 9)
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText('1 s', barX - 3, barY + 2)
    }

    // ── Label column ──────────────────────────────────────────────────────
    ctx.fillStyle = '#070B14'
    ctx.fillRect(0, 0, LABEL_W, H)
    ctx.strokeStyle = AXIS_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(LABEL_W, 0); ctx.lineTo(LABEL_W, H); ctx.stroke()

    channels.forEach(({ label }, idx) => {
      const cy    = plotY0 + idx * CHANNEL_H + CHANNEL_H / 2
      const chMax = channelMax[idx]
      const relAmp = chMax / globalMax
      const isHot = hotChannels?.includes(label) || relAmp > 0.55

      // Peak amplitude readout
      ctx.fillStyle    = LABEL_COLOR
      ctx.font         = `8px "DM Mono", monospace`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${Math.round(chMax)}µV`, LABEL_W - 6, cy + 9)

      // Channel label
      ctx.fillStyle    = isHot ? (artifactColor ?? '#00FFB0') : '#8894AA'
      ctx.font         = `${isHot ? 'bold ' : ''}10px "DM Mono", monospace`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, LABEL_W - 6, cy - 3)

      // Hot-channel indicator dot
      if (isHot) {
        ctx.fillStyle = artifactColor ?? '#00FFB0'
        ctx.beginPath()
        ctx.arc(6, cy, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    })

  }, [channels, events, hotChannels, timeAxis, artifactColor, normalise])

  return (
    <canvas
      ref={canvasRef}
      className="w-full block"
      style={{ imageRendering: 'crisp-edges' }}
    />
  )
}

// ─── Detail Content ───────────────────────────────────────────────────────────

function DetailContent({ artifact, tab, hot }) {
  return (
    <div className="px-7 py-5 max-w-3xl">
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
                <p className="text-xs font-mono text-eeg-muted uppercase tracking-widest mb-1">{k}</p>
                <p className="font-body text-sm text-eeg-text leading-snug">{v}</p>
              </div>
            ))}
          </div>

          <div>
            <SectionTitle>Mechanism</SectionTitle>
            <p className="font-body text-sm text-eeg-muted leading-relaxed mt-2">
              {artifact.mechanism}
            </p>
          </div>

          {hot && hot.length > 0 && (
            <div>
              <SectionTitle>Channels Highlighted in Trace</SectionTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hot.map(ch => (
                  <span key={ch}
                    className="text-xs font-mono px-2 py-0.5 rounded border"
                    style={{ color: artifact.color, borderColor: artifact.color + '44', background: artifact.color + '11' }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'identify' && (
        <div>
          <SectionTitle>How to Identify</SectionTitle>
          <p className="font-body text-sm text-eeg-muted mt-2 mb-4 leading-relaxed">
            Look for these features in the trace above — channels with the artifact maximum are highlighted and flagged with a dot.
          </p>
          <ul className="space-y-3">
            {artifact.identification.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: artifact.color + '22', color: artifact.color }}
                >
                  {i + 1}
                </span>
                <p className="font-body text-sm text-eeg-text leading-relaxed">{item}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'differentiate' && (
        <div>
          <SectionTitle>Differentiation from Pathological Patterns</SectionTitle>
          <div className="mt-4 card p-5 border-l-4" style={{ borderLeftColor: artifact.color }}>
            <p className="font-body text-sm text-eeg-text leading-relaxed">
              {artifact.differentiation}
            </p>
          </div>
          <div className="mt-5">
            <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">Key Rule</p>
            <div className="card p-4 bg-eeg-card">
              <p className="font-mono text-xs text-eeg-accent leading-relaxed">
                {getDifferentiationRule(artifact.id)}
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'reduce' && (
        <div>
          <SectionTitle>Reduction Strategies</SectionTitle>
          <p className="font-body text-sm text-eeg-muted mt-2 mb-4 leading-relaxed">
            Apply these in order — start with technical improvements before resorting to filtering, which can alter genuine EEG features.
          </p>
          <ol className="space-y-3">
            {artifact.reduction.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 font-mono text-xs text-eeg-muted w-6 mt-0.5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="font-body text-sm text-eeg-text leading-relaxed">{item}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === 'clinical' && (
        <div>
          <SectionTitle>Clinical Note</SectionTitle>
          <div className="mt-4 card p-6 border-l-4" style={{ borderLeftColor: artifact.color }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{artifact.icon}</span>
              <p className="font-body text-sm text-eeg-text leading-relaxed">
                {artifact.clinicalNote}
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
  return (
    <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted">
      {children}
    </p>
  )
}

function getDifferentiationRule(id) {
  const rules = {
    eye_blink:      'Blink: BILATERAL SYMMETRIC, frontopolar maximum, no phase reversal. Epileptiform: field across multiple channels, phase reversal in bipolar montage.',
    lateral_eye:    'OPPOSITE POLARITY at Fp1 vs Fp2 = eye movement. SAME POLARITY at Fp1 and Fp2 = blink. Frontal EDs: no systematic mirror-opposite relationship.',
    muscle:         'EMG artifact: high-frequency (>30 Hz), temporal maximum, no coherent field. Spikes: sharply contoured with field, < 70 ms, propagate across channels.',
    chewing:        'Chewing: rhythmic HIGH-FREQUENCY BURSTS at temporal chains at 1–2 Hz. Ictal activity: may start focally but has lower-frequency cerebral field; video correlation is key.',
    powerline:      'Powerline: EXACT frequency, perfectly sinusoidal, no variability. Genuine HFOs: variable, brief, not perfectly sinusoidal. Notch filter distinguishes definitively.',
    electrode_pop:  'Pop: SINGLE CHANNEL, no field, long DC-recovery tail, no after-going slow wave. Genuine spike: FIELD in adjacent channels, appropriate gradient, followed by slow wave.',
    ecg:            'ECG artifact: phase-locked to simultaneous ECG, temporal-maximum. GPDs: NOT locked to ECG, variable morphology, not perfectly regular. Use simultaneous ECG channel.',
    sweat:          'Sweat: INCOHERENT phase across channels, removed by HP filter. Cerebral delta: COHERENT bilateral distribution, not removed by HP filter (genuine signal).',
    glossokinetic:  'Glossokinetic: stops IMMEDIATELY when tongue is held still. FIRDA: persists regardless of tongue position, correlates with encephalopathy, not oral movement.',
    respiration:    'Respiration: phase-locked to breathing, reduced/absent in bipolar montage. Cerebral slow activity: present in all montages, not phase-locked to respiratory cycle.',
    ventilator:     'Ventilator: PERFECTLY REGULAR, stereotyped every cycle, generalized. GPDs: inter-discharge interval variability, evolving morphology, may correlate with clinical state changes.',
    photomyogenic:  'Photomyogenic: FRONTOPOLAR only, EMG morphology, starts early (10–40 ms). PPR (photoparoxysmal): OCCIPITAL then GENERALISED spike-wave, cerebral morphology, may outlast stimulation.',
  }
  return rules[id] ?? 'Apply standard artifact identification criteria: distribution, morphology, reactivity.'
}
