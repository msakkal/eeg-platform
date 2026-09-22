import React, { useRef, useEffect, useMemo } from 'react'
import { computePSD, computeBandPowers, EEG_BANDS } from '@/engine/fft'
import { SAMPLE_RATE } from '@/engine/signalGenerator'

const CANVAS_H   = 140
const BAR_H      = 52
const PADDING    = { top: 10, right: 12, bottom: 28, left: 42 }

/**
 * SpectrumViewer
 * Renders a live power spectral density curve and per-band power bars.
 *
 * Props:
 *   signal  - Float32Array (one channel, recent window)
 *   color   - hex string for the PSD line
 *   maxFreq - display limit in Hz (default 40)
 */
export default function SpectrumViewer({
  signal,
  revision = 0,
  color   = '#00FFB0',
  maxFreq = 40,
  className = '',
}) {
  const psdCanvasRef  = useRef(null)
  const barCanvasRef  = useRef(null)
  const dpr           = window.devicePixelRatio || 1

  // Compute dB PSD for plotting and linear PSD for relative band power.
  const { freqs, psd, linearPsd } = useMemo(() => {
    if (!signal || signal.length < 64) {
      return {
        freqs: new Float64Array(),
        psd: new Float64Array(),
        linearPsd: new Float64Array(),
      }
    }
    const linear = computePSD(signal, SAMPLE_RATE, { dbScale: false })
    const psdDb = new Float64Array(linear.psd.length)
    for (let i = 0; i < linear.psd.length; i++) {
      psdDb[i] = 10 * Math.log10(linear.psd[i] + 1e-12)
    }
    return { freqs: linear.freqs, psd: psdDb, linearPsd: linear.psd }
  }, [signal, revision])

  // Compute band powers
  const bands = useMemo(() => {
    if (!freqs.length) return {}
    return computeBandPowers(freqs, linearPsd)
  }, [freqs, linearPsd])

  // ── Draw PSD curve ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = psdCanvasRef.current
    if (!canvas || !freqs.length) return

    const W = canvas.clientWidth
    const H = CANVAS_H
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.height = `${H}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const plotW = W - PADDING.left - PADDING.right
    const plotH = H - PADDING.top  - PADDING.bottom

    // ── Background ──────────────────────────────────────────────────────
    ctx.fillStyle = '#0D1424'
    ctx.fillRect(PADDING.left, PADDING.top, plotW, plotH)

    // ── Band region tints ────────────────────────────────────────────────
    const fScale = (f) => PADDING.left + (f / maxFreq) * plotW
    Object.entries(EEG_BANDS).forEach(([key, { min, max, color: bc }]) => {
      if (min > maxFreq) return
      const x1 = fScale(Math.max(0, min))
      const x2 = fScale(Math.min(maxFreq, max))
      ctx.fillStyle = bc + '18'
      ctx.fillRect(x1, PADDING.top, x2 - x1, plotH)
      // Band label
      ctx.fillStyle = bc + '88'
      ctx.font = `8px "DM Mono", monospace`
      ctx.textAlign = 'center'
      ctx.fillText(key.toUpperCase(), (x1 + x2) / 2, PADDING.top + plotH + 10)
    })

    // ── Grid lines ────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,212,255,0.07)'
    ctx.lineWidth   = 0.5
    for (let f = 0; f <= maxFreq; f += 5) {
      const x = fScale(f)
      ctx.beginPath(); ctx.moveTo(x, PADDING.top); ctx.lineTo(x, PADDING.top + plotH); ctx.stroke()
      // Freq label
      ctx.fillStyle   = '#5A6A82'
      ctx.font        = '8px "DM Mono", monospace'
      ctx.textAlign   = 'center'
      ctx.fillText(`${f}`, x, PADDING.top + plotH + 20)
    }

    // ── Trim and normalise PSD ────────────────────────────────────────────
    const trimmed = []
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] <= maxFreq) trimmed.push({ f: freqs[i], p: psd[i] })
    }
    const pMin = Math.min(...trimmed.map(p => p.p))
    const pMax = Math.max(...trimmed.map(p => p.p))
    const pRange = pMax - pMin || 1
    const pScale = (p) => PADDING.top + plotH - ((p - pMin) / pRange) * plotH

    // Y axis labels
    ctx.fillStyle   = '#5A6A82'
    ctx.font        = '8px "DM Mono", monospace'
    ctx.textAlign   = 'right'
    ctx.fillText(`${pMax.toFixed(0)}`, PADDING.left - 4, PADDING.top + 6)
    ctx.fillText(`${pMin.toFixed(0)}`, PADDING.left - 4, PADDING.top + plotH)
    ctx.fillText('dB', PADDING.left - 4, PADDING.top + plotH / 2)

    // ── Gradient fill under curve ─────────────────────────────────────────
    if (trimmed.length > 1) {
      const grad = ctx.createLinearGradient(0, PADDING.top, 0, PADDING.top + plotH)
      grad.addColorStop(0, color + 'AA')
      grad.addColorStop(1, color + '00')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(fScale(trimmed[0].f), PADDING.top + plotH)
      trimmed.forEach(({ f, p }) => ctx.lineTo(fScale(f), pScale(p)))
      ctx.lineTo(fScale(trimmed[trimmed.length - 1].f), PADDING.top + plotH)
      ctx.closePath()
      ctx.fill()
    }

    // ── PSD curve ─────────────────────────────────────────────────────────
    if (trimmed.length > 1) {
      ctx.strokeStyle = color
      ctx.lineWidth   = 1.5
      ctx.shadowColor = color
      ctx.shadowBlur  = 5
      ctx.beginPath()
      trimmed.forEach(({ f, p }, i) => {
        const x = fScale(f)
        const y = pScale(p)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // ── Axes ──────────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,212,255,0.2)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(PADDING.left, PADDING.top)
    ctx.lineTo(PADDING.left, PADDING.top + plotH)
    ctx.lineTo(PADDING.left + plotW, PADDING.top + plotH)
    ctx.stroke()

  }, [freqs, psd, color, maxFreq])

  // ── Draw band power bars ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = barCanvasRef.current
    if (!canvas || !Object.keys(bands).length) return

    const W = canvas.clientWidth
    const H = BAR_H + 24
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.height = `${H}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const bandKeys = Object.keys(EEG_BANDS)
    const barW     = (W - 20) / bandKeys.length - 4
    const maxPow   = Math.max(...Object.values(bands))

    bandKeys.forEach((key, i) => {
      const { label, color: bc } = EEG_BANDS[key]
      const power  = bands[key] ?? 0
      const x      = 10 + i * ((W - 20) / bandKeys.length)
      const barH   = maxPow > 0 ? (power / maxPow) * BAR_H : 0

      // Bar background
      ctx.fillStyle = '#1E2A40'
      ctx.beginPath()
      ctx.roundRect(x, H - 20 - BAR_H, barW, BAR_H, 3)
      ctx.fill()

      // Bar fill
      const grad = ctx.createLinearGradient(0, H - 20 - barH, 0, H - 20)
      grad.addColorStop(0, bc + 'EE')
      grad.addColorStop(1, bc + '44')
      ctx.fillStyle = grad
      ctx.shadowColor = bc
      ctx.shadowBlur  = 6
      ctx.beginPath()
      ctx.roundRect(x, H - 20 - barH, barW, barH, 3)
      ctx.fill()
      ctx.shadowBlur = 0

      // Band label
      ctx.fillStyle   = bc + 'CC'
      ctx.font        = `8px "DM Mono", monospace`
      ctx.textAlign   = 'center'
      ctx.fillText(label.split(' ')[0], x + barW / 2, H - 6)

      // Percentage label
      ctx.fillStyle = '#E8EDF5CC'
      ctx.font      = `7px "DM Mono", monospace`
      ctx.fillText(`${(power * 100).toFixed(0)}%`, x + barW / 2, H - 20 - barH - 3)
    })
  }, [bands])

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-mono text-eeg-muted uppercase tracking-widest">Power Spectrum</span>
        <span className="text-xs font-mono" style={{ color }}>0–{maxFreq} Hz</span>
      </div>
      <canvas ref={psdCanvasRef} className="w-full block rounded" role="img"
        aria-label={`EEG power spectrum from 0 to ${maxFreq} hertz`}>
        EEG power spectrum from 0 to {maxFreq} hertz.
      </canvas>
      <div className="flex items-center justify-between px-1 mt-1">
        <span className="text-xs font-mono text-eeg-muted uppercase tracking-widest">Band Power</span>
      </div>
      <canvas ref={barCanvasRef} className="w-full block rounded" role="img"
        aria-label="Relative EEG band power for delta, theta, alpha, beta, and gamma bands">
        Relative EEG band power for delta, theta, alpha, beta, and gamma bands.
      </canvas>
    </div>
  )
}
