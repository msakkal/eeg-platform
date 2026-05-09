import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ELECTRODE_POSITIONS_2D,
  SELECTABLE_ELECTRODES,
  computePropagationWeights,
  generatePropagationEEG,
  analyseMontagePropagation,
  findPhaseReversals,
  weightToColor,
  weightToFill,
} from '@/engine/propagation'
import { applyMontage, MONTAGES, MONTAGE_LIST } from '@/engine/montages'
import { makeTimeAxis, SAMPLE_RATE } from '@/engine/signalGenerator'

// ─── Scalp map geometry ───────────────────────────────────────────────────────
const MAP_SIZE = 220
const MAP_CX   = MAP_SIZE / 2
const MAP_CY   = MAP_SIZE / 2
const MAP_R    = 90

function toSvg(nx, ny) {
  return { x: MAP_CX + nx * MAP_R, y: MAP_CY - ny * MAP_R }
}

// ─── Montage options shown in the selector ────────────────────────────────────
const MONTAGE_OPTIONS = [
  { id: 'longitudinal_bipolar', label: 'Long. Bipolar',  shortDesc: 'Phase reversals localise generator' },
  { id: 'transverse_bipolar',   label: 'Trans. Bipolar', shortDesc: 'Left-right phase reversal' },
  { id: 'average_reference',    label: 'Avg. Reference', shortDesc: 'Amplitude gradient from source' },
  { id: 'referential_ears',     label: 'Ref. Ears',      shortDesc: 'Direct amplitude gradient' },
]

// ─── Discharge times (seconds) shown in the EEG window ───────────────────────
const DISCHARGE_TIMES = [1.4, 3.6, 5.8, 8.2]

