// Additional zoom views for cardiac pulse on ears, drift on temporal,
// propagation engine background, and a low-gain awake-closed sanity for
// inter-channel coherence rendering.
import { writeFileSync, mkdirSync } from 'node:fs'
import { generateMultiChannelEEG, SAMPLE_RATE } from '../src/engine/signalGenerator.js'
import { computePropagationWeights, generatePropagationEEG } from '../src/engine/propagation.js'

mkdirSync('scripts/out', { recursive: true })

const W = 1700
const ROWH = 110
const PAD = 70

function render(eeg, channels, t0, t1, gain, title, file) {
  const fs = SAMPLE_RATE
  const i0 = Math.round(t0 * fs)
  const i1 = Math.round(t1 * fs)
  const innerW = W - PAD * 2
  const H = PAD + channels.length * ROWH + PAD
  const lines = []
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0c1220;font-family:monospace">`)
  lines.push(`<text x="${PAD}" y="35" fill="#00ffb0" font-size="20" font-weight="bold">${title}</text>`)
  lines.push(`<text x="${PAD}" y="55" fill="#5a6a82" font-size="13">window: ${t0.toFixed(2)}–${t1.toFixed(2)}s, gain ×${gain}</text>`)
  const dur = t1 - t0
  for (let s = 0; s <= dur; s += 0.1) {
    const x = PAD + (s / dur) * innerW
    const isMajor = Math.round(s * 10) % 5 === 0
    lines.push(`<line x1="${x}" y1="${PAD}" x2="${x}" y2="${H - PAD}" stroke="${isMajor ? '#1a2a44' : '#0f1a2c'}" stroke-width="${isMajor ? 0.7 : 0.3}"/>`)
    if (isMajor) lines.push(`<text x="${x}" y="${H - PAD + 18}" fill="#5a6a82" font-size="10" text-anchor="middle">${(t0 + s).toFixed(2)}s</text>`)
  }
  const yBarTop = PAD + 5, yBarBot = yBarTop + 100 * gain
  lines.push(`<line x1="${W - PAD - 10}" y1="${yBarTop}" x2="${W - PAD - 10}" y2="${yBarBot}" stroke="#FFD166" stroke-width="2"/>`)
  lines.push(`<text x="${W - PAD - 18}" y="${(yBarTop + yBarBot)/2}" fill="#FFD166" font-size="11" text-anchor="end">100µV</text>`)

  channels.forEach((ch, i) => {
    const yMid = PAD + i * ROWH + ROWH / 2 + 10
    const data = eeg?.channels?.[ch]
    if (!data) { lines.push(`<text x="${PAD}" y="${yMid}" fill="#ff4444">missing ${ch}</text>`); return }
    lines.push(`<text x="${PAD - 12}" y="${yMid + 5}" fill="#00d4ff" font-size="14" text-anchor="end" font-weight="bold">${ch}</text>`)
    lines.push(`<line x1="${PAD}" y1="${yMid}" x2="${W - PAD}" y2="${yMid}" stroke="#1a2a44" stroke-width="0.4"/>`)
    let pts = ''
    for (let i2 = i0; i2 <= i1; i2++) {
      const x = PAD + ((i2 - i0) / (i1 - i0)) * innerW
      const y = yMid - data[i2] * gain
      pts += (i2 === i0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' '
    }
    lines.push(`<path d="${pts}" stroke="#00ffb0" stroke-width="1.0" fill="none"/>`)
  })
  lines.push('</svg>')
  writeFileSync(`scripts/out/${file}.svg`, lines.join('\n'))
  console.log('wrote', file)
}

// 1) Ear references — should show bold synchronous QRS pulses
{
  const eeg = generateMultiChannelEEG({ pattern: 'normal_awake', eyesClosed: true, blinksEnabled: false, duration: 10 })
  render(eeg, ['A1','A2','T3','T4','T5','T6'], 0, 10, 0.6,
    'Ear & temporal: cardiac pulse (~22µV on ears, ~7-8µV on temporal) — synchronous beats', 'zoom-cardiac')
}

// 2) Slow baseline drift visible at posterior with alpha turned off
{
  const eeg = generateMultiChannelEEG({ pattern: 'normal_awake', eyesClosed: false, blinksEnabled: false, duration: 30, noiseLevel: 0.05 })
  render(eeg, ['T5','T6','P3','P4','O1','O2'], 0, 30, 0.6,
    'Slow baseline drift (eyes-open, low noise): posterior wander 0.05–0.3 Hz', 'zoom-drift')
}

// 3) Propagation engine — shared background coherence
{
  // Use a focal source at C3 to see weighted discharge propagation
  const w = computePropagationWeights('C3', 0.3)
  const eeg = generatePropagationEEG(w, 200)
  render(eeg, ['C3','Cz','C4','F3','P3','T3','F4','P4','T4'], 0, 10, 0.25,
    'Propagation: focal C3 source — Cz, F3, P3, T3 should show smaller in-phase complexes', 'zoom-propagation')
}

// 4) Awake eyes-open: long view to see saccade activity clearly with no blinks
{
  const eeg = generateMultiChannelEEG({ pattern: 'normal_awake', eyesClosed: false, blinksEnabled: false, duration: 10 })
  render(eeg, ['F7','Fp1','F3','C3','F4','Fp2','F8','T3','T4'], 0, 10, 0.3,
    'Saccades only (no blinks): F7/F8 step-and-hold antiphase deflections', 'zoom-saccades')
}
