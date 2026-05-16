// Sanity checks for the streaming EEG engine.
// Exits non-zero on any failure.

import { StreamingEEG, createEngineForPattern, GpdsOverlay, FirdaOverlay, BurstSuppressionOverlay } from '../src/engine/streaming.js'
import { SAMPLE_RATE } from '../src/engine/signalGenerator.js'

let pass = 0, fail = 0
function check(label, cond, detail = '') {
  if (cond) { console.log('  PASS', label); pass++ }
  else      { console.log('  FAIL', label, detail); fail++ }
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  let ma = 0, mb = 0
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i] }
  ma /= n; mb /= n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb
    num += xa * xb; da += xa * xa; db += xb * xb
  }
  return num / Math.sqrt(da * db)
}

function rms(arr) {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]
  return Math.sqrt(s / arr.length)
}

function ppRange(arr) {
  let mn = Infinity, mx = -Infinity
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < mn) mn = arr[i]
    if (arr[i] > mx) mx = arr[i]
  }
  return mx - mn
}

// ─── 1. Basic shape: 21 channels, correct sample count ───────────────────
console.log('\n[1] Engine fills a window with 21 channels:')
{
  const e = new StreamingEEG({ seed: 42 })
  e.setMode('normal_awake')
  e.setEyesOpen(false)
  const w = e.fillWindow(10)
  const labels = Object.keys(w)
  check('21 channels returned', labels.length === 21, `(got ${labels.length})`)
  check('each channel is 10 × SAMPLE_RATE samples',
    labels.every(l => w[l].length === 10 * SAMPLE_RATE),
    `(got ${w[labels[0]].length})`)
}

// ─── 2. Posterior alpha coherence O1 ↔ O2 ────────────────────────────────
console.log('\n[2] Posterior alpha coherence (O1 ↔ O2):')
{
  const e = new StreamingEEG({ seed: 123 })
  e.setMode('normal_awake')
  e.setEyesOpen(false)
  const w = e.fillWindow(10)
  const r = pearson(w.O1, w.O2)
  check('correlation > 0.5', r > 0.5, `(got ${r.toFixed(3)})`)
}

// ─── 3. Berger effect: eyes-closed alpha amplitude > eyes-open ──────────
console.log('\n[3] Berger effect (eyes-closed O2 RMS > eyes-open):')
{
  const closed = new StreamingEEG({ seed: 1 }); closed.setMode('normal_awake'); closed.setEyesOpen(false)
  const open   = new StreamingEEG({ seed: 1 }); open  .setMode('normal_awake'); open  .setEyesOpen(true)
  const wC = closed.fillWindow(10).O2
  const wO = open  .fillWindow(10).O2
  const rmsC = rms(wC)
  const rmsO = rms(wO)
  check('closed RMS > open RMS', rmsC > rmsO, `(closed=${rmsC.toFixed(1)} vs open=${rmsO.toFixed(1)})`)
}

// ─── 4. Continuous time: no buffer wrap, samples at t=120 differ from t=0
console.log('\n[4] No buffer-loop boundary at 60-s mark:')
{
  const e = new StreamingEEG({ seed: 7 })
  e.setMode('normal_awake')
  e.setEyesOpen(false)
  const w1 = e.fillWindow(60).O1
  const w2 = e.fillWindow(60).O1   // continues from t=60 to t=120
  // The two minutes should be statistically similar (both alpha) but the
  // SAMPLES at corresponding indices should NOT be identical (no wrap).
  let sumSqDiff = 0
  for (let i = 0; i < w1.length; i++) sumSqDiff += (w1[i] - w2[i]) ** 2
  const rmsDiff = Math.sqrt(sumSqDiff / w1.length)
  // If we had a 60-s loop, rmsDiff would be ~0. Real streaming → diff comparable to signal RMS.
  check('streaming continuity (rmsDiff > 5 µV)', rmsDiff > 5, `(rmsDiff=${rmsDiff.toFixed(1)})`)
}

// ─── 5. FM drift: alpha center frequency varies over time ───────────────
console.log('\n[5] FM frequency drift:')
{
  // Two 10-s windows at different starting clocks should differ in spectral peak slightly
  const e = new StreamingEEG({ seed: 99 })
  e.setMode('normal_awake'); e.setEyesOpen(false)
  // First 10 s
  const w1 = e.fillWindow(10).O1
  // Skip 20 s of "burn-in" so the FM modulator has walked
  e.fillWindow(20)
  const w2 = e.fillWindow(10).O1
  // Two random windows should not be identical (proves continuous time)
  let diffCount = 0
  for (let i = 0; i < w1.length; i++) if (Math.abs(w1[i] - w2[i]) > 0.01) diffCount++
  check('FM drift produces different samples in different windows',
    diffCount > w1.length * 0.95,
    `(${diffCount}/${w1.length} differ)`)
}

