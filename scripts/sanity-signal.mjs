// Sanity check for signal-generation realism improvements.
// Runs in pure Node (no DOM) — exits non-zero on assertion failure.
import { generateMultiChannelEEG, SAMPLE_RATE } from '../src/engine/signalGenerator.js'
import { generateDemoTrace } from '../src/engine/waveforms.js'
import { computePropagationWeights, generatePropagationEEG } from '../src/engine/propagation.js'

function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  let ma = 0, mb = 0
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i] }
  ma /= n; mb /= n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb
    num += xa * xb
    da  += xa * xa
    db  += xb * xb
  }
  return num / Math.sqrt(da * db)
}

function rms(arr) {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]
  return Math.sqrt(s / arr.length)
}

let pass = 0, fail = 0
function check(label, cond, detail = '') {
  if (cond) { console.log('  PASS', label); pass++ }
  else      { console.log('  FAIL', label, detail); fail++ }
}

// ─── 1. Inter-channel coherence: O1 ↔ O2 alpha must now be highly correlated
console.log('\n[1] Posterior alpha coherence (O1 ↔ O2):')
{
  const eeg = generateMultiChannelEEG({ pattern: 'normal_awake', eyesClosed: true, blinksEnabled: false, duration: 10 })
  const r = pearson(eeg.channels.O1, eeg.channels.O2)
  check('correlation > 0.5', r > 0.5, `(got ${r.toFixed(3)})`)
}

// ─── 2. Burst-suppression bursts must be synchronous across channels
console.log('\n[2] Burst-suppression channel synchrony (Cz ↔ C4):')
{
  const eeg = generateMultiChannelEEG({ pattern: 'burst_suppression', duration: 15, blinksEnabled: false })
  const r = pearson(eeg.channels.Cz, eeg.channels.C4)
  check('correlation > 0.6', r > 0.6, `(got ${r.toFixed(3)})`)
}

// ─── 3. Eyes-open beta vs eyes-closed alpha (Berger effect intact)
console.log('\n[3] Berger effect:')
{
  const closed = generateMultiChannelEEG({ pattern: 'normal_awake', eyesClosed: true,  blinksEnabled: false, duration: 10 })
  const open   = generateMultiChannelEEG({ pattern: 'normal_awake', eyesClosed: false, blinksEnabled: false, duration: 10 })
  const closedRms = rms(closed.channels.O2)
  const openRms   = rms(open.channels.O2)
  check('eyes-closed O2 has higher RMS than eyes-open', closedRms > openRms,
    `(closed=${closedRms.toFixed(1)} vs open=${openRms.toFixed(1)})`)
}

// ─── 4. Cardiac pulse synchronous: ear refs A1 ↔ A2 should be highly correlated
console.log('\n[4] Cardiac pulse synchrony (A1 ↔ A2):')
{
  const eeg = generateMultiChannelEEG({ pattern: 'normal_awake', eyesClosed: true, blinksEnabled: false, duration: 20 })
  const r = pearson(eeg.channels.A1, eeg.channels.A2)
  check('A1↔A2 correlation > 0.4', r > 0.4, `(got ${r.toFixed(3)})`)
}

// ─── 4b. Focal slowing cluster T3 ↔ T5 should be highly coherent
console.log('\n[4b] Focal slowing cluster coherence (T3 ↔ T5):')
{
  const eeg = generateMultiChannelEEG({ pattern: 'focal_slowing', duration: 15, blinksEnabled: false })
  const r = pearson(eeg.channels.T3, eeg.channels.T5)
  check('T3↔T5 correlation > 0.5', r > 0.5, `(got ${r.toFixed(3)})`)
}

// ─── 5. Absence is no longer perfectly periodic (jitter present)
console.log('\n[5] Absence discharge timing jitter:')
{
  // Two independent 10-s absence runs should differ at sample level due to
  // jitter. (Same seed-free generator, but jitter randomization should
  // produce different traces.)
  const a = generateMultiChannelEEG({ pattern: 'absence', duration: 10, blinksEnabled: false }).channels.Fz
  const b = generateMultiChannelEEG({ pattern: 'absence', duration: 10, blinksEnabled: false }).channels.Fz
  const r = pearson(a, b)
  check('two absence runs differ (correlation < 0.95)', r < 0.95, `(got ${r.toFixed(3)})`)
}

// ─── 6. Generator does not crash on every documented pattern
console.log('\n[6] All patterns produce non-empty 19-channel output:')
const patterns = [
  'normal_awake','normal_drowsy','normal_sleep','slow_wave_sleep',
  'absence','focal_slowing','burst_suppression','hypsarrhythmia',
  'alpha_coma','electrocerebral_silence','breach_rhythm','diffuse_slowing',
  'firda','gpds','triphasic_waves','lpds','slow_spike_wave',
  'centrotemporal_spikes','temporal_sharps','polyspike_jme','photoparoxysmal',
]
for (const p of patterns) {
  const eeg = generateMultiChannelEEG({ pattern: p, duration: 5, blinksEnabled: false })
  const labels = Object.keys(eeg.channels)
  const ok = labels.length === 21 && eeg.channels.O1.length === 5 * SAMPLE_RATE
  check(`pattern: ${p}`, ok)
}

// ─── 7. Waveforms.js K-complex morphology — positive slow now dominant
console.log('\n[7] K-complex demo morphology (positive slow > negative sharp):')
{
  const sig = generateDemoTrace('k_complex')
  let max = -Infinity, min = Infinity
  for (let i = 0; i < sig.length; i++) {
    if (sig[i] > max) max = sig[i]
    if (sig[i] < min) min = sig[i]
  }
  check('peak positive amplitude > peak |negative|', max > Math.abs(min),
    `(max=${max.toFixed(0)}, min=${min.toFixed(0)})`)
}

// ─── 8. Waveforms.js spike-and-wave demo no longer perfectly periodic
console.log('\n[8] Spike-and-wave demo timing jitter:')
{
  // Two demo traces should differ at sample level due to timing jitter.
  const a = generateDemoTrace('spike_wave')
  const b = generateDemoTrace('spike_wave')
  const r = pearson(a, b)
  check('two runs differ (correlation < 0.9)', r < 0.9, `(got ${r.toFixed(3)})`)
}

// ─── 9. Propagation engine background coherence (Cz ↔ C4 with no source)
console.log('\n[9] Propagation engine background coherence (Cz ↔ C4):')
{
  // Use a far-away source so Cz/C4 weights are tiny and we measure the
  // background, not the discharge. Pick O1 as source.
  const w   = computePropagationWeights('O1', 0.20)
  const eeg = generatePropagationEEG(w, 50)
  const r   = pearson(eeg.channels.Cz, eeg.channels.C4)
  check('Cz↔C4 correlation > 0.6 (shared background)', r > 0.6, `(got ${r.toFixed(3)})`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
