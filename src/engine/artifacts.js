/**
 * Artifact Simulation Engine
 *
 * Generates realistic multi-channel EEG artifact patterns over a standard
 * longitudinal bipolar montage. Each generator returns:
 *   {
 *     channels: Array<{ label, data: Float32Array }>,
 *     events:   Array<{ t: seconds, text?: string }>,  // optional annotations
 *     hot:      Array<string>,                         // channels where artifact is maximal
 *   }
 *
 * The signals are synthesised to mimic real clinical traces as closely as
 * the engine allows — asymmetric blink morphology, saccadic square-wave
 * steps, MUAP-shaped EMG content, biphasic QRS, polymorphic slow drift,
 * and slow DC-recovery for electrode pops — rather than using simple
 * sinusoidal approximations.
 */

import {
  injectEyeBlink,
  SAMPLE_RATE,
} from './signalGenerator.js'
import { createEngineForPattern } from './streaming.js'
import { applyMontage } from './montages.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gaussian(mean = 0, std = 1) {
  const u = 1 - Math.random()
  const v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function zeros(n) { return new Float32Array(n) }

function addSine(buf, freq, amp, phase = 0, fs = SAMPLE_RATE) {
  for (let i = 0; i < buf.length; i++)
    buf[i] += amp * Math.sin(2 * Math.PI * freq * i / fs + phase)
}

/**
 * Add an EMG-like burst: broad-band high-frequency content (30–120 Hz)
 * with stochastic motor-unit firing on top of the chosen envelope.
 *
 * Summing several high-frequency sines with random phase gives a
 * band-limited "fuzz" that looks far more like real temporalis/frontalis
 * EMG than pure Gaussian noise does.
 */
function emgBurst(buf, s0, durationN, peakAmp, opts = {}) {
  const {
    bandMin       = 28,
    bandMax       = 110,
    nComponents   = 10,
    envShape      = 'bell',       // 'bell' | 'plateau' | 'ramp-up' | 'ramp-down'
    stochasticAmp = 0.45,          // MUAP randomness
    muapRatePerS  = 22,            // aggregate motor-unit firing rate
  } = opts

  const fs     = SAMPLE_RATE
  const freqs  = new Float32Array(nComponents)
  const phases = new Float32Array(nComponents)
  for (let k = 0; k < nComponents; k++) {
    freqs[k]  = bandMin + Math.random() * (bandMax - bandMin)
    phases[k] = Math.random() * 2 * Math.PI
  }

  // Low-frequency modulation of aggregate MUAP firing so amplitude
  // flickers irregularly, rather than being perfectly steady.
  const modF = muapRatePerS * (0.7 + Math.random() * 0.6) / 10
  const modP = Math.random() * 2 * Math.PI

  for (let i = 0; i < durationN; i++) {
    const idx = s0 + i
    if (idx < 0 || idx >= buf.length) continue
    const x   = i / durationN                     // 0..1
    const env = envShape === 'bell'     ? Math.sin(Math.PI * x)
             : envShape === 'ramp-up'   ? x
             : envShape === 'ramp-down' ? 1 - x
             : envShape === 'plateau'   ? (x < 0.1 ? x / 0.1
                                         : x > 0.9 ? (1 - x) / 0.1 : 1)
             : 1
    let v = 0
    const t = i / fs
    for (let k = 0; k < nComponents; k++) {
      v += Math.sin(2 * Math.PI * freqs[k] * t + phases[k])
    }
    v /= nComponents
    // Stochastic motor-unit activity
    v += gaussian(0, stochasticAmp)
    const mod = 0.7 + 0.3 * Math.sin(2 * Math.PI * modF * t + modP)
    buf[idx] += v * peakAmp * env * mod
  }
}

/**
 * Polymorphic low-frequency drift — sum of several slow components with
 * independent random phases. Far more realistic than a single sine for
 * sweat, respiration, and movement artefacts.
 */
function addPolymorphicDrift(buf, { amp = 100, minF = 0.05, maxF = 0.5, nComponents = 4 } = {}) {
  const fs = SAMPLE_RATE
  for (let c = 0; c < nComponents; c++) {
    const freq  = minF + Math.random() * (maxF - minF)
    const phase = Math.random() * 2 * Math.PI
    const a     = amp * (0.5 + Math.random() * 0.5) / nComponents
    for (let i = 0; i < buf.length; i++) {
      buf[i] += a * Math.sin(2 * Math.PI * freq * i / fs + phase)
    }
  }
}

/**
 * Saccade-like horizontal eye movement: very fast step up to plateau,
 * brief hold, then a slower exponential drift back. This is the
 * canonical "square wave" appearance of a lateral eye movement on EEG.
 */
function injectSaccade(buf, s0, { amp = 200, polarity = +1, stepMs = 30, holdMs = 180, decayMs = 260 } = {}) {
  const fs    = SAMPLE_RATE
  const rise  = Math.round(stepMs  * fs / 1000)
  const hold  = Math.round(holdMs  * fs / 1000)
  const decay = Math.round(decayMs * fs / 1000)

  for (let i = 0; i < rise; i++) {
    const idx = s0 + i
    if (idx >= buf.length) return
    // Sigmoidal ramp
    const x = i / rise
    const s = 0.5 - 0.5 * Math.cos(Math.PI * x)
    buf[idx] += polarity * amp * s
  }
  for (let i = 0; i < hold; i++) {
    const idx = s0 + rise + i
    if (idx >= buf.length) return
    buf[idx] += polarity * amp * (1 - 0.04 * (i / hold))  // tiny sag during hold
  }
  for (let i = 0; i < decay; i++) {
    const idx = s0 + rise + hold + i
    if (idx >= buf.length) return
    buf[idx] += polarity * amp * Math.exp(-2.5 * i / decay)
  }
}

function injectNystagmusBeat(buf, s0, { amp = 160, polarity = +1, slowMs = 230, fastMs = 38, pauseMs = 35 } = {}) {
  const fs = SAMPLE_RATE
  const slow = Math.round(slowMs * fs / 1000)
  const fast = Math.round(fastMs * fs / 1000)
  const pause = Math.round(pauseMs * fs / 1000)

  for (let i = 0; i < slow; i++) {
    const idx = s0 + i
    if (idx >= buf.length) return
    const x = i / Math.max(1, slow - 1)
    const drift = 0.5 - 0.5 * Math.cos(Math.PI * x)
    buf[idx] += polarity * amp * drift
  }

  for (let i = 0; i < fast; i++) {
    const idx = s0 + slow + i
    if (idx >= buf.length) return
    const x = i / Math.max(1, fast - 1)
    const reset = 1 - (0.5 - 0.5 * Math.cos(Math.PI * x))
    buf[idx] += polarity * amp * reset
  }

  for (let i = 0; i < pause; i++) {
    const idx = s0 + slow + fast + i
    if (idx >= buf.length) return
    buf[idx] += polarity * amp * 0.04 * Math.sin(2 * Math.PI * 9 * i / fs)
  }
}

/**
 * Electrode pop: abrupt step with brief plateau followed by slow DC
 * recovery back to baseline over ~0.5–1.5 s. This slow tail is the most
 * characteristic visual feature — a genuine spike has no such tail.
 */
function injectPop(buf, s0, { amp = 450, polarity = +1, flatMs = 50, recoverMs = 900 } = {}) {
  const fs   = SAMPLE_RATE
  const rise = Math.round(0.008 * fs)             // ~8 ms lightning-fast rise
  const flat = Math.round(flatMs    * fs / 1000)
  const rec  = Math.round(recoverMs * fs / 1000)

  for (let i = 0; i < rise; i++) {
    const idx = s0 + i
    if (idx >= buf.length) return
    buf[idx] += polarity * amp * (i / rise)
  }
  for (let i = 0; i < flat; i++) {
    const idx = s0 + rise + i
    if (idx >= buf.length) return
    // Small wobble during the plateau
    buf[idx] += polarity * amp * (1 + 0.03 * Math.sin(2 * Math.PI * 30 * i / fs))
  }
  // Slow DC recovery with a faster initial component
  for (let i = 0; i < rec; i++) {
    const idx = s0 + rise + flat + i
    if (idx >= buf.length) return
    const k  = i / rec
    const v  = 0.7 * Math.exp(-5 * k) + 0.3 * Math.exp(-1.4 * k)
    buf[idx] += polarity * amp * v
  }
}

/**
 * Realistic single cardiac cycle (P-QRS-T) with biphasic P, sharp
 * narrow QRS including S-wave depression, and broad T-wave.
 */
function injectCardiacBeat(buf, rPeak, amp) {
  const fs = SAMPLE_RATE

  // P-wave (~80 ms before QRS, low amplitude, rounded)
  const pDur = Math.round(0.09 * fs)
  const pOff = rPeak - Math.round(0.17 * fs)
  for (let i = 0; i < pDur; i++) {
    const idx = pOff + i
    if (idx < 0 || idx >= buf.length) continue
    buf[idx] += amp * 0.10 * Math.sin(Math.PI * i / pDur)
  }

  // QRS complex: Q dip, R peak, S dip (classic biphasic-biphasic shape)
  const qDur = Math.round(0.012 * fs)
  const rDur = Math.round(0.028 * fs)
  const sDur = Math.round(0.022 * fs)

  for (let i = 0; i < qDur; i++) {
    const idx = rPeak - qDur + i
    if (idx < 0 || idx >= buf.length) continue
    buf[idx] += amp * -0.18 * (i / qDur)
  }
  for (let i = 0; i < rDur; i++) {
    const idx = rPeak + i
    if (idx >= buf.length) return
    const x = i / rDur
    const v = x < 0.5 ? x / 0.5 : (1 - x) / 0.5
    buf[idx] += amp * v
  }
  for (let i = 0; i < sDur; i++) {
    const idx = rPeak + rDur + i
    if (idx >= buf.length) return
    const x = i / sDur
    const v = x < 0.5 ? -x / 0.5 * 0.35 : -(1 - x) / 0.5 * 0.35
    buf[idx] += amp * v
  }

  // T-wave: broad rounded positive deflection after ST segment
  const tDur = Math.round(0.20 * fs)
  const tOff = rPeak + Math.round(0.12 * fs)
  for (let i = 0; i < tDur; i++) {
    const idx = tOff + i
    if (idx >= buf.length) return
    buf[idx] += amp * 0.32 * Math.sin(Math.PI * i / tDur)
  }
}

// Standard longitudinal bipolar channel layout used in all demos
export const DEMO_CHANNELS = [
  'Fp1–F7','F7–T7','T7–P7','P7–O1',
  'Fp1–F3','F3–C3','C3–P3','P3–O1',
  'Fz–Cz','Cz–Pz',
  'Fp2–F4','F4–C4','C4–P4','P4–O2',
  'Fp2–F8','F8–T8','T8–P8','P8–O2',
]