// ─── 6. Pathology overlay: GPDs add detectable periodic discharges ──────
console.log('\n[6] GPDs overlay produces detectable periodic discharges:')
{
  const base = new StreamingEEG({ seed: 50 }); base.setMode('diffuse_slowing')
  const with_ = new StreamingEEG({ seed: 50 }); with_.setMode('diffuse_slowing')
  with_.addOverlay(new GpdsOverlay(with_.rng))
  const wBase  = base .fillWindow(10).Fz
  const wWith  = with_.fillWindow(10).Fz
  // The GPDs version should have higher peak amplitude (sharp transients).
  const ppBase = ppRange(wBase)
  const ppWith = ppRange(wWith)
  check('GPDs add measurable peak amplitude',
    ppWith > ppBase * 1.5,
    `(pp base=${ppBase.toFixed(0)} vs with=${ppWith.toFixed(0)})`)
}

// ─── 7. Pathology composability: FIRDA + GPDs together ──────────────────
console.log('\n[7] Multiple pathology overlays compose:')
{
  const e = new StreamingEEG({ seed: 77 })
  e.setMode('diffuse_slowing')
  e.addOverlay(new FirdaOverlay(e.rng))
  e.addOverlay(new GpdsOverlay(e.rng))
  const w = e.fillWindow(15)
  check('two overlays produce non-empty signal', w.Fz.length === 15 * SAMPLE_RATE && rms(w.Fz) > 10)
}

// ─── 8. Burst-suppression: bursts synchronous across channels ───────────
console.log('\n[8] Burst-suppression: bilaterally synchronous bursts:')
{
  const e = new StreamingEEG({ seed: 33 })
  e.setMode('slow_wave_sleep')
  e.addOverlay(new BurstSuppressionOverlay(e.rng))
  const w = e.fillWindow(15)
  const r = pearson(w.Cz, w.C4)
  check('Cz ↔ C4 correlation > 0.6 (bursts aligned)', r > 0.6, `(got ${r.toFixed(3)})`)
}

// ─── 9. createEngineForPattern factory works for all patterns ───────────
console.log('\n[9] Factory works for canonical patterns:')
{
  const patterns = [
    'normal_awake','normal_drowsy','normal_sleep','slow_wave_sleep',
    'diffuse_slowing','alpha_coma','firda','gpds','lpds','absence',
    'burst_suppression',
  ]
  for (const p of patterns) {
    const e = createEngineForPattern(p, { eyesClosed: true, blinksEnabled: false })
    const w = e.fillWindow(5)
    const ok = Object.keys(w).length === 21 && w.O1.length === 5 * SAMPLE_RATE
    check(`pattern: ${p}`, ok)
  }
}

// ─── 10. Amplitude in clinical range (posterior alpha ~50-120 µV pp) ────
console.log('\n[10] Posterior alpha pp amplitude clinically realistic:')
{
  const e = createEngineForPattern('normal_awake', { eyesClosed: true, blinksEnabled: false })
  const w = e.fillWindow(10).O1
  const pp = ppRange(w)
  check('O1 pp in [40, 250] µV', pp > 40 && pp < 250, `(pp=${pp.toFixed(0)})`)
}

// ─── 11. Stochastic alpha envelope: amplitude varies irregularly ────────
console.log('\n[11] Stochastic alpha envelope (non-constant amplitude):')
{
  const e = createEngineForPattern('normal_awake', { eyesClosed: true, blinksEnabled: false })
  // Skip warm-up so the envelope is in a "natural" state
  e.fillWindow(2)
  // Probe the engine's pdrEnvelope directly across 30 seconds at 10 Hz
  // — bypasses sliding-RMS smoothing and channel noise contamination.
  const samples = []
  for (let i = 0; i < 300; i++) {
    e.fillWindow(0.1)
    samples.push(e.pdrEnvelope.value())
  }
  let mn = Infinity, mx = -Infinity
  for (const s of samples) { if (s < mn) mn = s; if (s > mx) mx = s }
  const ratio = mx / Math.max(0.001, mn)
  check('envelope swing ratio > 1.8× (peak/trough)', ratio > 1.8,
    `(mn=${mn.toFixed(2)}, mx=${mx.toFixed(2)}, ratio=${ratio.toFixed(2)})`)
}

// ─── 12. Alpha envelope shared between O1 and O2 (both wax/wane together)
console.log('\n[12] Alpha envelope coherent across posterior pair:')
{
  const e = createEngineForPattern('normal_awake', { eyesClosed: true, blinksEnabled: false })
  e.fillWindow(2)
  const data = e.fillWindow(20)
  // Sliding-RMS envelope for both channels
  const slidingRms = (sig) => {
    const N = SAMPLE_RATE / 2
    const out = new Float32Array(sig.length)
    let s = 0
    for (let i = 0; i < N; i++) { s += sig[i] * sig[i]; out[i] = Math.sqrt(s / (i + 1)) }
    for (let i = N; i < sig.length; i++) {
      s += sig[i] * sig[i] - sig[i - N] * sig[i - N]
      out[i] = Math.sqrt(s / N)
    }
    return out
  }
  const e1 = slidingRms(data.O1)
  const e2 = slidingRms(data.O2)
  const r = pearson(e1, e2)
  check('O1 ↔ O2 envelope correlation > 0.6', r > 0.6, `(got ${r.toFixed(3)})`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
