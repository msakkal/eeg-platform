// Render a small time window of a few key channels at high zoom for morphology review.
import { writeFileSync, mkdirSync } from 'node:fs'
import { generateMultiChannelEEG, SAMPLE_RATE } from '../src/engine/signalGenerator.js'
import { generateDemoTrace } from '../src/engine/waveforms.js'

mkdirSync('scripts/out', { recursive: true })

// Big SVG, filling viewport
const W = 1700
const ROWH = 110
const PAD = 70

function renderZoom(eeg, channels, t0, t1, gain, title, file) {
  const fs = SAMPLE_RATE
  const i0 = Math.round(t0 * fs)
  const i1 = Math.round(t1 * fs)
  const innerW = W - PAD * 2
  const H = PAD + channels.length * ROWH + PAD
  const lines = []
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0c1220;font-family:monospace">`)
  lines.push(`<text x="${PAD}" y="35" fill="#00ffb0" font-size="20" font-weight="bold">${title}</text>`)
  lines.push(`<text x="${PAD}" y="55" fill="#5a6a82" font-size="13">window: ${t0.toFixed(2)}–${t1.toFixed(2)}s, gain ×${gain}</text>`)

  // Major time gridlines every 0.5s, minor every 0.1s
  const dur = t1 - t0
  for (let s = 0; s <= dur; s += 0.1) {
    const x = PAD + (s / dur) * innerW
    const isMajor = Math.round(s * 10) % 5 === 0
    lines.push(`<line x1="${x}" y1="${PAD}" x2="${x}" y2="${H - PAD}" stroke="${isMajor ? '#1a2a44' : '#0f1a2c'}" stroke-width="${isMajor ? 0.7 : 0.3}"/>`)
    if (isMajor) {
      lines.push(`<text x="${x}" y="${H - PAD + 18}" fill="#5a6a82" font-size="10" text-anchor="middle">${(t0 + s).toFixed(2)}s</text>`)
    }
  }
  // 100 µV scale bar (top right)
  const yBarTop = PAD + 5, yBarBot = yBarTop + 100 * gain
  lines.push(`<line x1="${W - PAD - 10}" y1="${yBarTop}" x2="${W - PAD - 10}" y2="${yBarBot}" stroke="#FFD166" stroke-width="2"/>`)
  lines.push(`<text x="${W - PAD - 18}" y="${(yBarTop + yBarBot)/2}" fill="#FFD166" font-size="11" text-anchor="end">100µV</text>`)

  channels.forEach((ch, i) => {
    const yMid = PAD + i * ROWH + ROWH / 2 + 10
    const data = eeg?.channels?.[ch] ?? eeg?.[ch]
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

// 1) Awake eyes closed: 2-second window of posterior + anterior alpha gradient.
{
  const eeg = generateMultiChannelEEG({ pattern: 'normal_awake', eyesClosed: true, blinksEnabled: false, duration: 10 })
  renderZoom(eeg, ['O1','O2','P3','P4','T5','T6','C3','Cz','C4','F3','F4','Fp1','Fp2'], 2, 4, 0.6,
    'Awake eyes-closed: posterior alpha gradient', 'zoom-awake-closed')
}

// 2) Awake eyes open: blink + saccade morphology at frontal channels
{
  const eeg = generateMultiChannelEEG({ pattern: 'normal_awake', eyesClosed: false, blinksEnabled: true, blinkRate: 30, duration: 10 })
  renderZoom(eeg, ['Fp1','Fp2','F7','F8','F3','F4','T3','T4'], 0, 5, 0.25,
    'Awake eyes-open: blinks (Fp1/Fp2 positive) and saccades (F7/F8 anti-phase)', 'zoom-awake-open')
}

// 3) Sleep: vertex sharps, K-complexes (note the dominant POSITIVE slow now), spindles
{
  const eeg = generateMultiChannelEEG({ pattern: 'normal_sleep', duration: 30 })
  renderZoom(eeg, ['Fz','Cz','C3','C4','Pz','F3','F4'], 0, 30, 0.3,
    'N2 sleep: K-complexes (large +slow), vertex sharps, spindles — synchronous across vertex sites', 'zoom-sleep-overview')
  renderZoom(eeg, ['Fz','Cz','C3','C4','Pz'], 1, 5, 0.45,
    'N2 sleep zoom — K-complex/vertex morphology and bilateral synchrony', 'zoom-sleep-detail')
}

// 4) Burst-suppression: visualise that all channels burst in sync
{
  const eeg = generateMultiChannelEEG({ pattern: 'burst_suppression', duration: 15 })
  renderZoom(eeg, ['Fp1','Fp2','F3','F4','C3','Cz','C4','P3','P4','O1','O2'], 0, 15, 0.25,
    'Burst-suppression: bursts must align vertically across all channels', 'zoom-burst-supp')
}

// 5) Absence: should look slightly irregular and slow at the end of the run
{
  const eeg = generateMultiChannelEEG({ pattern: 'absence', duration: 10 })
  renderZoom(eeg, ['Fz','Cz','Pz','F3','F4','C3','C4','O1','O2'], 0, 10, 0.20,
    '3 Hz absence: jittered IBI, frequency tapers 3.4→2.6 Hz, amplitude waxes-wanes', 'zoom-absence')
}

// 6) GPDs jitter and synchrony
{
  const eeg = generateMultiChannelEEG({ pattern: 'gpds', duration: 10 })
  renderZoom(eeg, ['Fz','Cz','Pz','F3','F4','C3','C4'], 0, 10, 0.30,
    'GPDs: ~1 Hz, ±12% IBI jitter, bilaterally synchronous', 'zoom-gpds')
}

// 7) Triphasic — A-P phase lag visualisation
{
  const eeg = generateMultiChannelEEG({ pattern: 'triphasic_waves', duration: 8 })
  renderZoom(eeg, ['Fz','F3','F4','Cz','Pz','O1','O2'], 0, 4, 0.30,
    'Triphasic waves: small +ve → large –ve → broad +ve, A-P lag visible', 'zoom-triphasic')
}

// 8) Focal slowing — left-temp cluster vs right side
{
  const eeg = generateMultiChannelEEG({ pattern: 'focal_slowing', duration: 10 })
  renderZoom(eeg, ['F7','T3','T5','F8','T4','T6','C3','C4','O1','O2'], 0, 10, 0.20,
    'Focal slowing: T3/T5/F7 cluster shows polymorphic slow; T4/T6/F8 normal', 'zoom-focal-slowing')
}

// 9) Centrotemporal spikes (BECTS) — note dipole reversal between F3 & C3
{
  const eeg = generateMultiChannelEEG({ pattern: 'centrotemporal_spikes', duration: 10 })
  renderZoom(eeg, ['F3','C3','T3','P3','F4','C4','T4','P4','Fp1','Fp2'], 0, 10, 0.25,
    'BECTS: dipole reversal — F3 +ve / C3 –ve (vice versa right side)', 'zoom-bects')
}

// 10) K-complex demo (waveforms.js) — verify positive-slow dominance fix
{
  const sig = generateDemoTrace('k_complex')
  // Wrap in eeg-like shape
  renderZoom({ X: sig }, ['X'], 0, 3, 0.25,
    'K-complex demo (waveforms.js): large +slow > sharp –ve component', 'zoom-kcomplex-demo')
}

// 11) Spike-and-wave demo (waveforms.js) — should show jitter
{
  const sig = generateDemoTrace('spike_wave')
  renderZoom({ X: sig }, ['X'], 0, 3, 0.20,
    'Spike-and-wave demo (waveforms.js): non-metronomic 3 Hz', 'zoom-sw-demo')
}

// 12) Eye blink demo
{
  const sig = generateDemoTrace('eye_blink')
  renderZoom({ X: sig }, ['X'], 0, 3, 0.20,
    'Eye-blink demo: fast rise (~70ms), slower fall (~250ms), positive', 'zoom-blink-demo')
}