// Electrode region membership for each bipolar pair
const CHANNEL_REGIONS = {
  'Fp1–F7': ['frontal','frontopolar','left'],
  'F7–T7':  ['frontal','temporal','left'],
  'T7–P7':  ['temporal','left'],
  'P7–O1':  ['temporal','occipital','left'],
  'Fp1–F3': ['frontal','frontopolar','left'],
  'F3–C3':  ['frontal','central','left'],
  'C3–P3':  ['central','parietal','left'],
  'P3–O1':  ['parietal','occipital','left'],
  'Fz–Cz':  ['central','midline'],
  'Cz–Pz':  ['central','parietal','midline'],
  'Fp2–F4': ['frontal','frontopolar','right'],
  'F4–C4':  ['frontal','central','right'],
  'C4–P4':  ['central','parietal','right'],
  'P4–O2':  ['parietal','occipital','right'],
  'Fp2–F8': ['frontal','frontopolar','right'],
  'F8–T8':  ['frontal','temporal','right'],
  'T8–P8':  ['temporal','right'],
  'P8–O2':  ['temporal','occipital','right'],
}

const CHANNEL_PAIRS = Object.fromEntries(
  DEMO_CHANNELS.map(label => {
    const [pos, neg] = label.split('–')
    return [label, { pos, neg }]
  })
)

const DEMO_ELECTRODES = Array.from(new Set(
  DEMO_CHANNELS.flatMap(label => label.split('–'))
))

function hasRegion(ch, ...regions) {
  return regions.some(r => (CHANNEL_REGIONS[ch] ?? []).includes(r))
}

function createElectrodeArtifacts() {
  return Object.fromEntries(DEMO_ELECTRODES.map(label => [label, zeros(N)]))
}

function addElectrodeFieldToChannel(data, channelLabel, electrodeArtifacts) {
  const pair = CHANNEL_PAIRS[channelLabel]
  if (!pair) return
  const pos = electrodeArtifacts[pair.pos]
  const neg = electrodeArtifacts[pair.neg]
  for (let i = 0; i < data.length; i++) {
    data[i] += (pos?.[i] ?? 0) - (neg?.[i] ?? 0)
  }
}

function channelsSharingElectrode(electrode) {
  return DEMO_CHANNELS.filter(label => {
    const pair = CHANNEL_PAIRS[label]
    return pair?.pos === electrode || pair?.neg === electrode
  })
}

function addSlowCycle(buf, period, amp, phaseOff = 0, shape = 'respiration') {
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE + phaseOff
    const cyc = (t % period) / period
    let v
    if (shape === 'ventilator') {
      v = cyc < 0.1
        ? cyc / 0.1
        : cyc < 0.4
          ? 1 - 0.05 * ((cyc - 0.1) / 0.3)
          : 1 - (cyc - 0.4) / 0.6
    } else {
      v = cyc < 0.4
        ? Math.sin(Math.PI * cyc / 0.4) * 0.5
        : 0.5 - (1 - Math.cos(Math.PI * (cyc - 0.4) / 0.6)) * 0.5
    }
    buf[i] += amp * (v * 2 - 0.5)
  }
}

function injectPulseWave(buf, rPeak, amp) {
  const delay = Math.round(0.23 * SAMPLE_RATE)
  const dur = Math.round(0.32 * SAMPLE_RATE)
  const start = rPeak + delay
  for (let i = 0; i < dur; i++) {
    const idx = start + i
    if (idx < 0 || idx >= buf.length) continue
    const x = i / dur
    const rounded = Math.sin(Math.PI * x)
    const shoulder = x < 0.35 ? x / 0.35 : Math.exp(-2.2 * (x - 0.35))
    buf[idx] += amp * (0.65 * rounded + 0.35 * shoulder)
  }
}

// ─── Duration constants ───────────────────────────────────────────────────────
const DEMO_SECS = 8
const N = DEMO_SECS * SAMPLE_RATE

// ─── Background template (clean EEG under all artifacts) ─────────────────────

let backgroundBatch = null

function backgroundPatternForBands(bands) {
  return bands.includes('delta') && bands.includes('theta') && !bands.includes('alpha')
    ? 'diffuse_slowing'
    : 'normal_awake'
}

function refillBackgroundBatch(n, bands, noiseLevel) {
  const pattern = backgroundPatternForBands(bands)
  const engine = createEngineForPattern(pattern, {
    eyesClosed: true,
    blinksEnabled: false,
    noiseLevel,
  })
  const raw = engine.fillWindow(n / SAMPLE_RATE)
  const derived = applyMontage(raw, 'longitudinal_bipolar')
  backgroundBatch = {
    key: `${pattern}:${n}:${noiseLevel}`,
    channels: new Map(derived.map(({ label, data }) => [label, data])),
  }
}

function bgChannel(n, bands = ['alpha'], amp = 40, noiseLevel = 0.18, label = null) {
  const pattern = backgroundPatternForBands(bands)
  const key = `${pattern}:${n}:${noiseLevel}`
  if (!backgroundBatch || backgroundBatch.key !== key) {
    refillBackgroundBatch(n, bands, noiseLevel)
  }

  const source = label
    ? backgroundBatch.channels.get(label)
    : backgroundBatch.channels.values().next().value
  const out = new Float32Array(source ?? n)
  const scale = amp / 36
  if (Number.isFinite(scale) && Math.abs(scale - 1) > 0.01) {
    for (let i = 0; i < out.length; i++) out[i] *= scale
  }
  return out
}

function buildResult(channels, events = [], hot = []) {
  return { channels, events, hot }
}

// =============================================================================
// ARTIFACT GENERATORS
// =============================================================================

/**
 * 1. EYE BLINK
 * Corneoretinal potential: asymmetric rise/fall (fast close ~60 ms,
 * slower reopening ~220 ms), maximal at frontopolar channels.
 */
export function generateEyeBlinkArtifact() {
  const blinkTimes = [1.25, 3.05, 5.15, 6.85]
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()

  const field = {
    Fp1: 1.00, Fp2: 1.00,
    F7:  0.38, F8:  0.38,
    F3:  0.34, F4:  0.34, Fz: 0.28,
    T7:  0.08, T8:  0.08,
    C3:  0.06, C4:  0.06, Cz: 0.05,
    P3:  0.02, P4:  0.02, Pz: 0.02,
    P7:  0.02, P8:  0.02,
    O1:  0.00, O2:  0.00,
  }

  blinkTimes.forEach(t => {
    const s0     = Math.round(t * SAMPLE_RATE)
    const riseMs = 55 + Math.random() * 25
    const fallMs = 200 + Math.random() * 60
    const peak   = 230 + Math.random() * 80

    for (const electrode of DEMO_ELECTRODES) {
      const scale = field[electrode] ?? 0
      if (scale <= 0) continue
      injectEyeBlink(electrodeArtifacts[electrode], s0, {
        amplitude: peak * scale,
        riseMs,
        fallMs,
        polarity: +1,
      })
    }
  })

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 38, 0.18, label)

    const isFrontopolar = hasRegion(label, 'frontopolar')
    if (isFrontopolar) hot.push(label)
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  const events = blinkTimes.map(t => ({ t, text: 'blink' }))
  return buildResult(channels, events, hot)
}

/**
 * 2. LATERAL EYE MOVEMENT (HORIZONTAL)
 * Saccadic square-wave with OPPOSITE POLARITY at Fp1 vs Fp2.
 * The step-and-plateau morphology distinguishes it from blinks.
 */
export function generateLateralEyeMovementArtifact() {
  const moves = [
    { t: 0.8, dir: +1 }, { t: 2.2, dir: -1 }, { t: 3.6, dir: +1 },
    { t: 4.9, dir: -1 }, { t: 6.2, dir: +1 }, { t: 7.3, dir: -1 },
  ]
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()

  // Horizontal corneoretinal dipole. For right gaze (dir=+1), the
  // positive cornea is closer to right frontotemporal electrodes and the
  // contralateral side sees the retinal-negative field. Left gaze reverses.
  const lateralField = {
    Fp1: -0.55, F7: -1.00, F3: -0.35, T7: -0.22, C3: -0.08,
    Fp2: +0.55, F8: +1.00, F4: +0.35, T8: +0.22, C4: +0.08,
    Fz: 0.00, Cz: 0.00, Pz: 0.00,
    P7: -0.04, P3: -0.03, O1: -0.02,
    P8: +0.04, P4: +0.03, O2: +0.02,
  }

  moves.forEach(({ t, dir }) => {
    const s0 = Math.round(t * SAMPLE_RATE)
    const peak = 230 + Math.random() * 60

    for (const electrode of DEMO_ELECTRODES) {
      const field = lateralField[electrode] ?? 0
      if (Math.abs(field) < 0.01) continue
      injectSaccade(electrodeArtifacts[electrode], s0, {
        amp: peak * Math.abs(field),
        polarity: Math.sign(field) * dir,
        stepMs:  20 + Math.random() * 15,
        holdMs:  150 + Math.random() * 80,
        decayMs: 220 + Math.random() * 120,
      })
    }
  })

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 38, 0.18, label)
    if (['Fp1–F7','F7–T7','Fp1–F3','Fp2–F8','F8–T8','Fp2–F4'].includes(label)) {
      hot.push(label)
    }
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  const events = moves.map(({ t, dir }) => ({ t, text: dir > 0 ? '→' : '←' }))
  return buildResult(channels, events, hot)
}

/**
 * 3. ROVING EYE MOVEMENT ARTIFACT
 * Slow, conjugate wandering eye movements that create broad frontal drift.
 */
export function generateRovingEyeMovementArtifact() {
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()

  const horizontalField = {
    Fp1: -0.62, F7: -1.00, F3: -0.42, T7: -0.20, C3: -0.06,
    Fp2: +0.62, F8: +1.00, F4: +0.42, T8: +0.20, C4: +0.06,
    Fz: 0.00, Cz: 0.00, Pz: 0.00,
    P7: -0.03, P3: -0.02, O1: -0.02,
    P8: +0.03, P4: +0.02, O2: +0.02,
  }
  const verticalField = {
    Fp1: 1.00, Fp2: 1.00,
    F7:  0.46, F8:  0.46,
    F3:  0.42, F4:  0.42, Fz: 0.36,
    T7:  0.08, T8:  0.08,
    C3:  0.05, C4:  0.05, Cz: 0.04,
    P3:  0.02, P4:  0.02, Pz: 0.02,
    P7:  0.02, P8:  0.02,
    O1:  0.00, O2:  0.00,
  }

  const hPhases = [0.35, 1.7, 4.1]
  const vPhases = [2.2, 0.8, 5.0]

  for (let i = 0; i < N; i++) {
    const t = i / SAMPLE_RATE
    const h =
      0.62 * Math.sin(2 * Math.PI * 0.18 * t + hPhases[0]) +
      0.28 * Math.sin(2 * Math.PI * 0.31 * t + hPhases[1]) +
      0.10 * Math.sin(2 * Math.PI * 0.07 * t + hPhases[2])
    const v =
      0.55 * Math.sin(2 * Math.PI * 0.13 * t + vPhases[0]) +
      0.32 * Math.sin(2 * Math.PI * 0.24 * t + vPhases[1]) +
      0.13 * Math.sin(2 * Math.PI * 0.05 * t + vPhases[2])
    const envelope = 0.82 + 0.18 * Math.sin(2 * Math.PI * 0.045 * t + 0.6)

    for (const electrode of DEMO_ELECTRODES) {
      const hScale = horizontalField[electrode] ?? 0
      const vScale = verticalField[electrode] ?? 0
      electrodeArtifacts[electrode][i] += envelope * (112 * hScale * h + 86 * vScale * v)
    }
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['delta', 'theta'], 30, 0.20, label)
    if (hasRegion(label, 'frontopolar') || (hasRegion(label, 'frontal') && hasRegion(label, 'temporal'))) {
      hot.push(label)
    }
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  const events = [
    { t: 1.1, text: 'rove' },
    { t: 3.6, text: 'rove' },
    { t: 6.1, text: 'rove' },
  ]

  return buildResult(channels, events, hot)
}

