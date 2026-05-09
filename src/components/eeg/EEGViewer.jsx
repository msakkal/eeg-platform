import React, { useRef, useEffect, useCallback, useState } from 'react'
import { applyFilterChain } from '@/engine/filters'
import { SAMPLE_RATE }      from '@/engine/signalGenerator'

const CHANNEL_HEIGHT   = 48
const LEFT_LABEL_WIDTH = 72
const SIGNAL_COLOR     = '#00FFB0'
const LABEL_COLOR      = '#5A6A82'
const AXIS_COLOR       = 'rgba(0,212,255,0.12)'

/**
 * EEGViewer
 * High-performance Canvas-based multi-channel EEG renderer.
 * Supports: annotations overlay, digital filter, click-to-annotate,
 *           hover cursor + channel highlight.
 *
 * Props:
 *   channels      - Array<{ label, data: Float32Array }>
 *   timeAxis      - number[]
 *   gain          - amplitude scale (default 1)
 *   isPlaying     - bool
 *   filterConfig  - { hp, lp, notch } | null
 *   annotations   - Array<{ id, timeS, label, color }>
 *   windowStart   - seconds offset for annotation time mapping
 *   onAnnotate    - (timeS, channelLabel) => void — enables crosshair+click
 */
export default function EEGViewer({
  channels      = [],
  timeAxis      = [],
  gain          = 1,
  isPlaying     = true,
  filterConfig  = null,
  annotations   = [],
  windowStart   = 0,
  onAnnotate    = null,
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
    const duration = timeAxis[timeAxis.length - 1] ?? 10

    // Background
    ctx.fillStyle = '#0D1424'
    ctx.fillRect(LEFT_LABEL_WIDTH, 0, plotW, H - 24)

    // Grid
    for (let t = 0; t <= duration; t++) {
      const x = LEFT_LABEL_WIDTH + (t / duration) * plotW
      ctx.strokeStyle = AXIS_COLOR
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 24); ctx.stroke()
      if (t < duration) {
        ctx.fillStyle    = LABEL_COLOR
        ctx.font         = `10px "DM Mono", monospace`
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(`${t}s`, x + 3, H - 8)
      }
    }

    // Annotation lines
    annotations.forEach(ann => {
      const relTime = ann.timeS - windowStart
      if (relTime < 0 || relTime > duration) return
      const x = LEFT_LABEL_WIDTH + (relTime / duration) * plotW
      ctx.strokeStyle = ann.color + '99'
      ctx.lineWidth   = 1.5
      ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 24); ctx.stroke()
      ctx.setLineDash([])
      // Flag tab
      ctx.fillStyle = ann.color
      ctx.beginPath()
      ctx.moveTo(x, 4); ctx.lineTo(x + 34, 4); ctx.lineTo(x + 40, 11)
      ctx.lineTo(x + 34, 18); ctx.lineTo(x, 18); ctx.closePath(); ctx.fill()
      ctx.fillStyle    = '#0A0E1A'
      ctx.font         = '7px "DM Mono", monospace'
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(ann.label?.slice(0, 10), x + 3, 11)
    })

    // Hover cursor
    if (hoverX !== null) {
      const hoverTime = ((hoverX - LEFT_LABEL_WIDTH) / plotW) * duration
      ctx.strokeStyle = 'rgba(255,213,102,0.35)'
      ctx.lineWidth   = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(hoverX, 0); ctx.lineTo(hoverX, H - 24); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle    = '#FFD16699'
      ctx.fillRect(hoverX + 4, 2, 38, 14)
      ctx.fillStyle    = '#0A0E1A'
      ctx.font         = '8px "DM Mono", monospace'
      ctx.textAlign    = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(`${hoverTime.toFixed(2)}s`, hoverX + 7, 9)
    }

    // Channels
    chs.forEach(({ label, data }, idx) => {
      const cy        = idx * CHANNEL_HEIGHT + CHANNEL_HEIGHT / 2
      const isHovered = hoverCh === idx

      if (isHovered) {
        ctx.fillStyle = 'rgba(0,212,255,0.04)'
        ctx.fillRect(LEFT_LABEL_WIDTH, cy - CHANNEL_HEIGHT / 2, plotW, CHANNEL_HEIGHT)
      }

      ctx.strokeStyle = isHovered ? 'rgba(0,212,255,0.2)' : 'rgba(0,212,255,0.07)'
      ctx.lineWidth   = 0.5
      ctx.beginPath(); ctx.moveTo(LEFT_LABEL_WIDTH, cy + CHANNEL_HEIGHT / 2)
      ctx.lineTo(W, cy + CHANNEL_HEIGHT / 2); ctx.stroke()

      ctx.strokeStyle = 'rgba(0,212,255,0.06)'
      ctx.beginPath(); ctx.moveTo(LEFT_LABEL_WIDTH, cy); ctx.lineTo(W, cy); ctx.stroke()

      if (!data || data.length === 0) return

      const nPts   = data.length
      // Display calibration: at gain=1 a 50µV peak signal fills the half-band,
      // i.e. a 100µV peak-to-peak signal fills the full channel band. This
      // matches the clinical convention of "5–10µV/mm" sensitivity at typical
      // screen resolutions, so a normal posterior alpha (~50–70µV pp) takes
      // up roughly half the channel as it does on a real EEG monitor.
      const maxAmp = 50 * gain
      const halfH  = CHANNEL_HEIGHT / 2 - 4

      ctx.strokeStyle = isHovered ? '#00D4FF' : SIGNAL_COLOR
      ctx.lineWidth   = isHovered ? 1.6 : 1.2
      ctx.shadowColor = isHovered ? '#00D4FF' : SIGNAL_COLOR
      ctx.shadowBlur  = isHovered ? 8 : 4
      ctx.beginPath()
      for (let i = 0; i < nPts; i++) {
        const x = LEFT_LABEL_WIDTH + (i / nPts) * plotW
        const y = cy - (data[i] / maxAmp) * halfH
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    })

    // Label column overlay
    ctx.fillStyle = '#0A0E1A'
    ctx.fillRect(0, 0, LEFT_LABEL_WIDTH, H)
    ctx.strokeStyle = AXIS_COLOR; ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(LEFT_LABEL_WIDTH, 0); ctx.lineTo(LEFT_LABEL_WIDTH, H - 24); ctx.stroke()

    chs.forEach(({ label }, idx) => {
      const cy        = idx * CHANNEL_HEIGHT + CHANNEL_HEIGHT / 2
      const isHovered = hoverCh === idx
      ctx.fillStyle    = isHovered ? '#00D4FF' : LABEL_COLOR
      ctx.font         = `${isHovered ? 'bold ' : ''}10px "DM Mono", monospace`
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, LEFT_LABEL_WIDTH - 6, cy)
    })
  }, [channels, timeAxis, gain, getFilteredChannels, annotations, windowStart, hoverX, hoverCh])

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
