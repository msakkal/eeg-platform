import React, { useRef, useEffect, useCallback, useState } from 'react'
import { applyFilterChain }   from '@/engine/filters'
import { SAMPLE_RATE }        from '@/engine/signalGenerator'
import { getViewerTheme, DEFAULT_SENSITIVITY } from '@/engine/viewerThemes'

const CHANNEL_HEIGHT   = 48
const LEFT_LABEL_WIDTH = 72

/**
 * Vertical scale of the canvas, in pixels per millimetre. Sensitivity converts
 * voltage to millimetres (µV ÷ µV/mm); this converts millimetres to pixels.
 * At PX_PER_MM = 2 and the default 7 µV/mm a normal ~50 µV pp rhythm spans
 * roughly a third of a channel band, leaving the clear separation between
 * adjacent traces seen on a clinical EEG screen.
 */
const PX_PER_MM = 2

/**
 * EEGViewer
 * High-performance Canvas-based multi-channel EEG renderer.
 * Supports: annotations overlay, digital filter, click-to-annotate,
 *           hover cursor + channel highlight, swappable colour themes.
 *
 * Props:
 *   channels      - Array<{ label, data: Float32Array }>
 *   timeAxis      - number[]
 *   sensitivity   - display sensitivity in µV/mm (default 7)
 *   isPlaying     - bool
 *   filterConfig  - { hp, lp, notch } | null
 *   annotations   - Array<{ id, timeS, label, color }>
 *   windowStart   - seconds offset for annotation time mapping
 *   onAnnotate    - (timeS, channelLabel) => void — enables crosshair+click
 *   theme         - viewer theme id (see engine/viewerThemes.js)
 */