/**
 * 4. NYSTAGMUS ARTIFACT
 * Repetitive ocular slow phase with fast corrective reset.
 */
export function generateNystagmusArtifact() {
  const episodes = [
    { start: 0.75, duration: 2.15, dir: +1, rate: 3.2 },
    { start: 4.15, duration: 2.55, dir: -1, rate: 3.8 },
  ]
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()

  const lateralField = {
    Fp1: -0.58, F7: -1.00, F3: -0.38, T7: -0.24, C3: -0.08,
    Fp2: +0.58, F8: +1.00, F4: +0.38, T8: +0.24, C4: +0.08,
    Fz: 0.00, Cz: 0.00, Pz: 0.00,
    P7: -0.05, P3: -0.03, O1: -0.03,
    P8: +0.05, P4: +0.03, O2: +0.03,
  }

  const events = []

  episodes.forEach(({ start, duration, dir, rate }) => {
    const period = 1 / rate
    const beatCount = Math.floor(duration / period)

    for (let beat = 0; beat < beatCount; beat++) {
      const t = start + beat * period
      const s0 = Math.round(t * SAMPLE_RATE)
      const ampMod = 0.86 + Math.random() * 0.28
      const slowMs = period * 1000 * (0.72 + Math.random() * 0.08)
      const fastMs = period * 1000 * (0.11 + Math.random() * 0.03)
      const pauseMs = Math.max(12, period * 1000 - slowMs - fastMs)
      const peak = 165 * ampMod

      for (const electrode of DEMO_ELECTRODES) {
        const field = lateralField[electrode] ?? 0
        if (Math.abs(field) < 0.01) continue
        injectNystagmusBeat(electrodeArtifacts[electrode], s0, {
          amp: peak * Math.abs(field),
          polarity: Math.sign(field) * dir,
          slowMs,
          fastMs,
          pauseMs,
        })
      }

      events.push({ t, text: 'ny' })
    }
  })

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 36, 0.18, label)
    if (hasRegion(label, 'frontopolar') || (hasRegion(label, 'temporal') && hasRegion(label, 'frontal'))) {
      hot.push(label)
    }
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  return buildResult(channels, events, hot)
}

/**
 * 5. MUSCLE (EMG) ARTIFACT
 * Broadband (>30 Hz) MUAP-shaped activity, temporal-maximum.
 */
export function generateMuscleArtifact() {
  const bursts = [
    { t: 1.2, dur: 1.3, side: 'both'  },
    { t: 3.5, dur: 0.9, side: 'left'  },
    { t: 5.2, dur: 1.7, side: 'right' },
  ]
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()

  const emgField = {
    Fp1: 0.32, Fp2: 0.32,
    F7:  0.72, F8:  0.72,
    T7:  1.00, T8:  1.00,
    P7:  0.82, P8:  0.82,
    F3:  0.24, F4:  0.24,
    C3:  0.10, C4:  0.10, Cz: 0.04,
    P3:  0.08, P4:  0.08, Pz: 0.03,
    O1:  0.18, O2:  0.18,
  }

  bursts.forEach(({ t, dur, side }) => {
    const s0 = Math.round(t * SAMPLE_RATE)
    const durN = Math.round(dur * SAMPLE_RATE)
    for (const electrode of DEMO_ELECTRODES) {
      const isLeft = ['Fp1', 'F7', 'T7', 'P7', 'F3', 'C3', 'P3', 'O1'].includes(electrode)
      const isRight = ['Fp2', 'F8', 'T8', 'P8', 'F4', 'C4', 'P4', 'O2'].includes(electrode)
      const sideScale = side === 'both' ? 1 : side === 'left' ? (isLeft ? 1 : isRight ? 0.18 : 0.55) : (isRight ? 1 : isLeft ? 0.18 : 0.55)
      const amp = 135 * (emgField[electrode] ?? 0.04) * sideScale
      if (amp < 5) continue
      emgBurst(electrodeArtifacts[electrode], s0, durN, amp, {
        bandMin: 30,
        bandMax: 115,
        nComponents: 12,
        envShape: 'plateau',
        stochasticAmp: 0.55,
      })
    }
  })

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 32, 0.18, label)

    const isTemp  = hasRegion(label, 'temporal')
    const isFront = hasRegion(label, 'frontal')
    if (isTemp || isFront) hot.push(label)
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  const events = bursts.map(({ t }) => ({ t, text: 'EMG' }))
  return buildResult(channels, events, hot)
}

/**
 * 4. CHEWING ARTIFACT
 * Rhythmic 1–2 Hz EMG bursts from masseter, temporal maximum.
 */
export function generateChewingArtifact() {
  const chewFreq   = 1.6
  const chewPeriod = Math.round(SAMPLE_RATE / chewFreq)
  const chewStart  = Math.round(2.0 * SAMPLE_RATE)
  const chewEnd    = Math.round(6.5 * SAMPLE_RATE)
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()
  const chewingField = {
    F7: 0.58, T7: 1.00, P7: 0.78,
    F8: 0.48, T8: 0.86, P8: 0.68,
    Fp1: 0.20, Fp2: 0.16,
    F3: 0.22, F4: 0.18,
    C3: 0.06, C4: 0.05,
    O1: 0.05, O2: 0.04,
  }

  for (let s = chewStart; s < chewEnd; s += chewPeriod) {
    const jitter = Math.round((Math.random() - 0.5) * 0.05 * SAMPLE_RATE)
    const burstN = Math.round((0.13 + Math.random() * 0.08) * SAMPLE_RATE)
    const biteStrength = 0.75 + Math.random() * 0.55
    for (const electrode of DEMO_ELECTRODES) {
      const amp = 210 * biteStrength * (chewingField[electrode] ?? 0.02)
      if (amp < 6) continue
      emgBurst(electrodeArtifacts[electrode], s + jitter, burstN, amp, {
        bandMin: 38,
        bandMax: 125,
        nComponents: 12,
        envShape: 'bell',
        stochasticAmp: 0.65,
      })
    }
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 32, 0.18, label)
    const isTemp  = hasRegion(label, 'temporal')
    const isFront = hasRegion(label, 'frontal')

    if (isTemp || isFront) hot.push(label)
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  return buildResult(channels, [
    { t: chewStart / SAMPLE_RATE, text: 'chew-on' },
    { t: chewEnd   / SAMPLE_RATE, text: 'chew-off' },
  ], hot)
}

/**
 * 5. SHIVER ARTIFACT
 * Tremulous, rhythmic EMG bursts from scalp/neck muscle activation,
 * often seen when the patient is cold, febrile, or anxious.
 */
export function generateShiverArtifact() {
  const shiverFreq = 6.2 + Math.random() * 2.2
  const cycleN = Math.round(SAMPLE_RATE / shiverFreq)
  const shiverStart = Math.round(1.1 * SAMPLE_RATE)
  const shiverEnd = Math.round(7.0 * SAMPLE_RATE)
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()
  const shiverField = {
    Fp1: 0.28, Fp2: 0.28,
    F7:  0.72, F8:  0.72,
    T7:  1.00, T8:  0.96,
    P7:  0.92, P8:  0.88,
    F3:  0.34, F4:  0.34,
    C3:  0.16, C4:  0.16, Cz: 0.10,
    P3:  0.22, P4:  0.22, Pz: 0.14,
    O1:  0.46, O2:  0.42,
  }

  for (let s = shiverStart; s < shiverEnd; s += cycleN) {
    const jitter = Math.round(gaussian(0, 0.018 * SAMPLE_RATE))
    const burstN = Math.round((0.055 + Math.random() * 0.035) * SAMPLE_RATE)
    const tremorGain = 0.78 + Math.random() * 0.48

    for (const electrode of DEMO_ELECTRODES) {
      const amp = 185 * tremorGain * (shiverField[electrode] ?? 0.06)
      if (amp < 6) continue
      emgBurst(electrodeArtifacts[electrode], s + jitter, burstN, amp, {
        bandMin: 32,
        bandMax: 125,
        nComponents: 10,
        envShape: 'bell',
        stochasticAmp: 0.58,
        muapRatePerS: 30,
      })
    }
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 32, 0.18, label)
    const isTemp = hasRegion(label, 'temporal')
    const isFront = hasRegion(label, 'frontal')
    const isOccipital = hasRegion(label, 'occipital')

    if (isTemp || isFront || isOccipital) hot.push(label)
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  return buildResult(channels, [
    { t: shiverStart / SAMPLE_RATE, text: 'shiver-on' },
    { t: shiverEnd / SAMPLE_RATE, text: 'shiver-off' },
  ], hot)
}

/**
 * 6. TREMOR ARTIFACT
 * Regular rhythmic movement artifact with superimposed EMG texture.
 */