// ─── EEG canvas constants ─────────────────────────────────────────────────────
const CH_H     = 46
const LABEL_W  = 88
const AXIS_COL = 'rgba(0,212,255,0.12)'
const GRID_COL = 'rgba(0,212,255,0.06)'
const BG_COL   = '#0D1424'

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PropagationSection() {
  const [sourceElec,     setSourceElec]     = useState('C3')
  const [sigma,          setSigma]          = useState(0.38)
  const [montageId,      setMontageId]      = useState('longitudinal_bipolar')
  // Channel currently being hovered in the EEG viewer — drives the mini-map.
  const [hoveredChannel, setHoveredChannel] = useState(null)

  // ── Derived data ────────────────────────────────────────────────────────────
  const weights = useMemo(
    () => computePropagationWeights(sourceElec, sigma),
    [sourceElec, sigma]
  )

  const rawEEG = useMemo(
    () => generatePropagationEEG(weights),
    [weights]
  )

  const derivedChannels = useMemo(
    () => applyMontage(rawEEG.channels, montageId),
    [rawEEG, montageId]
  )

  const timeAxis = useMemo(
    () => makeTimeAxis(rawEEG.nSamples, SAMPLE_RATE),
    [rawEEG]
  )

  const channelInfo = useMemo(
    () => analyseMontagePropagation(montageId, sourceElec, weights),
    [montageId, sourceElec, weights]
  )

  const phaseReversals = useMemo(
    () => findPhaseReversals(montageId, sourceElec),
    [montageId, sourceElec]
  )

  // Top 5 electrodes by weight for the "Field Strength" panel
  const topElectrodes = useMemo(() => {
    return Object.entries(weights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
  }, [weights])

  // The electrode pair that the hovered EEG channel is derived from. Filters
  // out non-physical labels (e.g. "AVG" for average reference).
  const hoveredElectrodes = useMemo(() => {
    if (!hoveredChannel) return { pos: null, neg: null, polarity: 0 }
    const info = channelInfo.find(c => c.label === hoveredChannel)
    if (!info) return { pos: null, neg: null, polarity: 0 }
    return {
      pos:      ELECTRODE_POSITIONS_2D[info.posElec] ? info.posElec : null,
      neg:      ELECTRODE_POSITIONS_2D[info.negElec] ? info.negElec : null,
      polarity: info.polarity ?? 0,
    }
  }, [hoveredChannel, channelInfo])

  // Whether the current montage is bipolar (affects annotation messaging)
  const isBipolar = montageId.includes('bipolar')
  const isReferential = !isBipolar

  return (
    <div className="mt-12 space-y-8">

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div>
        <span className="label-tag mb-3 inline-block" style={{ color: '#FF6B35', borderColor: '#FF6B3544', background: '#FF6B3511' }}>
          Interactive Demo
        </span>
        <h2 className="font-display font-bold text-2xl text-eeg-text mb-3">
          Epileptic Field Propagation
        </h2>
        <p className="font-body text-sm text-eeg-muted leading-relaxed max-w-2xl">
          An epileptic generator creates an electrical field that decays with distance across the scalp.
          Select any electrode as the source below, adjust the spatial spread, and observe how the discharge
          appears across the montage — including the characteristic <strong className="text-eeg-text">phase reversal</strong> in
          bipolar montages and the <strong className="text-eeg-text">amplitude gradient</strong> in referential montages.
        </p>
      </div>

      {/* ── Row 1: Source picker + Field strength ─────────────────────────── */}
      <div className="flex gap-6 items-start flex-wrap xl:flex-nowrap">

        {/* Scalp source picker */}
        <div className="card p-5 flex-shrink-0 w-72">
          <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">
            1. Select Source Electrode
          </p>

          <ScalpSourceMap
            weights={weights}
            source={sourceElec}
            onSelect={setSourceElec}
            sigma={sigma}
          />

          {/* Spread slider with typical-range annotation */}
          <SpreadSlider sigma={sigma} setSigma={setSigma} />

          {/* Color legend */}
          <div className="mt-4 flex items-center gap-2">
            {[['Source', '#FF3333'], ['Near', '#FF6B35'], ['Mid', '#FFD166'], ['Far', '#00FFB0'], ['Distant', '#2A3A54']].map(([label, color]) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-xs font-mono" style={{ color, fontSize: '9px' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Field strength panel */}
        <div className="card p-5 flex-1 min-w-0 self-stretch">
          <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">
            Field Strength by Electrode
          </p>
          <p className="font-body text-xs text-eeg-muted mb-4 leading-relaxed">
            Each electrode's distance from the source determines its share of the
            field. Use the spread slider to see how a more focal generator
            concentrates amplitude on a few sites, while a diffuse one spreads
            across the head.
          </p>
          <div className="space-y-2">
            {topElectrodes.map(([elec, w]) => (
              <div key={elec} className="flex items-center gap-3">
                <span className="font-mono text-xs w-8 flex-shrink-0"
                  style={{ color: weightToColor(w) }}>
                  {elec}
                </span>
                <div className="flex-1 h-2 bg-eeg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${w * 100}%`,
                      background: weightToColor(w),
                      boxShadow: `0 0 6px ${weightToColor(w)}88`,
                    }}
                  />
                </div>
                <span className="font-mono text-xs text-eeg-muted w-10 text-right">
                  {(w * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Montage selector + Field explanation ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Montage selector */}
        <div className="card p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">
            2. Select Montage
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MONTAGE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setMontageId(opt.id)}
                className={`text-left px-3 py-3 rounded-xl border transition-all
                  ${montageId === opt.id
                    ? 'border-eeg-accent bg-eeg-accent bg-opacity-10 text-eeg-text'
                    : 'border-eeg-border text-eeg-muted hover:border-eeg-muted hover:text-eeg-text'
                  }`}
              >
                <span className="font-display font-semibold text-xs block">{opt.label}</span>
                <span className="font-mono text-xs opacity-60 block mt-0.5">{opt.shortDesc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Field explanation: phase-reversal / amplitude-gradient */}
        <FieldExplanationCallout
          montageId={montageId}
          sourceElec={sourceElec}
          isBipolar={isBipolar}
          phaseReversals={phaseReversals}
          channelInfo={channelInfo}
        />
      </div>

      {/* ── Row 3: EEG viewer with synced mini-map ───────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-eeg-border flex items-center justify-between bg-eeg-surface">
          <div>
            <p className="font-display font-semibold text-sm text-eeg-text">
              EEG — {MONTAGES[montageId]?.label}
            </p>
            <p className="font-mono text-xs text-eeg-muted mt-0.5">
              Source: <span style={{ color: '#FF3333' }}>{sourceElec}</span>
              {' · '}
              {derivedChannels.length} channels · 10 s · 4 discharges
              {phaseReversals.length > 0 && (
                <span className="ms-2 text-yellow-400">
                  ⇄ Phase reversal at {phaseReversals[0]?.at}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <AmplitudeScaleBar />
          </div>
        </div>

        {/* Body: canvas (left, scrollable) + sticky mini-map (right) */}
        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 min-w-0 eeg-paper overflow-y-auto overflow-x-hidden"
               style={{ maxHeight: '680px' }}>
            <PropagationEEGCanvas
              channels={derivedChannels}
              timeAxis={timeAxis}
              channelInfo={channelInfo}
              phaseReversals={phaseReversals}
              isBipolar={isBipolar}
              sourceElec={sourceElec}
              onHoverChannel={setHoveredChannel}
            />
          </div>
          <div className="lg:w-52 lg:flex-shrink-0 lg:border-l border-eeg-border bg-eeg-surface
                          p-4 flex flex-col gap-2 items-center">
            <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted self-start mb-1">
              Hovered channel
            </p>
            <ChannelMiniMap
              hoveredElectrodes={hoveredElectrodes}
              hoveredChannelLabel={hoveredChannel}
              sourceElec={sourceElec}
              isBipolar={isBipolar}
            />
            <p className="text-[10px] font-mono text-eeg-muted text-center mt-2 leading-relaxed">
              {hoveredChannel
                ? <>Hover any channel in the trace to see which scalp electrodes contribute to it.</>
                : <>Move the cursor over the EEG trace to highlight the source pair on the head.</>
              }
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

// =============================================================================
// SCALP SOURCE MAP
// =============================================================================

function ScalpSourceMap({ weights, source, onSelect, sigma }) {
  const [hovered, setHovered] = useState(null)
  const srcPos = toSvg(ELECTRODE_POSITIONS_2D[source]?.x ?? 0, ELECTRODE_POSITIONS_2D[source]?.y ?? 0)
  const spreadRadius = sigma * MAP_R * 2.4   // visual radius of the gradient ring

  return (
    <svg
      viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
      width={MAP_SIZE}
      height={MAP_SIZE}
      style={{ display: 'block', cursor: 'default' }}
    >
      <defs>
        {/* Radial gradient for the propagation heatmap */}
        <radialGradient
          id="propGrad"
          cx={`${(srcPos.x / MAP_SIZE) * 100}%`}
          cy={`${(srcPos.y / MAP_SIZE) * 100}%`}
          r={`${(spreadRadius / MAP_SIZE) * 100}%`}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="#FF333388" />
          <stop offset="35%"  stopColor="#FF6B3544" />
          <stop offset="65%"  stopColor="#FFD16622" />
          <stop offset="100%" stopColor="#FFD16600" />
        </radialGradient>
      </defs>

      {/* Head outline */}
      <circle cx={MAP_CX} cy={MAP_CY} r={MAP_R} fill="#0D1424" stroke="#1E2A40" strokeWidth="1.5" />

      {/* Propagation heatmap */}
      <circle cx={MAP_CX} cy={MAP_CY} r={MAP_R} fill="url(#propGrad)" clipPath="circle()" />

      {/* Anatomical guides */}
      {/* Nose */}
      <path
        d={`M${MAP_CX-9} ${MAP_CY - MAP_R + 6} Q${MAP_CX} ${MAP_CY - MAP_R - 14} ${MAP_CX+9} ${MAP_CY - MAP_R + 6}`}
        fill="none" stroke="#2A3A54" strokeWidth="1.5"
      />
      {/* Left ear */}
      <ellipse cx={MAP_CX - MAP_R - 5} cy={MAP_CY + 3} rx="5" ry="8" fill="none" stroke="#2A3A54" strokeWidth="1.2" />
      {/* Right ear */}
      <ellipse cx={MAP_CX + MAP_R + 5} cy={MAP_CY + 3} rx="5" ry="8" fill="none" stroke="#2A3A54" strokeWidth="1.2" />
      {/* Crosshairs */}
      <line x1={MAP_CX} y1={MAP_CY - MAP_R} x2={MAP_CX} y2={MAP_CY + MAP_R} stroke="#1E2A4055" strokeWidth="0.5" strokeDasharray="3,3" />
      <line x1={MAP_CX - MAP_R} y1={MAP_CY} x2={MAP_CX + MAP_R} y2={MAP_CY} stroke="#1E2A4055" strokeWidth="0.5" strokeDasharray="3,3" />

      {/* Spread ring */}
      <circle
        cx={srcPos.x} cy={srcPos.y} r={spreadRadius}
        fill="none" stroke="#FF6B3533" strokeWidth="1"
        strokeDasharray="4,3"
      />

      {/* Electrodes */}
      {SELECTABLE_ELECTRODES.map(elec => {
        const pos   = ELECTRODE_POSITIONS_2D[elec]
        const sv    = toSvg(pos.x, pos.y)
        const w     = weights[elec] ?? 0
        const isSrc = elec === source
        const isHov = hovered === elec
        const col   = weightToColor(w)
        const fill  = weightToFill(w)

        return (
          <g
            key={elec}
            onClick={() => onSelect(elec)}
            onMouseEnter={() => setHovered(elec)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Glow ring for source */}
            {isSrc && (
              <circle cx={sv.x} cy={sv.y} r="9" fill="none" stroke="#FF333388" strokeWidth="2">
                <animate attributeName="r" values="8;12;8" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Hover ring */}
            {isHov && !isSrc && (
              <circle cx={sv.x} cy={sv.y} r="8" fill="none" stroke={col + '88'} strokeWidth="1.5" />
            )}

            {/* Electrode dot */}
            <circle
              cx={sv.x} cy={sv.y}
              r={isSrc ? 5.5 : isHov ? 5 : 4}
              fill={isSrc ? '#FF3333' : fill}
              stroke={col}
              strokeWidth={isSrc ? 1.5 : 1}
            />

            {/* Weight percentage label */}
            {w > 0.1 && (
              <text
                x={sv.x} y={sv.y + (pos.y > 0 ? -7 : 8)}
                textAnchor="middle"
                fontSize="4.5"
                fill={col}
                fontFamily="DM Mono, monospace"
                fontWeight={isSrc ? 'bold' : 'normal'}
              >
                {isSrc ? '●' : `${(w*100).toFixed(0)}%`}
              </text>
            )}

            {/* Electrode label */}
            <text
              x={sv.x + (pos.x < -0.6 ? -7 : pos.x > 0.6 ? 7 : 0)}
              y={sv.y + (pos.y > 0.6 ? -9 : pos.y < -0.6 ? 10 : 0) + (pos.y > 0 ? -1 : 2)}
              textAnchor={pos.x < -0.6 ? 'end' : pos.x > 0.6 ? 'start' : 'middle'}
              fontSize="5.5"
              fill={isHov || isSrc ? col : '#5A6A82'}
              fontFamily="DM Mono, monospace"
              fontWeight={isSrc ? 'bold' : 'normal'}
            >
              {elec}
            </text>
          </g>
        )
      })}

      {/* Source label callout */}
      <text x={MAP_CX} y={MAP_SIZE - 4} textAnchor="middle" fontSize="7"
        fill="#5A6A82" fontFamily="DM Mono, monospace">
        Source: {source} · Click electrode to change
      </text>
    </svg>
  )
}

// =============================================================================
// FIELD EXPLANATION CALLOUT
// =============================================================================

function FieldExplanationCallout({ montageId, sourceElec, isBipolar, phaseReversals, channelInfo }) {
  const sourceChannels = channelInfo.filter(c => c.containsSrc)
  const maxAmplitudeChannel = channelInfo.reduce((best, c) =>
    c.netAmplitude > (best?.netAmplitude ?? 0) ? c : best, null
  )

  // One combined card containing both the rule-of-thumb and the per-source-channel
  // chips. Stacking vertically keeps the card compact when placed in a 2-col grid
  // alongside the montage selector.
  return (
    <div className="card p-5 space-y-4">

      {/* Bipolar: phase reversal explanation */}
      <div className="flex items-start gap-3 pb-4 border-b border-eeg-border border-opacity-50">
        <span className="text-xl flex-shrink-0 mt-1" style={{ color: '#FFD166' }}>⇄</span>
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm text-eeg-text mb-1">
            {isBipolar ? 'Phase Reversal (Bipolar Montages)' : 'Amplitude Gradient (Referential Montages)'}
          </p>
          {isBipolar ? (
            <p className="font-body text-xs text-eeg-muted leading-relaxed">
              In a bipolar montage, the epileptic discharge appears with <span className="text-yellow-300">opposite polarity</span> in
              channels on either side of the source electrode. This "phase reversal" marks the generator.
              {phaseReversals.length > 0
                ? <> With source <strong className="text-eeg-text">{sourceElec}</strong>, look for the phase reversal between <strong className="text-yellow-300">{phaseReversals[0].label1}</strong> and <strong className="text-yellow-300">{phaseReversals[0].label2}</strong>.</>
                : <> Source <strong className="text-eeg-text">{sourceElec}</strong> may appear at the end of a chain — look for maximum amplitude rather than reversal.</>
              }
            </p>
          ) : (
            <p className="font-body text-xs text-eeg-muted leading-relaxed">
              In a referential montage, the source electrode shows the <span className="text-eeg-accent">largest amplitude</span> discharge.
              Amplitude decreases with distance from <strong className="text-eeg-text">{sourceElec}</strong>.
              {maxAmplitudeChannel && (
                <> The highest-amplitude channel is <strong className="text-eeg-accent">{maxAmplitudeChannel.label}</strong>.</>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Source channels in current montage */}
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-1" style={{ color: '#FF3333' }}>📍</span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-sm text-eeg-text mb-2">
            Channels Involving <span style={{ color: '#FF3333' }}>{sourceElec}</span>
          </p>
          {sourceChannels.length === 0 ? (
            <p className="font-mono text-xs text-eeg-muted">No channels in this montage directly involve {sourceElec}.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sourceChannels.map(c => (
                <span key={c.label}
                  className="font-mono text-xs px-2 py-1 rounded border"
                  style={{
                    color:        c.polarity > 0 ? '#FF6B35' : '#00D4FF',
                    borderColor:  c.polarity > 0 ? '#FF6B3544' : '#00D4FF44',
                    background:   c.polarity > 0 ? '#FF6B3511' : '#00D4FF11',
                  }}
                  title={c.polarity > 0 ? `${sourceElec} is positive lead → spike deflects downward` : `${sourceElec} is negative lead → spike deflects upward`}
                >
                  {c.label} {c.polarity > 0 ? '↓' : '↑'}
                </span>
              ))}
            </div>
          )}
          <p className="font-mono text-xs text-eeg-muted mt-2">
            <span className="text-orange-400">↓</span> source is positive lead (spike down)
            {' · '}
            <span className="text-cyan-400">↑</span> source is negative lead (spike up)
          </p>
        </div>
      </div>

    </div>
  )
}

// =============================================================================
// PROPAGATION EEG CANVAS
// =============================================================================

function PropagationEEGCanvas({ channels, timeAxis, channelInfo, phaseReversals, isBipolar, sourceElec, onHoverChannel }) {
  const canvasRef = useRef(null)
  const dpr       = window.devicePixelRatio || 1
  // Hovered channel index — local state so we can highlight the row in canvas
  // and report the channel label up via onHoverChannel.
  const [hoverIdx, setHoverIdx] = useState(null)

  // Build a lookup from channel label → info
  const infoMap = useMemo(() => {
    const m = {}
    channelInfo.forEach(c => { m[c.label] = c })
    return m
  }, [channelInfo])

  // Phase-reversal channel labels
  const prLabels = useMemo(() => new Set(phaseReversals.flatMap(p => [p.label1, p.label2])), [phaseReversals])

  // Tell the parent which channel is hovered (or null when off the canvas)
  useEffect(() => {
    if (!onHoverChannel) return
    onHoverChannel(hoverIdx == null ? null : channels[hoverIdx]?.label ?? null)
  }, [hoverIdx, channels, onHoverChannel])

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas || channels.length === 0) return
    const rect = canvas.getBoundingClientRect()
    const y    = e.clientY - rect.top
    const idx  = Math.floor(y / CH_H)
    setHoverIdx(idx >= 0 && idx < channels.length ? idx : null)
  }, [channels])

  const handleMouseLeave = useCallback(() => setHoverIdx(null), [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || channels.length === 0) return

    const W    = canvas.clientWidth
    const nCh  = channels.length
    // Footer band holds the legend strip (top half) and the time-axis labels
    // (bottom half) with vertical breathing room so they don't overlap.
    const H    = nCh * CH_H + 50

    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width        = W * dpr
      canvas.height       = H * dpr
      canvas.style.height = `${H}px`
    }

    const ctx      = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const plotW    = W - LABEL_W
    const duration = timeAxis[timeAxis.length - 1] ?? 10

    // ── Background ────────────────────────────────────────────────────────
    ctx.fillStyle = BG_COL
    ctx.fillRect(LABEL_W, 0, plotW, H - 50)

    // ── Discharge epoch shading ───────────────────────────────────────────
    DISCHARGE_TIMES.forEach(t => {
      const x   = LABEL_W + (t / duration) * plotW
      const dur = (0.5 / duration) * plotW
      ctx.fillStyle = 'rgba(255,100,50,0.06)'
      ctx.fillRect(x, 0, dur, H - 50)
      // Discharge marker line
      ctx.strokeStyle = 'rgba(255,100,50,0.25)'
      ctx.lineWidth   = 0.8
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 50); ctx.stroke()
      ctx.setLineDash([])
      // Top label
      ctx.fillStyle    = 'rgba(255,150,80,0.7)'
      ctx.font         = '7px "DM Mono", monospace'
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('↓', x + 2, 2)
    })

    // ── Grid ──────────────────────────────────────────────────────────────
    for (let t = 0; t <= duration; t++) {
      const x = LABEL_W + (t / duration) * plotW
      ctx.strokeStyle = AXIS_COL
      ctx.lineWidth   = 1
      ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 50); ctx.stroke()
      if (t < duration) {
        ctx.fillStyle    = '#5A6A82'
        ctx.font         = '9px "DM Mono", monospace'
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(`${t}s`, x + 2, H - 10)
      }
    }

    // ── Global max for consistent amplitude scale ─────────────────────────
    const globalMax = channels.reduce((m, ch) =>
      Math.max(m, ch.data ? Math.max(...Array.from(ch.data).map(Math.abs)) : 0), 1
    )

    // ── Channels ──────────────────────────────────────────────────────────
    channels.forEach(({ label, data }, idx) => {
      const cy      = idx * CH_H + CH_H / 2
      const info    = infoMap[label]
      const isPR    = isBipolar && prLabels.has(label)
      const hasSrc  = info?.containsSrc
      const isHover = idx === hoverIdx
      const polarity = info?.polarity ?? 0

      // Highlight row for phase-reversal channels
      if (isPR) {
        ctx.fillStyle = 'rgba(255,213,102,0.05)'
        ctx.fillRect(LABEL_W, cy - CH_H / 2, plotW, CH_H)
      }
      // Brighter highlight for the row currently under the mouse
      if (isHover) {
        ctx.fillStyle = 'rgba(0,212,255,0.06)'
        ctx.fillRect(LABEL_W, cy - CH_H / 2, plotW, CH_H)
      }

      // Separator
      ctx.strokeStyle = hasSrc ? 'rgba(255,100,50,0.25)' : 'rgba(0,212,255,0.07)'
      ctx.lineWidth   = hasSrc ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(LABEL_W, cy + CH_H / 2)
      ctx.lineTo(W, cy + CH_H / 2)
      ctx.stroke()

      // Baseline
      ctx.strokeStyle = 'rgba(0,212,255,0.06)'
      ctx.lineWidth   = 0.5
      ctx.beginPath(); ctx.moveTo(LABEL_W, cy); ctx.lineTo(W, cy); ctx.stroke()

      if (!data || data.length === 0) return

      // Pick trace colour based on source involvement
      let traceCol = '#00FFB0'
      if (hasSrc)        traceCol = polarity > 0 ? '#FF6B35' : '#00D4FF'
      if (isPR)          traceCol = '#FFD166'
      if (!hasSrc && info?.netAmplitude > 0.4) traceCol = '#88DDBB'

      const nPts   = data.length
      const halfH  = CH_H / 2 - 3

      ctx.strokeStyle = traceCol
      ctx.lineWidth   = hasSrc ? 1.6 : 1.1
      ctx.shadowColor = traceCol
      ctx.shadowBlur  = hasSrc ? 7 : isPR ? 5 : 3
      ctx.beginPath()

      const step = Math.max(1, Math.floor(nPts / (plotW * 2)))
      for (let i = 0; i < nPts; i += step) {
        const x = LABEL_W + (i / nPts) * plotW
        const y = cy - (data[i] / globalMax) * halfH
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      // Phase-reversal bracket at first discharge
      if (isPR && polarity !== 0 && isBipolar) {
        const prX  = LABEL_W + (DISCHARGE_TIMES[0] / duration) * plotW
        ctx.strokeStyle = '#FFD16688'
        ctx.lineWidth   = 1.5
        ctx.beginPath()
        ctx.moveTo(prX - 10, polarity > 0 ? cy - halfH * 0.5 : cy + halfH * 0.5)
        ctx.lineTo(prX - 4, cy)
        ctx.stroke()
      }
    })

    // ── Label column ──────────────────────────────────────────────────────
    ctx.fillStyle = '#0A0E1A'
    ctx.fillRect(0, 0, LABEL_W, H)
    ctx.strokeStyle = AXIS_COL; ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(LABEL_W, 0); ctx.lineTo(LABEL_W, H - 50); ctx.stroke()

    channels.forEach(({ label }, idx) => {
      const cy      = idx * CH_H + CH_H / 2
      const info    = infoMap[label]
      const isPR    = isBipolar && prLabels.has(label)
      const hasSrc  = info?.containsSrc
      const polarity = info?.polarity ?? 0

      // Colour the label
      let labelCol = '#5A6A82'
      if (hasSrc) labelCol = polarity > 0 ? '#FF6B35' : '#00D4FF'
      if (isPR)   labelCol = '#FFD166'

      ctx.fillStyle    = labelCol
      ctx.font         = `${hasSrc || isPR ? 'bold ' : ''}9px "DM Mono", monospace`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, LABEL_W - 18, cy)

      // Polarity indicator arrow
      if (hasSrc) {
        ctx.fillStyle    = polarity > 0 ? '#FF6B35' : '#00D4FF'
        ctx.font         = 'bold 9px sans-serif'
        ctx.textAlign    = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(polarity > 0 ? '↓' : '↑', LABEL_W - 5, cy)
      }

      // Phase-reversal badge
      if (isPR && isBipolar) {
        ctx.fillStyle    = '#FFD16666'
        ctx.font         = 'bold 8px sans-serif'
        ctx.textAlign    = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText('⇄', LABEL_W - 5, cy)
      }
    })

    // ── Legend strip ──────────────────────────────────────────────────────
    // Sits in the upper half of the 50-px footer band; the time-axis labels
    // live in the lower half (baseline at H-10) so the two never overlap.
    const swatchTop  = H - 40        // 8-px swatch top edge
    const swatchSize = 8
    const textY      = swatchTop + swatchSize / 2   // 'middle' baseline aligns with swatch centre
    const items = isBipolar
      ? [['Source leads', '#FF6B35', '↓↑'], ['Phase reversal ⇄', '#FFD166', ''], ['Other channels', '#5A6A82', '']]
      : [['Max amplitude', '#FF6B35', ''], ['Near channels', '#00FFB0', ''], ['Distant channels', '#5A6A82', '']]

    let lx = LABEL_W + 8
    items.forEach(([txt, col]) => {
      ctx.fillStyle    = col
      ctx.font         = '8px "DM Mono", monospace'
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillRect(lx, swatchTop, swatchSize, swatchSize)
      ctx.fillStyle = '#5A6A82'
      ctx.fillText(txt, lx + swatchSize + 4, textY)
      lx += ctx.measureText(txt).width + 30
    })

  }, [channels, timeAxis, channelInfo, phaseReversals, isBipolar, infoMap, prLabels, hoverIdx])

  useEffect(() => { draw() }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="w-full block"
      style={{ imageRendering: 'crisp-edges' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  )
}

// =============================================================================
// AMPLITUDE SCALE BAR
// =============================================================================

function AmplitudeScaleBar() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-end gap-0.5">
        <div className="w-px h-3 bg-eeg-muted" />
        <div className="w-5 h-px bg-eeg-muted" />
        <div className="w-px h-3 bg-eeg-muted" />
      </div>
      <span className="text-xs font-mono text-eeg-muted">200 µV</span>
    </div>
  )
}

// =============================================================================
// SPREAD SLIDER — with annotated "typical clinical range" band
// =============================================================================

// The interactive σ slider. The shaded band marks the spatial spread typical of
// focal interictal sharp waves observed in clinical EEG (~σ 0.30–0.45). The
// user is free to slide outside that range to demonstrate very tight foci or
// generalised discharges.
const SIGMA_MIN     = 0.15
const SIGMA_MAX     = 0.80
const TYPICAL_LOW   = 0.30
const TYPICAL_HIGH  = 0.45
const TYPICAL_MID   = (TYPICAL_LOW + TYPICAL_HIGH) / 2

function SpreadSlider({ sigma, setSigma }) {
  const pct = (v) => ((v - SIGMA_MIN) / (SIGMA_MAX - SIGMA_MIN)) * 100
  const tlow  = pct(TYPICAL_LOW)
  const thigh = pct(TYPICAL_HIGH)
  const tmid  = pct(TYPICAL_MID)

  const inTypical = sigma >= TYPICAL_LOW && sigma <= TYPICAL_HIGH
  const tag       = sigma < 0.28 ? 'Focal'
                  : sigma < 0.50 ? 'Regional'
                  : 'Diffuse'

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-body text-eeg-muted">Spatial Spread (σ)</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-eeg-muted">{sigma.toFixed(2)}</span>
          <span className="text-xs font-mono" style={{ color: weightToColor(0.8) }}>{tag}</span>
        </div>
      </div>

      {/* Slider with overlaid typical-range band */}
      <div className="relative">
        {/* Typical-range band — sits behind the input track. Pointer-events
            disabled so the user can still drag through it normally. */}
        <div
          className="absolute pointer-events-none rounded-sm"
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            left:   `calc(${tlow}% - 1px)`,
            width:  `${thigh - tlow}%`,
            height: '14px',
            background: '#00FFB022',
            border: '1px dashed #00FFB055',
            zIndex: 0,
          }}
          title="Typical spatial spread of a focal interictal sharp wave"
        />

        <input
          type="range"
          min={SIGMA_MIN}
          max={SIGMA_MAX}
          step="0.01"
          value={sigma}
          onChange={(e) => setSigma(Number(e.target.value))}
          className="relative w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #FF6B35 ${pct(sigma)}%, #1E2A40 ${pct(sigma)}%)`,
            zIndex: 1,
          }}
        />
      </div>

      {/* Tick row: focal / typical / diffuse with the typical band labelled */}
      <div className="relative mt-2 h-5">
        <span className="absolute text-xs font-mono text-eeg-muted" style={{ left: 0 }}>
          Focal
        </span>
        <span className="absolute text-xs font-mono text-eeg-muted" style={{ right: 0 }}>
          Diffuse
        </span>
        {/* Vertical ticks for the typical-range boundaries */}
        <div className="absolute" style={{ left: `${tlow}%`, top: '-12px' }}>
          <div className="w-px h-1.5 bg-eeg-accent opacity-60" />
        </div>
        <div className="absolute" style={{ left: `${thigh}%`, top: '-12px' }}>
          <div className="w-px h-1.5 bg-eeg-accent opacity-60" />
        </div>
        {/* Centred typical-range label */}
        <span
          className="absolute text-[10px] font-mono whitespace-nowrap"
          style={{
            left: `${tmid}%`,
            transform: 'translateX(-50%)',
            color: inTypical ? '#00FFB0' : '#5A6A82',
          }}
        >
          typical clinical
        </span>
      </div>

      <p className="text-[10px] font-mono text-eeg-muted mt-1.5 leading-relaxed">
        The shaded band (<span className="text-eeg-accent">σ 0.30–0.45</span>)
        spans the spatial extent of a typical focal interictal sharp wave.
        Slide outside it to see tighter foci or generalised fields.
      </p>
    </div>
  )
}

