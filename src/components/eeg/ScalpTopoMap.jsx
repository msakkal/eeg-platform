import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import { useRef, useEffect, useMemo } from 'react'
import { scalpChannelRMS } from '@/engine/scalpAmplitude'

/**
 * ScalpTopoMap
 * Renders a real-time 2D topographic map of EEG amplitude across the scalp.
 * Uses bilinear interpolation on a polar grid derived from the 10-20 positions.
 *
 * Props:
 *   channels  - Array<{ label, data: Float32Array }>  (montage-derived channels)
 *   montageId - common-reference montage for the supplied channels
 *   revision - sample revision for reused streaming buffers
 *   size      - canvas pixel size (default 200)
 */
export default function ScalpTopoMap({ channels = [], montageId, revision = 0, size = 200 }) {
  const language = useLocale()
  const canvasRef = useRef(null)
  const dpr = window.devicePixelRatio || 1

  // The sample buffers may be reused between frames; revision invalidates RMS.
  const amplitudes = useMemo(() => {
    void revision
    return scalpChannelRMS(channels, montageId)
  }, [channels, montageId, revision])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !amplitudes) return

    const S = size
    const dS = S * dpr
    canvas.width = dS
    canvas.height = dS
    canvas.style.width = `${S}px`
    canvas.style.height = `${S}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, S, S)

    const cx = S / 2
    const cy = S / 2
    const R = S * 0.42 // scalp radius in pixels

    // ── Electrode positions (normalised -1..1 in head-centred coords) ──────
    // x = left(-1)..right(+1), y = front(+1)..back(-1)
    const positions = {
      Fp1: [-0.27, 0.85],
      Fp2: [0.27, 0.85],
      F7: [-0.72, 0.51],
      F3: [-0.38, 0.51],
      Fz: [0.0, 0.51],
      F4: [0.38, 0.51],
      F8: [0.72, 0.51],
      T7: [-0.87, 0.0],
      C3: [-0.45, 0.0],
      Cz: [0.0, 0.0],
      C4: [0.45, 0.0],
      T8: [0.87, 0.0],
      P7: [-0.72, -0.51],
      P3: [-0.38, -0.51],
      Pz: [0.0, -0.51],
      P4: [0.38, -0.51],
      P8: [0.72, -0.51],
      O1: [-0.27, -0.85],
      O2: [0.27, -0.85],
    }

    // Get amplitude values with fallback to 0
    const vals = {}
    const allVals = []
    Object.keys(positions).forEach((elec) => {
      if (!Object.hasOwn(amplitudes, elec)) return
      const v = amplitudes[elec] ?? 0
      vals[elec] = v
      allVals.push(v)
    })

    const vMin = Math.min(...allVals)
    const vMax = Math.max(...allVals)
    const vRange = vMax - vMin || 1

    function normVal(v) {
      return (v - vMin) / vRange
    }

    // ── Clipping circle ────────────────────────────────────────────────────
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.clip()

    // ── Interpolated heatmap via ImageData ─────────────────────────────────
    const imgData = ctx.createImageData(S, S)
    const electrodes = Object.entries(positions).filter(([elec]) => Object.hasOwn(amplitudes, elec))

    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        // Normalise pixel to [-1, 1]
        const nx = (px - cx) / R
        const ny = (cy - py) / R // flip y
        const dr = Math.sqrt(nx * nx + ny * ny)
        if (dr > 1.05) continue // outside scalp

        // Inverse-distance weighted interpolation
        let wSum = 0,
          vSum = 0
        for (const [elec, [ex, ey]] of electrodes) {
          const d2 = (nx - ex) ** 2 + (ny - ey) ** 2
          const w = d2 < 1e-6 ? 1e6 : 1 / d2 // IDW power=2
          wSum += w
          vSum += w * normVal(vals[elec] ?? 0)
        }
        const t = wSum > 0 ? vSum / wSum : 0

        // Colormap: cool (blue) → neutral (black) → hot (red-orange)
        const [r, g, b] = topoColor(t)
        const idx = (py * S + px) * 4
        imgData.data[idx] = r
        imgData.data[idx + 1] = g
        imgData.data[idx + 2] = b
        imgData.data[idx + 3] = 230
      }
    }
    // putImageData ignores the DPR transform. Draw an offscreen image instead
    // so the heatmap and the scaled head outline use the same coordinates.
    const heatmap = document.createElement('canvas')
    heatmap.width = heatmap.height = S
    heatmap.getContext('2d').putImageData(imgData, 0, 0)
    ctx.drawImage(heatmap, 0, 0, S, S)
    ctx.restore()

    // ── Head outline ────────────────────────────────────────────────────────
    ctx.strokeStyle = '#1E2A40'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.stroke()

    // Nose
    ctx.strokeStyle = '#2A3A54'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx - 8, cy - R + 3)
    ctx.quadraticCurveTo(cx, cy - R - 12, cx + 8, cy - R + 3)
    ctx.stroke()

    // Ears
    ;[
      [-1, -0.06],
      [1, -0.06],
    ].forEach(([side]) => {
      const ex = cx + side * (R + 5)
      ctx.beginPath()
      ctx.arc(ex, cy + 5, 6, 0, Math.PI * 2)
      ctx.strokeStyle = '#2A3A54'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })

    // ── Electrode dots ───────────────────────────────────────────────────────
    electrodes.forEach(([elec, [nx, ny]]) => {
      const px = cx + nx * R
      const py = cy - ny * R
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 0.5
      ctx.fill()
      ctx.stroke()

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = `6px "DM Mono", monospace`
      ctx.textAlign = 'center'
      ctx.fillText(localize(elec, language), px, py - 5)
    })

    // ── Color scale bar ──────────────────────────────────────────────────────
    const barX = S - 14,
      barY = 20,
      barH = S - 40,
      barW = 8
    const grad = ctx.createLinearGradient(0, barY, 0, barY + barH)
    for (let i = 0; i <= 20; i++) {
      const t = 1 - i / 20
      const [r, g, b] = topoColor(t)
      grad.addColorStop(i / 20, `rgb(${r},${g},${b})`)
    }
    ctx.fillStyle = grad
    ctx.fillRect(barX, barY, barW, barH)
    ctx.strokeStyle = '#1E2A40'
    ctx.lineWidth = 0.5
    ctx.strokeRect(barX, barY, barW, barH)
    ctx.fillStyle = '#5A6A82'
    ctx.font = '7px "DM Mono", monospace'
    ctx.textAlign = 'right'
    ctx.fillText(localize('max', language), barX - 2, barY + 6)
    ctx.fillText(localize('min', language), barX - 2, barY + barH)
  }, [amplitudes, size, dpr, language])

  if (amplitudes === null)
    return (
      <p className="text-sm text-eeg-muted max-w-sm">
        {localize('Choose a common-reference montage to display scalp RMS amplitudes.')}
      </p>
    )
  if (!Object.keys(amplitudes).length)
    return <p className="text-sm text-eeg-muted">{localize('No electrode data available.')}</p>

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted">
        {localize('Scalp Topo')}
      </p>
      <canvas
        dir="ltr"
        ref={canvasRef}
        style={{ display: 'block', borderRadius: 8 }}
        role="img"
        aria-label={localize('Scalp topographic map of relative channel RMS amplitude')}
      >
        {localize('Scalp topographic map showing relative channel RMS amplitude.')}
      </canvas>
    </div>
  )
}

// ─── Colormap: blue → green → yellow → red ────────────────────────────────────

function topoColor(t) {
  // Cold-hot colormap
  const c = [
    [0, 0, 80], // deep blue (min)
    [0, 100, 200], // blue
    [0, 180, 180], // cyan
    [10, 180, 10], // green
    [200, 200, 0], // yellow
    [255, 120, 0], // orange
    [220, 20, 20], // red (max)
  ]
  const n = c.length - 1
  const idx = Math.max(0, Math.min(n - 1, Math.floor(t * n)))
  const frac = t * n - idx
  const a = c[idx]
  const b = c[Math.min(n, idx + 1)]
  return [
    Math.round(a[0] + frac * (b[0] - a[0])),
    Math.round(a[1] + frac * (b[1] - a[1])),
    Math.round(a[2] + frac * (b[2] - a[2])),
  ]
}