export function generateTremorArtifact() {
  const tremorFreq = 4.6 + Math.random() * 1.4
  const tremorStart = 1.0
  const tremorEnd = 7.2
  const side = Math.random() < 0.5 ? 'left' : 'right'
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()
  const tremorField = {
    Fp1: 0.20, Fp2: 0.20,
    F7:  0.72, F8:  0.70,
    T7:  1.00, T8:  0.96,
    P7:  0.88, P8:  0.84,
    F3:  0.38, F4:  0.36,
    C3:  0.28, C4:  0.26, Cz: 0.14,
    P3:  0.30, P4:  0.28, Pz: 0.12,
    O1:  0.34, O2:  0.32,
  }

  const leftElectrodes = ['Fp1', 'F7', 'T7', 'P7', 'F3', 'C3', 'P3', 'O1']
  const rightElectrodes = ['Fp2', 'F8', 'T8', 'P8', 'F4', 'C4', 'P4', 'O2']

  for (const electrode of DEMO_ELECTRODES) {
    const isLeft = leftElectrodes.includes(electrode)
    const isRight = rightElectrodes.includes(electrode)
    const sideScale = side === 'left' ? (isLeft ? 1 : isRight ? 0.34 : 0.55) : (isRight ? 1 : isLeft ? 0.34 : 0.55)
    const field = (tremorField[electrode] ?? 0.08) * sideScale
    if (field < 0.04) continue
    const phase = Math.random() * Math.PI * 2
    const buf = electrodeArtifacts[electrode]

    for (let i = 0; i < buf.length; i++) {
      const t = i / SAMPLE_RATE
      if (t < tremorStart || t > tremorEnd) continue
      const ramp = Math.min(1, (t - tremorStart) / 0.55, (tremorEnd - t) / 0.55)
      const envelope = Math.max(0, ramp) * (0.78 + 0.22 * Math.sin(2 * Math.PI * 0.18 * t + phase))
      const movement = Math.sin(2 * Math.PI * tremorFreq * t + phase)
      const harmonic = 0.28 * Math.sin(2 * Math.PI * tremorFreq * 2 * t + phase * 0.7)
      buf[i] += field * envelope * (62 * movement + 18 * harmonic)
    }
  }

  const cycleN = Math.round(SAMPLE_RATE / tremorFreq)
  for (let s = Math.round((tremorStart + 0.25) * SAMPLE_RATE); s < Math.round((tremorEnd - 0.2) * SAMPLE_RATE); s += cycleN) {
    const burstN = Math.round((0.025 + Math.random() * 0.018) * SAMPLE_RATE)
    for (const electrode of DEMO_ELECTRODES) {
      const isLeft = leftElectrodes.includes(electrode)
      const isRight = rightElectrodes.includes(electrode)
      const sideScale = side === 'left' ? (isLeft ? 1 : isRight ? 0.26 : 0.45) : (isRight ? 1 : isLeft ? 0.26 : 0.45)
      const amp = 52 * sideScale * (tremorField[electrode] ?? 0.05)
      if (amp < 4) continue
      emgBurst(electrodeArtifacts[electrode], s + Math.round(gaussian(0, 0.008 * SAMPLE_RATE)), burstN, amp, {
        bandMin: 35,
        bandMax: 95,
        nComponents: 7,
        envShape: 'bell',
        stochasticAmp: 0.42,
        muapRatePerS: 20,
      })
    }
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 32, 0.17, label)
    const isAffectedSide = side === 'left' ? hasRegion(label, 'left') : hasRegion(label, 'right')
    if ((hasRegion(label, 'temporal') || hasRegion(label, 'frontal') || hasRegion(label, 'central')) && isAffectedSide) {
      hot.push(label)
    }
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  return buildResult(channels, [
    { t: tremorStart, text: `${tremorFreq.toFixed(1)} Hz` },
    { t: tremorEnd, text: 'tremor-off' },
  ], hot)
}

/**
 * 6. 50/60 Hz POWERLINE ARTIFACT
 * Monomorphic sinusoidal contamination at mains frequency,
 * with a harmonic and gentle AM from lighting ballast.
 */
export function generatePowerlineArtifact() {
  const lineFreq = 50
  const badElectrode = Math.random() < 0.5 ? 'T7' : 'P7'
  const neighborElectrodes = badElectrode === 'T7' ? ['F7', 'P7'] : ['T7', 'O1']
  const hot = Array.from(new Set([
    ...channelsSharingElectrode(badElectrode),
    ...neighborElectrodes.flatMap(channelsSharingElectrode),
  ]))
  const electrodeArtifacts = createElectrodeArtifacts()
  const commonPhase = Math.random() * Math.PI * 2
  const badPhase = commonPhase + 0.55

  for (const electrode of DEMO_ELECTRODES) {
    const bad = electrode === badElectrode
    const neighbor = neighborElectrodes.includes(electrode)
    const amp = bad ? 215 : neighbor ? 66 : 24
    const phase = bad
      ? badPhase
      : neighbor
        ? badPhase + (Math.random() - 0.5) * 0.20
        : commonPhase + (Math.random() - 0.5) * 0.08
    const harmonicPhase = phase + 0.42
    const buf = electrodeArtifacts[electrode]

    for (let i = 0; i < buf.length; i++) {
      const t = i / SAMPLE_RATE
      const amplitudeMod = 1 + 0.025 * Math.sin(2 * Math.PI * 0.25 * t + commonPhase)
      const local = amplitudeMod * amp * Math.sin(2 * Math.PI * lineFreq * t + phase)
      const common = 16 * Math.sin(2 * Math.PI * lineFreq * t + commonPhase)
      buf[i] += local + common
    }
    addSine(buf, lineFreq * 2, amp * 0.08, harmonicPhase)
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 30, 0.15, label)
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  const events = [
    { t: 0.6, text: `${lineFreq} Hz` },
  ]

  return buildResult(channels, events, hot)
}

/**
 * 6. ELECTRODE POP / SALT BRIDGE
 * Abrupt high-amplitude deflection with slow DC recovery,
 * strictly confined to channels sharing the affected electrode.
 */
export function generateElectrodePopArtifact() {
  const popTimes = [1.3, 2.8, 4.25, 5.7, 7.1]
  const hot = ['T7–P7', 'F7–T7', 'P7–O1']
  const electrodeArtifacts = createElectrodeArtifacts()

  popTimes.forEach(t => {
    const s0 = Math.round(t * SAMPLE_RATE)
    injectPop(electrodeArtifacts.T7, s0, {
      amp:       320 + Math.random() * 160,
      polarity:  Math.random() > 0.5 ? +1 : -1,
      flatMs:    30 + Math.random() * 40,
      recoverMs: 700 + Math.random() * 500,
    })
  })

  // A short salt-bridge interval makes neighbouring electrodes share a
  // smeared slow potential, distinct from the isolated high-amplitude pops.
  const bridgeStart = Math.round(5.0 * SAMPLE_RATE)
  const bridgeEnd = Math.round(6.25 * SAMPLE_RATE)
  for (let i = bridgeStart; i < Math.min(bridgeEnd, N); i++) {
    const t = i / SAMPLE_RATE
    const env = Math.sin(Math.PI * (i - bridgeStart) / Math.max(1, bridgeEnd - bridgeStart))
    const v = env * (42 * Math.sin(2 * Math.PI * 0.7 * t) + 16 * Math.sin(2 * Math.PI * 2.2 * t + 0.8))
    electrodeArtifacts.T7[i] += v
    electrodeArtifacts.P7[i] += v * 0.82
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 38, 0.18, label)

    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  const events = [
    ...popTimes.map(t => ({ t, text: 'pop' })),
    { t: bridgeStart / SAMPLE_RATE, text: 'bridge' },
  ]
  return buildResult(channels, events, hot)
}

/**
 * 7. ECG / PULSE ARTIFACT
 * Cardiac electrical field — biphasic P / sharp QRS / broad T,
 * perfectly regular at heart rate (~72 bpm).
 */
export function generateECGArtifact() {
  const heartRate  = 72 / 60
  const rrSamples  = Math.round(SAMPLE_RATE / heartRate)
  const hot = []
  const rPeaks = []
  const electrodeArtifacts = createElectrodeArtifacts()
  const ecgLead = zeros(N)

  let r = Math.round(0.35 * SAMPLE_RATE)
  while (r < N) {
    rPeaks.push(r)
    const rr = rrSamples + Math.round(gaussian(0, rrSamples * 0.018))
    r += rr
  }

  const cardiacField = {
    Fp1: 0.32, Fp2: 0.30,
    F7:  0.58, F8:  0.52,
    T7:  1.00, T8:  0.85,
    P7:  0.78, P8:  0.68,
    F3:  0.26, F4:  0.24, Fz: 0.22,
    C3:  0.34, C4:  0.30, Cz: 0.24,
    P3:  0.34, P4:  0.30, Pz: 0.24,
    O1:  0.42, O2:  0.38,
  }

  for (const electrode of DEMO_ELECTRODES) {
    const ampMod = cardiacField[electrode] ?? 0.25
    rPeaks.forEach(rPeak => {
      injectCardiacBeat(electrodeArtifacts[electrode], rPeak, 92 * ampMod)
      injectPulseWave(electrodeArtifacts[electrode], rPeak, 38 * ampMod)
    })
  }

  rPeaks.forEach(rPeak => {
    injectCardiacBeat(ecgLead, rPeak, -520)
  })
  for (let i = 0; i < ecgLead.length; i++) {
    ecgLead[i] += gaussian(0, 1.8)
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 32, 0.16, label)

    const isTemp   = hasRegion(label, 'temporal')
    const isFp     = hasRegion(label, 'frontopolar')
    const isMidline= hasRegion(label, 'midline')

    if (isTemp || isFp || isMidline) hot.push(label)

    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })
  channels.push({ label: 'ECG', data: ecgLead })
  hot.push('ECG')

  const events = rPeaks.map(rPeak => ({ t: rPeak / SAMPLE_RATE, text: 'QRS' }))
  return buildResult(channels, events, hot)
}

/**
 * 8. SWEAT / MOVEMENT (BASELINE DRIFT)
 * Polymorphic very-slow (<0.5 Hz) undulation with incoherent phase
 * across channels.
 */
export function generateSweatArtifact() {
  const badElectrodes = ['Fp1', Math.random() < 0.5 ? 'T7' : 'P7', Math.random() < 0.5 ? 'O1' : 'O2']
  const hot = Array.from(new Set(badElectrodes.flatMap(channelsSharingElectrode)))
  const electrodeArtifacts = createElectrodeArtifacts()

  for (const electrode of DEMO_ELECTRODES) {
    const isBad = badElectrodes.includes(electrode)
    const amp = isBad ? 170 + Math.random() * 140 : 18 + Math.random() * 35
    addPolymorphicDrift(electrodeArtifacts[electrode], {
      amp,
      minF: 0.025,
      maxF: isBad ? 0.30 : 0.18,
      nComponents: isBad ? 5 : 3,
    })
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 38, 0.18, label)
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })
  return buildResult(channels, [], hot)
}

/**
 * 9. GLOSSOKINETIC ARTIFACT
 * Polymorphic rhythmic 1–4 Hz frontal activity from tongue movement.
 */