// =============================================================================
// CHANNEL MINI-MAP — synced with the EEG canvas hover state
// =============================================================================

// A compact head diagram that lights up the electrode pair contributing to the
// EEG channel currently under the user's cursor. Lives in the right gutter of
// the EEG card so the user can correlate trace ↔ scalp anatomy without having
// to glance back up at the source picker.
function ChannelMiniMap({ hoveredElectrodes, hoveredChannelLabel, sourceElec, isBipolar }) {
  const SIZE = 168
  const R    = 64
  const CX   = SIZE / 2
  const CY   = SIZE / 2 + 4
  const toSv = (nx, ny) => ({ x: CX + nx * R, y: CY - ny * R })

  const { pos, neg, polarity } = hoveredElectrodes

  // Polarity-aware colours mirror the EEG canvas's trace colours so the
  // user sees the same visual language across both elements.
  const posColor = isBipolar
    ? (polarity > 0 ? '#FF6B35' : polarity < 0 ? '#00D4FF' : '#FFD166')
    : '#FF6B35'
  const negColor = isBipolar
    ? (polarity > 0 ? '#00D4FF' : polarity < 0 ? '#FF6B35' : '#FFD166')
    : '#5A6A82'

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE + 4}`} width={SIZE} height={SIZE + 4}
         style={{ display: 'block' }}>
      {/* Head outline */}
      <circle cx={CX} cy={CY} r={R} fill="#0D1424" stroke="#1E2A40" strokeWidth="1.2" />
      {/* Nose */}
      <path
        d={`M${CX - 6} ${CY - R + 4} Q${CX} ${CY - R - 9} ${CX + 6} ${CY - R + 4}`}
        fill="none" stroke="#2A3A54" strokeWidth="1.2"
      />
      {/* Ears */}
      <ellipse cx={CX - R - 4} cy={CY + 2} rx="3.5" ry="6" fill="none" stroke="#2A3A54" strokeWidth="1" />
      <ellipse cx={CX + R + 4} cy={CY + 2} rx="3.5" ry="6" fill="none" stroke="#2A3A54" strokeWidth="1" />
      {/* Crosshairs */}
      <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="#1E2A4055" strokeWidth="0.5" strokeDasharray="2,3" />
      <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="#1E2A4055" strokeWidth="0.5" strokeDasharray="2,3" />

      {/* Connector line between the two highlighted electrodes (only useful for bipolar) */}
      {pos && neg && isBipolar && (() => {
        const a = toSv(ELECTRODE_POSITIONS_2D[pos].x, ELECTRODE_POSITIONS_2D[pos].y)
        const b = toSv(ELECTRODE_POSITIONS_2D[neg].x, ELECTRODE_POSITIONS_2D[neg].y)
        return (
          <line
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#FFD16699" strokeWidth="1.5" strokeDasharray="3,3"
          />
        )
      })()}

      {/* All electrodes — dim by default, prominent if highlighted or source */}
      {SELECTABLE_ELECTRODES.map((elec) => {
        const p   = ELECTRODE_POSITIONS_2D[elec]
        const sv  = toSv(p.x, p.y)
        const isPos    = elec === pos
        const isNeg    = elec === neg
        const isSource = elec === sourceElec
        let r       = 2.4
        let fill    = '#0D1424'
        let stroke  = '#2A3A5488'
        let sw      = 0.7
        let label   = false

        if (isSource && !isPos && !isNeg) {
          fill   = '#FF333344'
          stroke = '#FF3333'
          r      = 3.2
          sw     = 1.2
        }
        if (isPos) {
          fill   = posColor + 'AA'
          stroke = posColor
          r      = 4.5
          sw     = 1.6
          label  = true
        }
        if (isNeg) {
          fill   = negColor + 'AA'
          stroke = negColor
          r      = 4.5
          sw     = 1.6
          label  = true
        }
        return (
          <g key={elec}>
            <circle cx={sv.x} cy={sv.y} r={r}
              fill={fill} stroke={stroke} strokeWidth={sw} />
            {label && (
              <text
                x={sv.x + (p.x < -0.6 ? -7 : p.x > 0.6 ? 7 : 0)}
                y={sv.y + (p.y > 0.6 ? -8 : p.y < -0.6 ? 12 : 4)}
                textAnchor={p.x < -0.6 ? 'end' : p.x > 0.6 ? 'start' : 'middle'}
                fontSize="7"
                fontFamily="DM Mono, monospace"
                fontWeight="bold"
                fill={isPos ? posColor : negColor}
              >
                {elec}
              </text>
            )}
          </g>
        )
      })}

      {/* Channel label / placeholder */}
      <text x={CX} y={SIZE} textAnchor="middle" fontSize="8.5"
        fontFamily="DM Mono, monospace" fill="#5A6A82" fontWeight="bold">
        {hoveredChannelLabel ?? '—'}
      </text>
    </svg>
  )
}
