// Render selected EEG channels to SVG so we can visually inspect morphology
// without depending on lossy screenshot compression.
import { writeFileSync, mkdirSync } from 'node:fs'
import { generateMultiChannelEEG, SAMPLE_RATE } from '../src/engine/signalGenerator.js'

mkdirSync('scripts/out', { recursive: true })

const W = 1800   // px
const H_PER_CH = 80
const PAD = 60

function renderSvg({ pattern, channels, eyesClosed = true, blinksEnabled = true, durationS = 10, gain = 0.6, title }) {
  const eeg = generateMultiChannelEEG({ pattern, eyesClosed, blinksEnabled, duration: durationS })
  const fs  = SAMPLE_RATE
  const N   = Math.round(durationS * fs)
  const innerW = W - PAD * 2

  const H = PAD + channels.length * H_PER_CH + PAD
  const lines = []
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0c1220;font-family:monospace">`)
  lines.push(`<text x="${PAD}" y="30" fill="#00ffb0" font-size="18" font-weight="bold">${title} — ${pattern}, eyesClosed=${eyesClosed}, dur=${durationS}s</text>`)
  // Time axis ticks every 1s
  for (let s = 0; s <= durationS; s++) {
    const x = PAD + (s / durationS) * innerW
    lines.push(`<line x1="${x}" y1="${PAD - 10}" x2="${x}" y2="${H - PAD + 10}" stroke="#1a2a44" stroke-width="0.5"/>`)
    lines.push(`<text x="${x}" y="${H - PAD + 25}" fill="#5a6a82" font-size="10" text-anchor="middle">${s}s</text>`)
  }
  channels.forEach((ch, i) => {
    const yMid = PAD + i * H_PER_CH + H_PER_CH / 2
    const data = eeg.channels[ch]
    if (!data) return
    lines.push(`<text x="${PAD - 10}" y="${yMid + 4}" fill="#00d4ff" font-size="12" text-anchor="end">${ch}</text>`)
    lines.push(`<line x1="${PAD}" y1="${yMid}" x2="${W - PAD}" y2="${yMid}" stroke="#1a2a44" stroke-width="0.3"/>`)
    let pts = ''
    for (let i2 = 0; i2 < N; i2 += 1) {
      const x = PAD + (i2 / N) * innerW
      const y = yMid - data[i2] * gain
      pts += (i2 === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' '
    }
    lines.push(`<path d="${pts}" stroke="#00ffb0" stroke-width="0.8" fill="none"/>`)
  })
  lines.push('</svg>')
  return lines.join('\n')
}

// Configurations to render
const targets = [
  { file: 'awake-closed', title: 'Awake, eyes closed (PDR expected at O1/O2)',
    pattern: 'normal_awake', eyesClosed: true,
    channels: ['Fp1','F7','F3','C3','P3','O1','T3','T5','Cz','O2','P4','T6','F4','F8','Fp2'] },
  { file: 'awake-open',   title: 'Awake, eyes open (alpha attenuated, blinks + saccades)',
    pattern: 'normal_awake', eyesClosed: false, blinksEnabled: true,
    channels: ['Fp1','Fp2','F7','F8','T3','T4','C3','C4','P3','P4','O1','O2'] },
  { file: 'sleep-n2',     title: 'N2 sleep (vertex sharps + spindles + K-complexes)',
    pattern: 'normal_sleep',
    channels: ['Fz','Cz','Pz','C3','C4','F3','F4','T3','T4','O1','O2'] },
  { file: 'burst-supp',   title: 'Burst-suppression (must be SYNCHRONOUS bilaterally)', durationS: 15,
    pattern: 'burst_suppression',
    channels: ['Fp1','Fp2','F3','F4','C3','Cz','C4','P3','P4','O1','O2'] },
  { file: 'absence',      title: '3 Hz absence (jittered + tapering frequency)',
    pattern: 'absence',
    channels: ['Fp1','Fp2','F3','Fz','F4','C3','Cz','C4','P3','Pz','P4','O1','O2'] },
  { file: 'gpds',         title: 'GPDs (~1 Hz, jittered IBI + amplitude)', durationS: 10,
    pattern: 'gpds',
    channels: ['Fp1','Fp2','F3','Fz','F4','C3','Cz','C4','P3','Pz','P4','O1','O2'] },
  { file: 'lpds',         title: 'LPDs (left-lateralised, jittered)', durationS: 10,
    pattern: 'lpds',
    channels: ['Fp1','F7','T3','T5','C3','P3','O1','Fz','Cz','Pz','O2','P4','C4','T4','F8'] },
  { file: 'triphasic',    title: 'Triphasic waves (~1.5 Hz, A-P phase lag)', durationS: 8,
    pattern: 'triphasic_waves',
    channels: ['Fp1','Fp2','F3','Fz','F4','C3','Cz','C4','Pz','O1','O2'] },
  { file: 'focal-slowing',title: 'Focal slowing (T3/T5/F7 cluster slow, others normal)', durationS: 10,
    pattern: 'focal_slowing',
    channels: ['Fp1','F7','F3','T3','C3','T5','P3','O1','O2','P4','T6','C4','T4','F4','F8','Fp2'] },
  { file: 'alpha-coma',   title: 'Alpha coma (frontal-max non-reactive alpha)',
    pattern: 'alpha_coma',
    channels: ['Fp1','Fp2','F3','Fz','F4','C3','Cz','C4','P3','Pz','P4','O1','O2'] },
  { file: 'firda',        title: 'FIRDA (bifrontal 2.5 Hz delta bursts)', durationS: 10,
    pattern: 'firda',
    channels: ['Fp1','Fp2','F3','Fz','F4','C3','Cz','C4','P3','O1','O2'] },
  { file: 'temporal-sharps', title: 'Left temporal sharps (TLE) — sparse interictal', durationS: 10,
    pattern: 'temporal_sharps',
    channels: ['Fp1','F7','T3','T5','C3','P3','O1','Fz','Cz','F8','T4','T6'] },
  { file: 'centrotemp',   title: 'Centrotemporal spikes (BECTS) — bilateral with dipole', durationS: 10,
    pattern: 'centrotemporal_spikes',
    channels: ['Fp1','F7','F3','T3','C3','T5','P3','Fp2','F8','F4','T4','C4','T6','P4','Cz'] },
  { file: 'photopar',     title: 'Photoparoxysmal (occipital driving + PPR)', durationS: 8,
    pattern: 'photoparoxysmal',
    channels: ['Fp1','Fp2','F3','Fz','F4','Cz','Pz','O1','O2'] },
  { file: 'hypsarrhythmia', title: 'Hypsarrhythmia (chaotic, asynchronous multifocal)', durationS: 10,
    pattern: 'hypsarrhythmia',
    channels: ['Fp1','Fp2','F3','Fz','F4','C3','Cz','C4','P3','Pz','P4','O1','O2'] },
  { file: 'breach',       title: 'Breach rhythm (left central-amplified beta+alpha)', durationS: 10,
    pattern: 'breach_rhythm',
    channels: ['Fp1','F7','F3','T3','C3','T5','P3','O1','Fz','Cz','Pz'] },
]

for (const t of targets) {
  const svg = renderSvg(t)
  writeFileSync(`scripts/out/${t.file}.svg`, svg)
  console.log('wrote', `scripts/out/${t.file}.svg`)
}