export function generateGlossokinetic() {
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()
  const tongueField = {
    Fp1: 1.00, Fp2: 0.96,
    F7:  0.62, F8:  0.58,
    F3:  0.52, F4:  0.50, Fz: 0.56,
    T7:  0.18, T8:  0.16,
    C3:  0.16, C4:  0.14, Cz: 0.18,
    P3:  0.05, P4:  0.05, Pz: 0.06,
    P7:  0.04, P8:  0.04,
    O1:  0.01, O2:  0.01,
  }
  const epochs = [[1.5, 3.3], [4.2, 6.3]]

  epochs.forEach(([t0, t1]) => {
    const s0 = Math.round(t0 * SAMPLE_RATE)
    const s1 = Math.round(t1 * SAMPLE_RATE)
    const freqs = [
      1.4 + Math.random() * 0.4,
      2.4 + Math.random() * 0.4,
      3.4 + Math.random() * 0.5,
    ]
    const phases = freqs.map(() => Math.random() * 2 * Math.PI)
    for (const electrode of DEMO_ELECTRODES) {
      const scale = tongueField[electrode] ?? 0
      if (scale <= 0) continue
      const buf = electrodeArtifacts[electrode]
      for (let i = s0; i < Math.min(s1, N); i++) {
        const t = i / SAMPLE_RATE
        const u = (i - s0) / (s1 - s0)
        const env = u < 0.1 ? u / 0.1
          : u > 0.9 ? (1 - u) / 0.1
            : 1
        let v = 0
        for (let k = 0; k < freqs.length; k++) {
          v += Math.sin(2 * Math.PI * freqs[k] * t + phases[k])
        }
        buf[i] += scale * 145 * env * (v / freqs.length)
      }
    }
  })

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 36, 0.18, label)

    const isFp       = hasRegion(label, 'frontopolar')
    const isFrontal  = hasRegion(label, 'frontal') && !isFp

    if (isFp || isFrontal) hot.push(label)
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  const events = [
    { t: 1.5, text: 'tongue' }, { t: 3.3, text: 'stop' },
    { t: 4.2, text: 'tongue' }, { t: 6.3, text: 'stop' },
  ]
  return buildResult(channels, events, hot)
}

/**
 * 10. RESPIRATION ARTIFACT
 * Breathing-linked slow drift with subtle residual lead movement.
 */
export function generateRespirationArtifact() {
  const breathRate = 0.25
  const period = 1 / breathRate
  const breathStarts = [0.55, 4.55]
  const inspirationFrac = 0.36
  const hot = DEMO_CHANNELS.filter(label =>
    ['F3', 'C3', 'P3', 'F4', 'C4', 'P4', 'Fz', 'Cz', 'Pz'].some(electrode => label.includes(electrode))
  )
  const electrodeArtifacts = createElectrodeArtifacts()

  const field = {
    Fp1: 0.30, Fp2: 0.31,
    F7:  0.36, F8:  0.38,
    F3:  0.34, F4:  0.36, Fz: 0.32,
    T7:  0.40, T8:  0.42,
    C3:  0.82, C4:  0.78, Cz: 0.88,
    P7:  0.44, P8:  0.45,
    P3:  0.50, P4:  0.49, Pz: 0.54,
    O1:  0.34, O2:  0.34,
  }

  for (const electrode of DEMO_ELECTRODES) {
    const amp = 78 * (field[electrode] ?? 0.42) * (0.94 + Math.random() * 0.12)
    const sideDelay = (electrode.endsWith('2') || electrode.endsWith('4') || electrode === 'T8' || electrode === 'P8')
      ? 0.06
      : 0
    const buf = electrodeArtifacts[electrode]

    for (let i = 0; i < buf.length; i++) {
      const t = i / SAMPLE_RATE - breathStarts[0] - sideDelay
      if (t < 0) continue
      const cycleIndex = Math.floor(t / period)
      if (cycleIndex < 0 || cycleIndex >= breathStarts.length) continue
      const cyc = (t - cycleIndex * period) / period
      const pos = cyc < inspirationFrac
        ? 0.5 - 0.5 * Math.cos(Math.PI * cyc / inspirationFrac)
        : 0.5 + 0.5 * Math.cos(Math.PI * (cyc - inspirationFrac) / (1 - inspirationFrac))
      const centered = pos - 0.45
      buf[i] += amp * centered
    }
  }

  breathStarts.forEach(t => {
    const s0 = Math.round((t + period * inspirationFrac) * SAMPLE_RATE)
    const dur = Math.round(0.26 * SAMPLE_RATE)
    for (const electrode of ['F3', 'F4', 'Fz', 'C3', 'C4', 'Cz', 'P3', 'P4', 'Pz']) {
      const polarity = electrode.startsWith('P') ? -0.35 : 1
      const amp = (electrode === 'Cz' ? 10 : 7) * polarity
      for (let i = 0; i < dur; i++) {
        const idx = s0 + i
        if (idx < 0 || idx >= N) continue
        const x = i / dur
        electrodeArtifacts[electrode][idx] += amp * Math.sin(Math.PI * x)
      }
    }
  })

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha', 'theta'], 30, 0.16, label)
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  const events = breathStarts.flatMap(t => [
    { t, text: 'insp' },
    { t: t + period * inspirationFrac, text: 'exp' },
  ])

  return buildResult(channels, events, hot)
}

/**
 * 11. VENTILATOR ARTIFACT
 * Stereotyped mechanical cycle with steep inspiration plateau and
 * slower passive expiration. Generalised and very regular.
 */
export function generateVentilatorArtifact() {
  const ventRate = 0.22
  const period   = 1 / ventRate
  const electrodeArtifacts = createElectrodeArtifacts()
  const field = {
    Fp1: 0.62, Fp2: 0.62,
    F7:  0.70, F8:  0.70,
    F3:  0.88, F4:  0.90, Fz: 0.95,
    T7:  0.76, T8:  0.78,
    C3:  1.00, C4:  1.02, Cz: 1.06,
    P7:  0.72, P8:  0.72,
    P3:  0.86, P4:  0.88, Pz: 0.92,
    O1:  0.58, O2:  0.58,
  }

  for (const electrode of DEMO_ELECTRODES) {
    const amp = 76 * (field[electrode] ?? 0.75) * (0.94 + Math.random() * 0.12)
    addSlowCycle(electrodeArtifacts[electrode], period, amp, 0, 'ventilator')
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['delta', 'theta'], 28, 0.18, label)     // ICU background
    addElectrodeFieldToChannel(data, label, electrodeArtifacts)

    // Ventilator movement may also shift the reference/body potential or move
    // cable bundles together. Model that after montage subtraction so the
    // synchronous component remains visible throughout a bipolar montage.
    // Modest channel-to-channel variation avoids an implausible exact copy.
    const isMidline = label.includes('z')
    const isCentral = hasRegion(label, 'central')
    const diffuseGain = (isMidline ? 1.12 : isCentral ? 1.04 : 0.88)
      * (0.92 + Math.random() * 0.16)
    addSlowCycle(data, period, 42 * diffuseGain, 0, 'ventilator')

    return { label, data }
  })

  // Every ventilator cycle as a subtle tick
  const events = []
  for (let k = 0; k * period < DEMO_SECS; k++) {
    events.push({ t: k * period, text: 'I' })
  }
  return buildResult(channels, events, [])
}

/**
 * 12. PHOTOMYOGENIC RESPONSE
 * Brief frontopolar EMG burst time-locked to each strobe flash with
 * ~50 ms latency.
 */
export function generatePhotomyogenicArtifact() {
  const flashRate   = 10
  const flashPeriod = 1 / flashRate
  const stimStart   = 2.0
  const stimEnd     = 6.0
  const hot = []
  const electrodeArtifacts = createElectrodeArtifacts()
  const photoField = {
    Fp1: 1.00, Fp2: 1.00,
    F7:  0.62, F8:  0.62,
    F3:  0.40, F4:  0.40, Fz: 0.30,
    T7:  0.10, T8:  0.10,
    C3:  0.05, C4:  0.05, Cz: 0.04,
    P7:  0.02, P8:  0.02,
    P3:  0.02, P4:  0.02, Pz: 0.02,
  }

  for (let t = stimStart; t < stimEnd; t += flashPeriod) {
    const reflexGain = 0.7 + Math.random() * 0.6
    for (const electrode of DEMO_ELECTRODES) {
      const scale = photoField[electrode] ?? 0
      if (scale <= 0) continue
      const s0 = Math.round((t + 0.045 + Math.random() * 0.018) * SAMPLE_RATE)
      const burstN = Math.round((0.028 + Math.random() * 0.018) * SAMPLE_RATE)
      emgBurst(electrodeArtifacts[electrode], s0, burstN, 95 * scale * reflexGain, {
        bandMin: 45,
        bandMax: 140,
        nComponents: 8,
        envShape: 'bell',
        stochasticAmp: 0.50,
      })
    }
  }

  const channels = DEMO_CHANNELS.map(label => {
    const data = bgChannel(N, ['alpha'], 36, 0.18, label)
    const isFp       = hasRegion(label, 'frontopolar')
    const isFrontal  = hasRegion(label, 'frontal') && !isFp

    if (isFp || isFrontal) hot.push(label)

    addElectrodeFieldToChannel(data, label, electrodeArtifacts)
    return { label, data }
  })

  // Strobe onset / offset ticks
  const events = []
  for (let t = stimStart; t < stimEnd; t += flashPeriod) {
    events.push({ t, text: '⚡' })
  }
  // Keep the top bar readable: decimate
  const decimated = events.filter((_, i) => i % 4 === 0)
  decimated.push({ t: stimStart, text: 'stim on'  })
  decimated.push({ t: stimEnd,   text: 'stim off' })
  return buildResult(channels, decimated, hot)
}

// =============================================================================
// ARTIFACT CATALOGUE
// =============================================================================

