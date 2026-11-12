import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import { useRef, useEffect } from 'react'
import { EEG_BANDS } from '@/engine/fft'
import { useSpectrogramWorker } from '@/hooks/useSpectrogramWorker'

const HEIGHT = 120
const LABEL_W = 36
const FREQ_LABEL_H = 16

// Turbo-inspired colormap: maps 0–1 → RGB
function colourmap(t) {
  // Deep blue → cyan → green → yellow → red
  const r = Math.round(
    255 *
      Math.min(
        1,
        Math.max(
          0,
          t < 0.25 ? 0 : t < 0.5 ? (t - 0.25) / 0.25 : t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25,
        ),
      ),
  )
  const g = Math.round(
    255 *
      Math.min(
        1,
        Math.max(0, t < 0.1 ? 0 : t < 0.4 ? (t - 0.1) / 0.3 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3),
      ),
  )
  const b = Math.round(
    255 * Math.min(1, Math.max(0, t < 0.3 ? 1 : t < 0.5 ? 1 - (t - 0.3) / 0.2 : 0)),
  )
  return `rgb(${r},${g},${b})`
}

/**
 * SpectrogramViewer
 * Renders a STFT spectrogram heatmap of a single EEG channel.
 *
 * Props:
 *   signal   - Float32Array
 *   maxFreq  - Hz upper limit (default 40)
 *   label    - channel label string
 */
export default function SpectrogramViewer({
  signal,
  revision = 0,
  maxFreq = 40,
  label = 'Ch',
  className = '',
}) {
  const language = useLocale()
  const canvasRef = useRef(null)
  const dpr = window.devicePixelRatio || 1

  const spectroData = useSpectrogramWorker(signal, maxFreq, revision)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!spectroData?.matrix.length || !spectroData?.freqBins.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    const { freqBins, matrix } = spectroData
    const nTime = matrix.length
    const nFreq = freqBins.length
    if (!nTime || !nFreq) return

    const W = canvas.clientWidth
    const H = HEIGHT + FREQ_LABEL_H
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.height = `${H}px`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = '#0A0E1A'
    ctx.fillRect(0, 0, W, H)

    // Compute global min/max for normalisation (excluding -∞ dB)
    let pMin = Infinity,
      pMax = -Infinity
    matrix.forEach((col) =>
      col.forEach((v) => {
        if (isFinite(v)) {
          pMin = Math.min(pMin, v)
          pMax = Math.max(pMax, v)
        }
      }),
    )
    const pRange = pMax - pMin || 1
    const plotW = W - LABEL_W
    const cellW = plotW / nTime
    const cellH = HEIGHT / nFreq

    // Draw cells
    matrix.forEach((col, ti) => {
      const x = LABEL_W + ti * cellW
      col.forEach((v, fi) => {
        // Invert fi because canvas y=0 is top, we want low freq at bottom
        const y = HEIGHT - (fi + 1) * cellH
        const norm = (v - pMin) / pRange
        ctx.fillStyle = colourmap(Math.pow(norm, 0.6)) // gamma correct
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5)
      })
    })

    // Band boundary lines
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 0.5
    Object.values(EEG_BANDS).forEach(({ min }) => {
      if (min > maxFreq) return
      const y = HEIGHT - (min / maxFreq) * HEIGHT
      ctx.beginPath()
      ctx.moveTo(LABEL_W, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    })

    // Freq axis labels
    ctx.fillStyle = '#5A6A82'
    ctx.font = `8px "DM Mono", monospace`
    ctx.textAlign = 'right'
    ;[0, 10, 20, 30, 40]
      .filter((f) => f <= maxFreq)
      .forEach((f) => {
        const y = HEIGHT - (f / maxFreq) * HEIGHT
        ctx.fillText(localize(`${f}`), LABEL_W - 3, y + 3)
        ctx.strokeStyle = 'rgba(0,212,255,0.08)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(LABEL_W, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      })

    // Y label
    ctx.save()
    ctx.translate(10, HEIGHT / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = '#5A6A82'
    ctx.font = '8px "DM Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(localize('Hz', language), 0, 0)
    ctx.restore()

    // Colorbar (legend strip)
    const cbX = W - 6
    const grad = ctx.createLinearGradient(0, HEIGHT, 0, 0)
    for (let i = 0; i <= 10; i++) {
      grad.addColorStop(i / 10, colourmap(i / 10))
    }
    ctx.fillStyle = grad
    ctx.fillRect(cbX, 0, 6, HEIGHT)
  }, [spectroData, maxFreq, dpr, language])

  return (
    <div className={className}>
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-mono text-eeg-muted uppercase tracking-widest">
          {localize('Spectrogram')}
        </span>
        <span className="text-xs font-mono text-eeg-muted">{localize(label)}</span>
      </div>
      <canvas
        dir="ltr"
        ref={canvasRef}
        className="w-full block rounded"
        role="img"
        aria-label={localize(`EEG spectrogram for ${label || 'selected channel'}`)}
      >
        {localize('Time-frequency spectrogram for ')}
        {localize(label || 'the selected EEG channel')}.
      </canvas>
    </div>
  )
}