export default function EEGViewer({
  channels      = [],
  timeAxis      = [],
  sensitivity   = DEFAULT_SENSITIVITY,
  isPlaying     = true,
  filterConfig  = null,
  annotations   = [],
  windowStart   = 0,
  onAnnotate    = null,
  theme         = 'midnight',
  className     = '',
}) {
  const canvasRef  = useRef(null)
  const dprRef     = useRef(window.devicePixelRatio || 1)
  const [hoverX,   setHoverX]  = useState(null)
  const [hoverCh,  setHoverCh] = useState(null)

  // Apply digital filter chain if configured
  const getFilteredChannels = useCallback(() => {
    if (!filterConfig || (!filterConfig.hp && !filterConfig.lp && !filterConfig.notch)) {
      return channels
    }
    return channels.map(ch => ({
      ...ch,
      data: ch.data?.length
        ? applyFilterChain(ch.data, SAMPLE_RATE, filterConfig)
        : ch.data,
    }))
  }, [channels, filterConfig])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || channels.length === 0) return

    const th   = getViewerTheme(theme)
    const dpr  = dprRef.current
    const W    = canvas.clientWidth
    const chs  = getFilteredChannels()
    const nCh  = chs.length
    const H    = nCh * CHANNEL_HEIGHT + 24

    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width        = W * dpr
      canvas.height       = H * dpr
      canvas.style.height = `${H}px`
    }

    const ctx      = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const plotW    = W - LEFT_LABEL_WIDTH
    const plotH    = H - 24
    const duration = timeAxis[timeAxis.length - 1] ?? 10
    // Clinical sensitivity → pixels: µV ÷ (µV/mm) gives mm, × px/mm gives px.
    // A smaller sensitivity number therefore yields a larger deflection.
    const pxPerUv  = PX_PER_MM / sensitivity

    // Page + plot backgrounds
    ctx.fillStyle = th.pageBg
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = th.plotBg
    ctx.fillRect(LEFT_LABEL_WIDTH, 0, plotW, plotH)

    // ── EEG paper grid (5 mm squares) ──────────────────────────────────────
    // Standard EEG ruling: 5 mm minor squares with every 5th line (25 mm)
    // drawn heavier. The vertical lines scroll horizontally in lock-step with
    // the streaming trace — exactly as ruled chart paper feeds under the pens
    // — while the horizontal lines stay fixed (the amplitude axis is static).
    const mmGrid   = 5 * PX_PER_MM            // 5 mm square, in pixels
    const pxPerSec = plotW / duration
    const scrollPx = windowStart * pxPerSec   // total leftward travel so far

    // Vertical lines (scrolling) — minor pass then major pass
    {
      const kStart = Math.ceil(scrollPx / mmGrid)
      const kEnd   = Math.floor((scrollPx + plotW) / mmGrid)
      for (const major of [false, true]) {
        ctx.strokeStyle = major ? th.gridMajor : th.gridMinor
        ctx.lineWidth   = 1
        ctx.beginPath()
        for (let k = kStart; k <= kEnd; k++) {
          if ((k % 5 === 0) !== major) continue
          const x = LEFT_LABEL_WIDTH + k * mmGrid - scrollPx
          ctx.moveTo(x, 0); ctx.lineTo(x, plotH)
        }
        ctx.stroke()
      }
    }
    // Horizontal lines (fixed)
    for (const major of [false, true]) {
      ctx.strokeStyle = major ? th.gridMajor : th.gridMinor
      ctx.lineWidth   = 1
      ctx.beginPath()
      for (let j = 0; j * mmGrid <= plotH; j++) {
        if ((j % 5 === 0) !== major) continue
        const y = j * mmGrid
        ctx.moveTo(LEFT_LABEL_WIDTH, y); ctx.lineTo(W, y)
      }
      ctx.stroke()
    }
    // Second markers — scroll with the trace, labelled in elapsed seconds
    ctx.fillStyle    = th.axisText
    ctx.font         = `10px "DM Mono", monospace`
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'alphabetic'
    for (let s = Math.ceil(windowStart); s <= Math.floor(windowStart + duration); s++) {
      const x = LEFT_LABEL_WIDTH + (s - windowStart) * pxPerSec
      if (x < LEFT_LABEL_WIDTH || x > W - 12) continue
      ctx.fillText(`${s}s`, x + 3, H - 8)
    }

    // Annotation lines
    annotations.forEach(ann => {
      const relTime = ann.timeS - windowStart
      if (relTime < 0 || relTime > duration) return
      const x = LEFT_LABEL_WIDTH + (relTime / duration) * plotW
      ctx.strokeStyle = ann.color + '99'
      ctx.lineWidth   = 1.5
      ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, plotH); ctx.stroke()
      ctx.setLineDash([])
      // Flag tab
      ctx.fillStyle = ann.color
      ctx.beginPath()
      ctx.moveTo(x, 4); ctx.lineTo(x + 34, 4); ctx.lineTo(x + 40, 11)
      ctx.lineTo(x + 34, 18); ctx.lineTo(x, 18); ctx.closePath(); ctx.fill()
      ctx.fillStyle    = th.annotationText
      ctx.font         = '7px "DM Mono", monospace'
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(ann.label?.slice(0, 10), x + 3, 11)
    })

    // Hover cursor
    if (hoverX !== null) {
      const hoverTime = ((hoverX - LEFT_LABEL_WIDTH) / plotW) * duration
      ctx.strokeStyle = th.cursorLine
      ctx.lineWidth   = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(hoverX, 0); ctx.lineTo(hoverX, plotH); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle    = th.cursorBox
      ctx.fillRect(hoverX + 4, 2, 38, 14)
      ctx.fillStyle    = th.cursorText
      ctx.font         = '8px "DM Mono", monospace'
      ctx.textAlign    = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(`${hoverTime.toFixed(2)}s`, hoverX + 7, 9)
    }

    // Channels
    chs.forEach(({ label, data }, idx) => {
      const cy        = idx * CHANNEL_HEIGHT + CHANNEL_HEIGHT / 2
      const isHovered = hoverCh === idx

      if (isHovered) {
        ctx.fillStyle = th.rowHover
        ctx.fillRect(LEFT_LABEL_WIDTH, cy - CHANNEL_HEIGHT / 2, plotW, CHANNEL_HEIGHT)
      }

      ctx.strokeStyle = isHovered ? th.baselineHover : th.baseline
      ctx.lineWidth   = 0.5
      ctx.beginPath(); ctx.moveTo(LEFT_LABEL_WIDTH, cy + CHANNEL_HEIGHT / 2)
      ctx.lineTo(W, cy + CHANNEL_HEIGHT / 2); ctx.stroke()

      ctx.strokeStyle = th.midline
      ctx.beginPath(); ctx.moveTo(LEFT_LABEL_WIDTH, cy); ctx.lineTo(W, cy); ctx.stroke()

      if (!data || data.length === 0) return

      const nPts = data.length

      ctx.strokeStyle = isHovered ? th.signalHover : th.signal
      ctx.lineWidth   = isHovered ? 1.6 : 1.2
      if (th.glow) {
        ctx.shadowColor = isHovered ? th.glowHover : th.glow
        ctx.shadowBlur  = isHovered ? th.glowBlur * 2 : th.glowBlur
      }
      ctx.beginPath()
      for (let i = 0; i < nPts; i++) {
        const x = LEFT_LABEL_WIDTH + (i / nPts) * plotW
        const y = cy - data[i] * pxPerUv
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    })

    // Calibration bar — a fixed-voltage vertical reference, as printed at the
    // start of a clinical EEG. Its height encodes `calUv` µV at the current
    // sensitivity, so it rescales whenever the sensitivity setting changes.
    {
      const calUv = 50
      const calH  = calUv * pxPerUv
      const calX  = LEFT_LABEL_WIDTH + 14
      const calY  = plotH - 12
      ctx.strokeStyle = th.axisText
      ctx.lineWidth   = 1.5
      ctx.beginPath()
      ctx.moveTo(calX, calY);          ctx.lineTo(calX, calY - calH)
      ctx.moveTo(calX - 3, calY);      ctx.lineTo(calX + 3, calY)
      ctx.moveTo(calX - 3, calY - calH); ctx.lineTo(calX + 3, calY - calH)
      ctx.stroke()
      ctx.fillStyle    = th.axisText
      ctx.font         = '9px "DM Mono", monospace'
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${calUv} µV`, calX + 7, calY - calH / 2)
    }

    // Label column overlay
    ctx.fillStyle = th.labelBg
    ctx.fillRect(0, 0, LEFT_LABEL_WIDTH, H)
    ctx.strokeStyle = th.divider; ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(LEFT_LABEL_WIDTH, 0); ctx.lineTo(LEFT_LABEL_WIDTH, plotH); ctx.stroke()

    chs.forEach(({ label }, idx) => {
      const cy        = idx * CHANNEL_HEIGHT + CHANNEL_HEIGHT / 2
      const isHovered = hoverCh === idx
      ctx.fillStyle    = isHovered ? th.chanLabelHover : th.chanLabel
      ctx.font         = `${isHovered ? 'bold ' : ''}10px "DM Mono", monospace`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, LEFT_LABEL_WIDTH - 6, cy)
    })
  }, [channels, timeAxis, sensitivity, getFilteredChannels, annotations, windowStart, hoverX, hoverCh, theme])

  useEffect(() => { draw() }, [draw])

  function handleMouseMove(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect  = canvas.getBoundingClientRect()
    const x     = e.clientX - rect.left
    const y     = e.clientY - rect.top
    if (x < LEFT_LABEL_WIDTH) { setHoverX(null); setHoverCh(null); return }
    setHoverX(x)
    const chIdx = Math.floor(y / CHANNEL_HEIGHT)
    setHoverCh(chIdx >= 0 && chIdx < channels.length ? chIdx : null)
  }

  function handleClick(e) {
    if (!onAnnotate) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect     = canvas.getBoundingClientRect()
    const x        = e.clientX - rect.left
    if (x < LEFT_LABEL_WIDTH) return
    const duration = timeAxis[timeAxis.length - 1] ?? 10
    const plotW    = canvas.clientWidth - LEFT_LABEL_WIDTH
    const relTime  = ((x - LEFT_LABEL_WIDTH) / plotW) * duration
    const chIdx    = Math.floor((e.clientY - rect.top) / CHANNEL_HEIGHT)
    onAnnotate(windowStart + relTime, channels[chIdx]?.label ?? '')
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ imageRendering: 'crisp-edges', cursor: onAnnotate ? 'crosshair' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoverX(null); setHoverCh(null) }}
        onClick={handleClick}
      />
    </div>
  )
}