export const ARTIFACT_CATALOGUE = [
  {
    id:         'eye_blink',
    label:      'Eye Blink',
    shortLabel: 'Blink',
    icon:       '😉',
    color:      '#66AAFF',
    frequency:  '< 1 Hz (transients)',
    amplitude:  '100–400 µV at Fp1/Fp2',
    morphology: 'Bilateral symmetric; fast rise (~60 ms), slower fall (~220 ms); positive at frontopolar channels',
    distribution: 'Maximal: Fp1, Fp2. Moderate: F3, F4, F7, F8. Absent: central, parietal, occipital',
    generator:  generateEyeBlinkArtifact,
    mechanism:  "The eye has a cornea-positive, retina-negative standing potential. Eye and eyelid movements alter its projection onto frontal electrodes and can produce large asymmetric blink transients.",
    identification: [
      'Bilateral, symmetric slow positive deflections at Fp1 and Fp2',
      'Amplitude maximum at frontopolar electrodes, rapidly diminishing posteriorly',
      'Asymmetric morphology: rise ~60 ms, fall ~200–300 ms (not a symmetric bump)',
      'Regular rate when awake (~15–20/min); absent when eyes closed',
      'On video-EEG: clearly correlates with eye closure',
    ],
    differentiation: 'Distinguished from epileptiform activity by: bilateral symmetry, frontopolar maximum, rounded morphology, and behavioural correlation. Can superficially resemble frontal slow waves but the abrupt onset and bilateral synchrony are distinctive.',
    reduction: [
      'Ask patient to keep eyes closed or fix gaze on a point',
      'EOG channel (vertical electrooculogram) can be used to monitor and subtract blinks',
      'Independent component analysis (ICA) in post-processing',
      'High-pass filter >1 Hz removes most of the deflection (but also removes slow cerebral activity)',
    ],
    clinicalNote: 'Blink rate is clinically informative: reduced in Parkinson\'s disease (<10/min), increased in anxiety. In coma, preserved blink responses to threat indicate intact brainstem.',
  },

  {
    id:         'lateral_eye',
    label:      'Lateral Eye Movement',
    shortLabel: 'Lat. Eye Mvmt',
    icon:       '👀',
    color:      '#88CCFF',
    frequency:  '< 2 Hz (saccades), or sustained',
    amplitude:  '100–300 µV',
    morphology: 'Saccadic step: fast rise (~20–30 ms) → plateau hold → slow exponential drift back. OPPOSITE polarity at Fp1 vs Fp2 — the hallmark.',
    distribution: 'Fp1 and Fp2 with OPPOSITE polarity; also Fp1–F7 and Fp2–F8 with opposite polarity',
    generator:  generateLateralEyeMovementArtifact,
    mechanism:  'The same corneoretinal dipole as the blink, but moving horizontally. When the eyes move left, the positive cornea faces Fp1 (positive deflection) while Fp2 sees the negative retina (negative deflection). This creates mirror-opposite frontopolar deflections — the opposite polarity is the hallmark.',
    identification: [
      'Opposite polarity at Fp1 vs Fp2 (and Fp1–F7 vs Fp2–F8)',
      'Step-and-plateau ("square wave") morphology, not a bell-shaped bump',
      'In-phase (same polarity) in eye blink — the critical distinction',
      'REM sleep shows characteristic repetitive lateral eye movements',
      'Square wave jerks: paired saccades separated by ~200 ms fixation',
    ],
    differentiation: 'The OPPOSITE POLARITY at Fp1 and Fp2 is the single most reliable distinguishing feature. Frontal interictal epileptiform discharges are typically NOT mirror-opposite at frontopolar electrodes.',
    reduction: [
      'Instruct patient to minimise lateral gaze shifts',
      'Horizontal EOG channel definitively confirms and quantifies',
      'ICA or regression-based EOG correction in post-processing',
    ],
    clinicalNote: 'REM sleep identification relies partly on recognising lateral eye movements on EEG. In polysomnography, the horizontal EOG channel is essential. Nystagmus produces characteristic repetitive slow/fast phase patterns visible on EEG.',
  },

  {
    id:         'roving_eye',
    label:      'Roving Eye Movement',
    shortLabel: 'Roving Eye',
    icon:       '🙄',
    color:      '#7DD3FC',
    frequency:  '0.05-0.5 Hz slow wandering ocular drift',
    amplitude:  '50-250 uV, usually frontal/frontopolar maximum',
    morphology: 'Broad, irregular, smooth slow waves from conjugate eye wandering; no sharp step, plateau, or fast corrective phase',
    distribution: 'Maximal frontopolar and lateral frontal chains; horizontal component shows opposite polarity between sides, vertical component is more symmetric at Fp1/Fp2',
    generator:  generateRovingEyeMovementArtifact,
    mechanism:  'Slow conjugate eye movements move the corneoretinal dipole gradually across the frontal electrodes. In drowsiness, encephalopathy, or coma, the eyes may drift from side to side or roll slowly, producing large low-frequency potentials that project most strongly to frontopolar and lateral frontal leads.',
    identification: [
      'Very slow, smooth, wandering deflections rather than isolated saccadic steps',
      'Frontopolar/lateral frontal maximum with changing left-right polarity as the eyes drift',
      'Often accompanies drowsiness, encephalopathy, or reduced alertness',
      'No evolving cerebral field, spike morphology, or organized ictal buildup',
      'Video or EOG shows slow conjugate eye wandering time-locked to the EEG deflection',
    ],
    differentiation: 'Can mimic frontal rhythmic delta, FIRDA, or slow seizure onset. Roving eye movement artifact is largest near the eyes, changes with gaze position, and may show mixed symmetric vertical plus mirror-opposite horizontal components; cerebral slow activity has a more physiologic scalp field and is not locked to visible eye drift.',
    reduction: [
      'Check video or add EOG channels to confirm eye movement',
      'Ask an awake patient to fixate or close eyes when appropriate',
      'Document reduced-alertness eye movements in the EEG report when clinically relevant',
      'Use EOG regression or ICA in offline processing if the slow drift obscures frontal EEG',
    ],
    clinicalNote: 'Roving eye movements are common in drowsiness and toxic-metabolic encephalopathy, and may be seen in coma with preserved brainstem ocular motor function. Recognising the artifact prevents mistaking ocular slow waves for frontal epileptiform or rhythmic delta activity.',
  },

  {
    id:         'nystagmus',
    label:      'Nystagmus Artifact',
    shortLabel: 'Nystagmus',
    icon:       '🌀',
    color:      '#5ED9D1',
    frequency:  '2-5 Hz repetitive ocular beats',
    amplitude:  '50-250 uV, maximal frontotemporal/frontopolar',
    morphology: 'Rhythmic sawtooth: slow ocular drift followed by a rapid corrective reset; mirror-opposite polarity over left vs right frontal chains',
    distribution: 'Maximal: Fp1-F7/F7-T7 and Fp2-F8/F8-T8, with opposite polarity between sides; smaller spread to F3/F4 and temporal leads',
    generator:  generateNystagmusArtifact,
    mechanism:  'Nystagmus repeatedly moves the corneoretinal dipole. In jerk nystagmus, the eyes drift slowly in one direction and then snap back with a fast corrective phase. Scalp electrodes detect this as a rhythmic ocular artifact, strongest near the eyes and lateral frontal electrodes.',
    identification: [
      'Regular repetitive ocular beats, commonly 2-5 Hz',
      'Sawtooth pattern: slow phase plus fast reset rather than isolated saccadic steps',
      'Opposite polarity between left and right frontopolar/frontotemporal chains',
      'Often changes with gaze direction and may lessen with fixation or eye closure depending on cause',
      'Horizontal EOG or video shows synchronous eye oscillation',
    ],
    differentiation: 'Can mimic frontal rhythmic delta, ictal rhythmic activity, or periodic discharges. Nystagmus artifact is frontopolar/frontotemporal maximum, mirror-opposite between sides, and time-locked to eye oscillation; cerebral rhythms usually have a physiologic field and are not systematically opposite in the two ocular channels.',
    reduction: [
      'Ask patient to fixate, close eyes, or look in primary gaze when clinically appropriate',
      'Record horizontal and vertical EOG channels for confirmation',
      'Document gaze-evoked or vestibular nystagmus rather than filtering it away blindly',
      'Use ICA or EOG regression in offline review when ocular artifact obscures EEG',
    ],
    clinicalNote: 'Nystagmus artifact may appear during vestibular disorders, medication toxicity, posterior fossa disease, or caloric/oculovestibular testing. Recognising the slow-fast ocular pattern prevents overcalling rhythmic frontal activity as seizure.',
  },

  {
    id:         'muscle',
    label:      'Muscle (EMG) Artifact',
    shortLabel: 'Muscle/EMG',
    icon:       '💪',
    color:      '#FF8C66',
    frequency:  '20–500 Hz (broadband high-frequency fuzz)',
    amplitude:  'Variable, 10–200+ µV',
    morphology: 'Stochastic motor-unit action potentials — non-sinusoidal, band-limited 30–120 Hz',
    distribution: 'Maximal at temporal chains (T7, T8, P7, P8) and frontal (F7, F8). Absent or minimal over central/occipital',
    generator:  generateMuscleArtifact,
    mechanism:  'Motor unit action potentials (MUAPs) from scalp and neck muscles are detected by overlying electrodes. Each MUAP is a brief (<5 ms) high-amplitude transient; many overlapping MUAPs create the characteristic "fuzzy" high-frequency appearance. The temporalis, frontalis, and occipitalis muscles are main sources.',
    identification: [
      'High-frequency irregular activity superimposed on the background',
      'Often partially obscures the underlying EEG',
      'Temporal and frontal chain predominance',
      'Increases with patient tension, talking, teeth clenching, or jaw movement',
      'Resolves immediately when the patient relaxes or is sedated',
      'On frequency analysis: broad power above 30 Hz',
    ],
    differentiation: 'Muscle artifact can obscure or mimic interictal epileptiform discharges. Key: genuine spikes have a field (seen in multiple channels); muscle artifact is often more localised and lacks a coherent topographic field. High-frequency muscle activity can mimic gamma band oscillations.',
    reduction: [
      'Ask patient to relax jaw, unclench teeth, and relax scalp',
      'Re-position head to reduce neck muscle tension',
      'Low-pass filter at 35–70 Hz (eliminates much EMG but also high-frequency brain signals)',
      'Lorazepam or small doses of benzodiazepines for refractory muscle artifact in ICU',
      'ICA is highly effective for separating EMG from EEG components',
    ],
    clinicalNote: 'In critically ill patients, subtle seizures can be masked by muscle artifact. Pharmacological paralysis (with NMB agents) is occasionally used in ICU to eliminate muscle artifact when seizure diagnosis is critical — but must be combined with continuous EEG monitoring.',
  },

  {
    id:         'chewing',
    label:      'Chewing Artifact',
    shortLabel: 'Chewing',
    icon:       '🦷',
    color:      '#FFAA44',
    frequency:  '1–2 Hz rhythmic bursts (chewing rate)',
    amplitude:  '200–500 µV at temporal chains',
    morphology: 'Rhythmic large-amplitude EMG bursts at ~1–2 Hz — each burst is a high-frequency MUAP volley',
    distribution: 'Masseter-predominant: T7, T8, P7, P8, F7, F8. Often asymmetric (stronger jaw-side). Minimal centrally.',
    generator:  generateChewingArtifact,
    mechanism:  'The masseter muscle, which is large and lies directly beneath the temporal scalp electrodes, generates enormous EMG potentials during jaw closure. Chewing creates rhythmic bursts at the chewing rate (typically 1–2 Hz), each burst representing a jaw-closing contraction.',
    identification: [
      'Rhythmic large-amplitude bursts at 1–2 Hz',
      'Each burst has a high-frequency (EMG) substructure',
      'Maximal at temporal electrodes, often asymmetric',
      'Rate matches observed chewing movements on video',
      'Abrupt onset and offset correlating with chewing cessation',
    ],
    differentiation: 'Can superficially resemble rhythmic temporal ictal activity or temporal intermittent rhythmic delta activity (TIRDA). Key: the individual bursts contain high-frequency EMG content (not seen in genuine cerebral rhythmic activity); direct observation or video confirms chewing.',
    reduction: [
      'Ask patient to stop eating/chewing during the recording',
      'Temporal chain channels are often uninterpretable during chewing',
      'Bite block or soft bite may reduce the artifact in patients with oral automatisms',
      'Note the artifact in the report rather than misinterpreting it as ictal activity',
    ],
    clinicalNote: 'Oral automatisms during temporal lobe seizures can produce chewing artifact superimposed on ictal EEG changes — making seizure characterisation difficult. Video-EEG is invaluable in this context to correlate the artifact with clinical behaviour.',
  },

  {
    id:         'shiver',
    label:      'Shiver Artifact',
    shortLabel: 'Shiver',
    icon:       '🥶',
    color:      '#7DD3C7',
    frequency:  '4-10 Hz rhythmic tremulous EMG bursts',
    amplitude:  '50-300+ µV, variable with tremor intensity',
    morphology: 'Rhythmic trains of brief EMG bursts; each burst contains irregular high-frequency motor-unit activity.',
    distribution: 'Maximal at temporal, frontal, and posterior neck-adjacent electrodes; often diffuse but muscle-predominant rather than cortical',
    generator:  generateShiverArtifact,
    mechanism:  'Shivering is involuntary rhythmic activation of skeletal muscles, commonly triggered by cold exposure, fever, anxiety, or post-anaesthetic recovery. Scalp, facial, jaw, and neck muscle motor-unit potentials are picked up by EEG electrodes, producing repetitive high-frequency bursts at the shiver rhythm.',
    identification: [
      'Rhythmic tremulous bursts, often around 4-10 Hz',
      'Each burst has EMG texture: spiky, irregular, high-frequency activity',
      'Temporal, frontal, and posterior muscle-adjacent channels are most affected',
      'Waxing and waning amplitude with visible body tremor or chills',
      'Improves with warming, relaxation, sedation, or treating fever/rigors',
    ],
    differentiation: 'Can mimic rhythmic ictal activity, alpha-like rhythms, or periodic discharges. Shiver artifact has high-frequency EMG texture within each burst, lacks a coherent cerebral field, and correlates with visible tremor or chills. Filter effect: low-pass filtering can smooth away the EMG texture and make the remaining rhythmic envelope look more cerebral; high-pass filtering may reduce slow movement drift but does not remove the shiver bursts themselves.',
    reduction: [
      'Warm the patient and reduce drafts or cold exposure',
      'Treat fever, rigors, pain, or anxiety when clinically appropriate',
      'Ask the patient to relax jaw, shoulders, and neck if awake',
      'Secure head and electrode leads to reduce movement coupling',
      'Use low-pass filtering cautiously; it attenuates the high-frequency EMG component but may leave a rhythmic slow envelope that still obscures the EEG',
      'A high-pass filter can reduce slow movement drift but will not remove the shiver bursts themselves',
    ],
    clinicalNote: 'Shivering is common in febrile, post-operative, and ICU patients. It can obscure subtle seizures or be mistaken for rhythmic cerebral activity, especially after filters alter its appearance. Always compare filtered and less-filtered views when the diagnosis depends on the EMG texture.',
  },

  {
    id:         'tremor',
    label:      'Tremor Artifact',
    shortLabel: 'Tremor',
    icon:       '🫨',
    color:      '#A3E635',
    frequency:  '4-6 Hz regular rhythmic movement with EMG texture',
    amplitude:  '30-180 uV, variable with tremor amplitude and electrode proximity',
    morphology: 'Regular tremor-frequency oscillation with small high-frequency EMG bursts riding on each cycle',
    distribution: 'Often asymmetric and maximal over the side of head/neck/limb movement; temporal, frontal, and central chains may be most affected.',
    generator:  generateTremorArtifact,
    mechanism:  'Patient tremor mechanically moves electrode leads and activates scalp, facial, neck, or limb muscles. The result is a regular rhythmic artifact at the tremor frequency with superimposed motor-unit texture, especially in electrodes near moving muscle or poorly secured leads.',
    identification: [
      'Stable rhythmic frequency, commonly around 4-6 Hz in parkinsonian or medication-related tremor',
      'Often asymmetric and maximal on the clinically tremulous side',
      'Each cycle may contain fine EMG texture rather than a smooth cerebral waveform',
      'Amplitude changes with posture, action, relaxation, medication state, or visible tremor',
      'Video or bedside observation shows timing locked to tremulous movement',
    ],
    differentiation: 'Can mimic rhythmic theta, ictal activity, or periodic discharges. Tremor artifact is movement-locked, often side-predominant, and has EMG texture; cerebral rhythmic activity should show a physiologic field, evolution, and behavior not strictly tied to visible tremor.',
    reduction: [
      'Support the limb or head to reduce transmitted movement',
      'Secure electrode leads and avoid cable loops that move with tremor',
      'Ask the patient to relax, change posture, or rest the tremulous limb if possible',
      'Use video correlation and mark tremor periods during acquisition',
      'Low-pass filtering may reduce EMG texture but can make the rhythmic envelope look more cerebral',
    ],
    clinicalNote: 'Tremor artifact is common in Parkinson disease, essential tremor, medication toxicity, anxiety, and ICU patients. Because the frequency can overlap theta or rhythmic ictal patterns, video correlation and attention to field distribution are essential.',
  },

  {
    id:         'powerline',
    label:      '50 Hz Powerline Artifact',
    shortLabel: 'Powerline',
    icon:       '⚡',
    color:      '#FFD166',
    frequency:  'Exactly 50 Hz in this demo',
    amplitude:  'Usually 15-70 uV diffusely; can reach 150+ uV in channels sharing a high-impedance electrode',
    morphology: 'Perfectly regular narrow-band sinusoidal oscillation at 50 Hz, with a faint 100 Hz harmonic',
    distribution: 'Maximal in channels sharing the high-impedance electrode, with lower-amplitude common-mode spread elsewhere.',
    generator:  generatePowerlineArtifact,
    mechanism:  'Electrical equipment, lighting, and power cables create electromagnetic fields at mains frequency. Poor electrode contact or high impedance reduces common-mode rejection, so one electrode can inject a strong local sinusoid into every bipolar channel that includes it.',
    identification: [
      'Perfectly regular, monomorphic sinusoidal activity at exactly 50 Hz',
      'In this simulation the marker labels the 50 Hz contamination and highlights the affected lead region',
      'Unchanged in amplitude or frequency by patient state, sleep, stimulation, or reactivity testing',
      'Frequency analysis shows a needle-like peak at exactly 50 Hz, sometimes with a 100 Hz harmonic',
      'Worsens when touching, moving, or leaving a high-impedance electrode poorly prepared',
    ],
    differentiation: 'Powerline artifact is continuous, perfectly sinusoidal, and locked to an exact electrical frequency. Genuine high-frequency cerebral activity is not a sustained monomorphic sine wave at exactly 50 Hz and should have physiologic spatial and temporal behavior.',
    reduction: [
      'Check electrode impedance: keep all electrodes below 5 kOhm, ideally below 2 kOhm',
      'Re-prep the scalp and re-apply conductive paste to the affected electrode',
      'Move electrode leads away from power cables, chargers, beds, and pumps',
      'Use shielding, grounded equipment, and battery power when available',
    ],
    clinicalNote: 'The most realistic clue is not amplitude alone but spectral purity: a stable 50 Hz line that stays exactly fixed while the EEG background changes. Fix impedance and cabling first; filtering can be explored with the viewer controls when you want to demonstrate its effect.',
  },

  {
    id:         'electrode_pop',
    label:      'Electrode Pop / Salt Bridge',
    shortLabel: 'Electrode Pop',
    icon:       '🔌',
    color:      '#FF6B6B',
    frequency:  'Transient (single events)',
    amplitude:  '200–1000+ µV',
    morphology: 'Abrupt step (~8 ms rise), brief plateau, then slow DC recovery over 0.5–1.5 s',
    distribution: 'STRICTLY LOCALISED to one or two channels containing the affected electrode. This is the single most important feature.',
    generator:  generateElectrodePopArtifact,
    mechanism:  'Electrode "pops" arise from sudden changes in electrode-skin interface resistance — movement of the electrode, drying of conductive gel, air bubbles under the electrode, or physical displacement. The resulting transient is an electrical artefact in the lead, not a cerebral signal. Salt bridges (conductive path between two adjacent electrodes from excess gel) cause correlated spurious activity in multiple channels.',
    identification: [
      'Confined to channels sharing the affected electrode only — does NOT spread',
      'Can be any polarity; abrupt step with flat plateau and slow DC tail',
      'Not followed by appropriate after-going slow wave (unlike a genuine spike)',
      'No physiologically plausible field — no "build-up" or propagation across channels',
      'Correlates with electrode movement, patient touching scalp, or impedance alarm',
      'The long DC recovery tail is a dead giveaway — cerebral transients return quickly',
    ],
    differentiation: 'The most dangerous mimicker of focal epileptiform discharges. A genuine spike has a FIELD — it appears in multiple adjacent channels with appropriate polarity and amplitude gradients. An electrode pop that is confined to a single channel is never a genuine cerebral potential.',
    reduction: [
      'Re-apply and secure the affected electrode with fresh conductive paste',
      'Ensure adequate skin preparation (light abrasion to reduce impedance)',
      'Use collodion-fixed cup electrodes for prolonged recordings',
      'Secure all leads to prevent mechanical movement',
      'Mark the artifact in real-time using the event button',
    ],
    clinicalNote: 'Electrode pops account for a significant proportion of false-positive epileptiform discharge reports in non-expert EEG reading. Always verify that an apparent focal discharge has a physiologically plausible field before calling it epileptiform.',
  },

  {
    id:         'ecg',
    label:      'ECG / Pulse Artifact',
    shortLabel: 'ECG/Pulse',
    icon:       '❤️',
    color:      '#FF4466',
    frequency:  '0.8–1.5 Hz (heart rate); perfectly regular',
    amplitude:  '20–180 µV depending on channel proximity to neck vessels',
    morphology: 'Phase-locked P-QRS-T complex plus a delayed rounded pulse wave; every channel shares the same cardiac timing',
    distribution: 'Maximal at temporal chains and ear references. Often generalised at lower amplitude. Can be asymmetric if one neck vessel is closer to an electrode.',
    generator:  generateECGArtifact,
    mechanism:  'Two mechanisms: (1) The cardiac electrical field, though small at the scalp, is detectable — particularly the R wave of the QRS complex. (2) Pulse waves: mechanical pulsation of scalp vessels physically moves the electrode with each heartbeat, creating a motion artifact at cardiac rate. Both produce regular, heart rate-dependent activity.',
    identification: [
      'Perfectly regular rate matching the heart rate (typically 60–100 bpm = 1–1.67 Hz)',
      'Biphasic morphology: low P -> narrow QRS spike -> broad T/pulse wave',
      'Rate increases with physical activity or anxiety; slows with vagal manoeuvres',
      'Compare to simultaneous ECG channel (most amplifiers include one)',
      'Temporal and ear-reference channels often most affected',
    ],
    differentiation: 'Periodic epileptiform discharges (PEDs) occur at regular rates but are not phase-locked to the ECG and show cortical field distributions. The cardiac artifact is definitively identified by simultaneous ECG recording showing exact time-locking.',
    reduction: [
      'Most EEG systems include a dedicated ECG channel — use it routinely',
      'Re-position ear reference electrodes away from the mastoid if pulse artifact is severe',
      'ICA effectively separates the cardiac component from EEG',
      'Notch filter at cardiac frequency is not practical; digital ICA/BSS is preferred',
    ],
    clinicalNote: 'Always record a simultaneous ECG channel. This allows definitive differentiation of cardiac artifacts from genuine periodic EEG patterns, and also detects cardiac arrhythmias that can cause syncope or seizure-like episodes.',
  },

  {
    id:         'sweat',
    label:      'Sweat / Movement (Baseline Drift)',
    shortLabel: 'Sweat Drift',
    icon:       '💧',
    color:      '#44BBFF',
    frequency:  '< 0.5 Hz',
    amplitude:  '50–500 µV (can be massive)',
    morphology: 'Polymorphic slow undulation — mixture of several slow components with incoherent phase across channels',
    distribution: 'Variable — can be diffuse or focal. Loose or poorly applied electrodes show the most drift. Often asymmetric across the scalp.',
    generator:  generateSweatArtifact,
    mechanism:  'Sweat changes the ionic composition of the electrode-skin interface, creating slow electrochemical potentials (half-cell potential changes). Physical movement shifts the electrode-skin contact geometry. Both produce very-low-frequency potential changes that appear as slow drift or undulation of the EEG baseline.',
    identification: [
      'Very slow (< 0.5 Hz) polymorphic undulation of the EEG baseline',
      'Different phase and shape in different channels (unlike cerebral slow waves)',
      'Increases with physical activity, fever, anxiety, or warm environments',
      'May completely obscure the underlying EEG with extreme drifts',
      'Resolved by cooling the patient, re-applying electrodes, or HP filtering',
    ],
    differentiation: 'Can mimic or obscure genuine cerebral slow activity (delta waves, FIRDA, TIRDA). Cerebral slow waves have a field (coherent phase relationships across channels) while sweat artifact is typically incoherent across channels. Diffuse cerebral delta is coherent bilaterally.',
    reduction: [
      'Cool the recording environment (avoid overheating)',
      'Apply a high-pass filter ≥0.5 Hz (removes sweat drift but also cerebral slow activity)',
      'Use silver-silver chloride (Ag/AgCl) electrodes which are more stable',
      'Minimise patient movement during recording',
      'Allow a longer settling time after electrode application',
    ],
    clinicalNote: 'Sweat artifact is a major problem in neonatal EEG recording (incubator environments) and in ICU recordings (fever, diaphoresis). High-pass filtering at 0.5 Hz is standard practice but must be used with awareness that it may attenuate genuine cerebral low-frequency activity.',
  },

  {
    id:         'glossokinetic',
    label:      'Glossokinetic Artifact',
    shortLabel: 'Glossokinetic',
    icon:       '👅',
    color:      '#CC88FF',
    frequency:  '1–4 Hz rhythmic (polymorphic)',
    amplitude:  '50–200 µV frontally',
    morphology: 'Rhythmic polymorphic low-frequency activity gated on/off with tongue movement; frontal maximum',
    distribution: 'Frontopolar maximum (Fp1, Fp2); moderate frontal (F3, F4, Fz); absent or minimal posteriorly',
    generator:  generateGlossokinetic,
    mechanism:  'The tongue acts as a biological battery — the tip is electrically negative (~70 mV) relative to the base. Rhythmic tongue movements (licking, counting, repeating words) create a moving dipole that is detected by frontal and prefrontal electrodes. The resulting low-frequency rhythmic frontal artifact can be mistaken for frontal lobe seizure activity or FIRDA.',
    identification: [
      'Rhythmic 1–4 Hz activity, strictly frontopolar/frontal distribution',
      'Correlates with observed tongue movement, lip licking, or speech',
      'Asking patient to press tongue to roof of mouth stops the artifact',
      'Video-EEG shows oral movement correlating exactly with deflections',
      'No posterior field extension (unlike frontal seizures which often propagate)',
    ],
    differentiation: 'Frontal intermittent rhythmic delta activity (FIRDA) is a genuine cerebral pattern that is diffuse and often more posteriorly distributed. Frontal seizures typically start focally and spread. The glossokinetic artifact is definitively identified by its cessation when tongue movement stops.',
    reduction: [
      'Ask the patient to rest tongue on the floor of the mouth',
      'Avoid recording while patient is eating, speaking, or performing oral tasks',
      'Include a notation in the report about tongue movement correlation',
    ],
    clinicalNote: 'Glossokinetic artifact is clinically important in patients with oral automatisms during seizures. Careful video correlation is essential. Asking the patient to count or repeat words is a provocation test that can reproduce the artifact for confirmation.',
  },

  {
    id:         'respiration',
    label:      'Respiration Artifact',
    shortLabel: 'Respiration',
    icon:       '🫁',
    color:      '#88DDAA',
    frequency:  '0.15-0.35 Hz (12-22 breaths/min)',
    amplitude:  '20-90 uV residual drift in affected bipolar channels; larger in referential recordings',
    morphology: 'Smooth, low-frequency baseline drift at the breathing rate, with mild inspiration-expiration asymmetry and occasional small lead-motion deflection',
    distribution: 'Often broad and partly common-mode; residual artifact is most visible where lead motion or reference shift is not fully cancelled, commonly central/parasagittal chains.',
    generator:  generateRespirationArtifact,
    mechanism:  'Thoracic movement during breathing can subtly move electrode leads and alter body/reference potentials. Much of this is common-mode and cancels in bipolar montage, leaving a low-amplitude residual slow drift that remains phase-locked to respiration.',
    identification: [
      'Markers label inspiration and expiration; the slow drift should keep the same timing relationship to them',
      'Regular rate matching observed breathing (~0.2-0.3 Hz)',
      'Smooth morphology without the sharp, stereotyped shape of ventilator artifact',
      'More regular than sweat drift; confirm with respiratory belt, airflow, or bedside observation',
      'Usually lower amplitude in bipolar montage because much of the respiratory signal is common-mode',
      'Can be mistaken for cerebral slow activity when it is persistent and frontocentral',
    ],
    differentiation: 'Respiration artifact is phase-locked to the marked breathing cycle and usually appears as smooth low-frequency drift. Cerebral slow activity (FIRDA, TIRDA, encephalopathic delta) has a physiologic field, may fluctuate independently of respiration, and should not stay consistently locked to inspiration/expiration markers.',
    reduction: [
      'Secure electrode leads so they do not move with chest excursions',
      'Compare with respiratory belt, airflow, ventilator waveform, or bedside observation',
      'Ask an awake patient to breathe quietly if clinically appropriate',
      'High-pass filtering can reduce the slow component, but may also attenuate genuine cerebral delta',
    ],
    clinicalNote: 'The markers in this simulation identify the respiratory cycle rather than implying every breath must create a large deflection. In polysomnography and ICU EEG, matching subtle EEG drift to respiratory belt, airflow, ventilator, or bedside observation prevents overcalling breathing-linked artifact as cerebral slow activity.',
  },

  {
    id:         'ventilator',
    label:      'Ventilator Artifact',
    shortLabel: 'Ventilator',
    icon:       '🏥',
    color:      '#99AACC',
    frequency:  '0.15–0.35 Hz (ventilator rate)',
    amplitude:  '30–150 µV',
    morphology: 'Stereotyped cycle: fast inspiratory rise → plateau → linear expiratory fall — repeated identically',
    distribution: 'Generalised and diffuse, with synchronous deflections across most channels. Amplitude and polarity may vary with the reference, montage, and which leads move.',
    generator:  generateVentilatorArtifact,
    mechanism:  'Mechanical ventilators physically inflate and deflate the thorax, creating rhythmic changes in: (1) electrode lead tension via body movement; (2) thoracic impedance affecting reference electrode potentials; (3) direct EMG activation of respiratory muscles. All produce stereotyped deflections exactly synchronous with the ventilator cycle.',
    identification: [
      'Regular rate matching the ventilator rate (check ventilator settings)',
      'Stereotyped and identical waveform in every cycle',
      'Synchronous morphology across most channels, with modest amplitude or polarity differences',
      'Disappears when ventilator is briefly disconnected (if safe to do so)',
      'Can be confirmed against ventilator waveform or bedside monitor',
    ],
    differentiation: 'Critical to distinguish from generalised periodic discharges (GPDs), which are one of the most important patterns in ICU EEG. GPDs can occur at similar rates. Ventilator artifact remains precisely time-locked to the respiratory cycle and is highly stereotyped; GPDs have a physiologic scalp field and may vary or evolve independently of ventilation.',
    reduction: [
      'Annotate ventilator rate in the EEG report header',
      'Briefly disconnect ventilator (only if clinically safe) to confirm artifact vs cerebral',
      'Secure all electrode leads to minimise lead movement with chest excursions',
      'Use a high-pass filter (0.5 Hz) to reduce low-frequency ventilator oscillations',
    ],
    clinicalNote: 'The ventilator artifact is one of the most diagnostically challenging artifacts in ICU EEG. Its regular periodic nature mimics GPDs, which are associated with acute brain injury and seizures. An incorrect diagnosis of GPDs in a ventilated patient can lead to unnecessary escalation of antiseizure medications. When in doubt, annotate the ventilator rate and compare directly.',
  },

  {
    id:         'photomyogenic',
    label:      'Photomyogenic Response',
    shortLabel: 'Photomyogenic',
    icon:       '💡',
    color:      '#FFEE88',
    frequency:  'Time-locked to photic stimulation rate',
    amplitude:  '30–150 µV at frontopolar channels',
    morphology: 'Brief high-frequency EMG bursts time-locked to each strobe flash (~50 ms latency)',
    distribution: 'Frontopolar (Fp1, Fp2) and frontal. No occipital component (unlike photoparoxysmal response).',
    generator:  generatePhotomyogenicArtifact,
    mechanism:  'The blink reflex and eyelid/facial muscle contraction triggered by bright light flashes creates EMG artifact that is time-locked to photic stimulation. This is a peripheral reflex response, not a cortical one. It appears shortly after the flash (roughly 40-70 ms latency) and is confined to periorbital and frontal muscles.',
    identification: [
      'Activity is strictly time-locked to photic stimulation flashes',
      'Confined to frontopolar and frontal chains — no posterior component',
      'Brief, high-frequency bursts (EMG morphology) at each flash',
      'Does not outlast the stimulation (immediate offset)',
      'Patient may not experience any symptoms during the discharge',
    ],
    differentiation: 'Distinguished from the photoparoxysmal response (PPR), which is a CEREBRAL response: PPR shows generalised spike-wave activity, appears in posterior channels first, may outlast the stimulation, and is associated with photosensitive epilepsy. Photomyogenic response is benign; PPR requires clinical evaluation for epilepsy.',
    reduction: [
      'Apply glasses or reduce ambient light to minimise blink reflex',
      'Ask patient to keep eyes open and fixate — reduces blink',
      'Reduces or disappears after a few trials (habituation)',
      'Note explicitly in the EEG report to avoid confusion with PPR',
    ],
    clinicalNote: 'The distinction between photomyogenic response (benign artifact) and photoparoxysmal response (potential epilepsy marker) is one of the most important interpretive challenges during photic stimulation. Misclassifying the photomyogenic response as a PPR can lead to an incorrect diagnosis of photosensitive epilepsy.',
  },
]
