import React, { useRef, useEffect, useMemo } from 'react'

/**
 * ScalpTopoMap
 * Renders a real-time 2D topographic map of EEG amplitude across the scalp.
 * Uses bilinear interpolation on a polar grid derived from the 10-20 positions.
 *
 * Props:
 *   channels  - Array<{ label, data: Float32Array }>  (montage-derived channels)
 *   colorMode - 'signal' | 'power'
 *   size      - canvas pixel size (default 200)
 */
export default function ScalpTopoMap({ channels = [], colorMode = 'signal', size = 200 }) {
  const canvasRef = useRef(null)
  const dpr       = window.devicePixelRatio || 1

  // Compute RMS amplitude per raw electrode label
  const amplitudes = useMemo(() => {
    const map = {}
    channels.forEach(({ label, data }) => {
      if (!data || data.length === 0) return
      // Use label prefix (before '–') to identify electrode
      const elec = label.split('–')[0].split('-')[0].trim()
      let sumSq = 0
      for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i]
      const rms = Math.sqrt(sumSq / data.length)
      // Accumulate if multiple channels share the electrode
      map[elec] = (map[elec] ?? 0) + rms
    })
    return map
  }, [channels])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const S   = size
    const dS  = S * dpr
    canvas.width        = dS
    canvas.height       = dS
    canvas.style.width  = `${S}px`
    canvas.style.height = `${S}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, S, S)

    const cx  = S / 2
    const cy  = S / 2
    const R   = S * 0.42   // scalp radius in pixels

    // ── Electrode positions (normalised -1..1 in head-centred coords) ──────
    // x = left(-1)..right(+1), y = front(+1)..back(-1)
    const positions = {
      Fp1: [-0.27, 0.85], Fp2: [ 0.27, 0.85],
      F7:  [-0.72, 0.51], F3:  [-0.38, 0.51],
      Fz:  [ 0.00, 0.51], F4:  [ 0.38, 0.51], F8:  [ 0.72, 0.51],
      T7:  [-0.87, 0.00], C3:  [-0.45, 0.00],
      Cz:  [ 0.00, 0.00],
      C4:  [ 0.45, 0.00], T8:  [ 0.87, 0.00],
      P7:  [-0.72,-0.51], P3:  [-0.38,-0.51],
      Pz:  [ 0.00,-0.51], P4:  [ 0.38,-0.51], P8:  [ 0.72,-0.51],
      O1:  [-0.27,-0.85], O2:  [ 0.27,-0.85],
    }

    // Get amplitude values with fallback to 0
    const vals = {}
    const allVals = []
    Object.keys(positions).forEach(elec => {
      const v = amplitudes[elec] ?? 0
      vals[elec] = v
      allVals.push(v)
    })

    const vMin = Math.min(...allVals)
    const vMax = Math.max(...allVals)
    const vRange = vMax - vMin || 1

    function normVal(v) { return (v - vMin) / vRange }

    // ── Clipping circle ────────────────────────────────────────────────────
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.clip()

    // ── Interpolated heatmap via ImageData ─────────────────────────────────
    const imgData = ctx.createImageData(S, S)
    const electrodes = Object.entries(positions)

    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        // Normalise pixel to [-1, 1]
        const nx = (px - cx) / R
        const ny = (cy - py) / R   // flip y
        const dr = Math.sqrt(nx * nx + ny * ny)
        if (dr > 1.05) continue   // outside scalp

        // Inverse-distance weighted interpolation
        let wSum = 0, vSum = 0
        for (const [elec, [ex, ey]] of electrodes) {
          const d2 = (nx - ex) ** 2 + (ny - ey) ** 2
          const w  = d2 < 1e-6 ? 1e6 : 1 / d2  // IDW power=2
          wSum += w
          vSum += w * normVal(vals[elec] ?? 0)
        }
        const t = wSum > 0 ? vSum / wSum : 0

        // Colormap: cool (blue) → neutral (black) → hot (red-orange)
        const [r, g, b] = topoColor(t)
        const idx = (py * S + px) * 4
        imgData.data[idx]     = r
        imgData.data[idx + 1] = g
        imgData.data[idx + 2] = b
        imgData.data[idx + 3] = 230
      }
    }
    ctx.putImageData(imgData, 0, 0)
    ctx.restore()

    // ── Head outline ────────────────────────────────────────────────────────
    ctx.strokeStyle = '#1E2A40'
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.stroke()

    // Nose
    ctx.strokeStyle = '#2A3A54'
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    ctx.moveTo(cx - 8, cy - R + 3)
    ctx.quadraticCurveTo(cx, cy - R - 12, cx + 8, cy - R + 3)
    ctx.stroke()

    // Ears
    ;[[-1, -0.06], [1, -0.06]].forEach(([side]) => {
      const ex = cx + side * (R + 5)
      ctx.beginPath()
      ctx.arc(ex, cy + 5, 6, 0, Math.PI * 2)
      ctx.strokeStyle = '#2A3A54'
      ctx.lineWidth   = 1.5
      ctx.stroke()
    })

    // ── Electrode dots ───────────────────────────────────────────────────────
    Object.entries(positions).forEach(([elec, [nx, ny]]) => {
      const px = cx + nx * R
      const py = cy - ny * R
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, Math.PI * 2)
      ctx.fillStyle   = 'rgba(255,255,255,0.9)'
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth   = 0.5
      ctx.fill()
      ctx.stroke()

      // Label
      ctx.fillStyle  = 'rgba(255,255,255,0.7)'
      ctx.font       = `6px "DM Mono", monospace`
      ctx.textAlign  = 'center'
      ctx.fillText(elec, px, py - 5)
    })

    // ── Color scale bar ──────────────────────────────────────────────────────
    const barX = S - 14, barY = 20, barH = S - 40, barW = 8
    const grad = ctx.createLinearGradient(0, barY, 0, barY + barH)
    for (let i = 0; i <= 20; i++) {
      const t = 1 - i / 20
      const [r, g, b] = topoColor(t)
      grad.addColorStop(i / 20, `rgb(${r},${g},${b})`)
    }
    ctx.fillStyle = grad
    ctx.fillRect(barX, barY, barW, barH)
    ctx.strokeStyle = '#1E2A40'
    ctx.lineWidth   = 0.5
    ctx.strokeRect(barX, barY, barW, barH)
    ctx.fillStyle  = '#5A6A82'
    ctx.font       = '7px "DM Mono", monospace'
    ctx.textAlign  = 'right'
    ctx.fillText('max', barX - 2, barY + 6)
    ctx.fillText('min', barX - 2, barY + barH)

  }, [amplitudes, size, colorMode])

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted">Scalp Topo</p>
      <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 8 }} role="img"
        aria-label="Scalp topographic map of relative EEG amplitude from low to high">
        Scalp topographic map showing relative EEG amplitude from low to high.
      </canvas>
    </div>
  )
}

// ─── Colormap: blue → green → yellow → red ────────────────────────────────────

function topoColor(t) {
  // Cold-hot colormap
  const c = [
    [0,   0,   80],   // deep blue (min)
    [0,   100, 200],  // blue
    [0,   180, 180],  // cyan
    [10,  180, 10],   // green
    [200, 200, 0],    // yellow
    [255, 120, 0],    // orange
    [220, 20,  20],   // red (max)
  ]
  const n   = c.length - 1
  const idx = Math.max(0, Math.min(n - 1, Math.floor(t * n)))
  const frac = t * n - idx
  const a   = c[idx]
  const b   = c[Math.min(n, idx + 1)]
  return [
    Math.round(a[0] + frac * (b[0] - a[0])),
    Math.round(a[1] + frac * (b[1] - a[1])),
    Math.round(a[2] + frac * (b[2] - a[2])),
  ]
}
