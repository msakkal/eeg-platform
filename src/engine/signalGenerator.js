/**
 * EEG Signal Generation Engine
 *
 * Generates physiologically plausible EEG using:
 *  - Regional frequency content (occipital alpha, central mu, frontal beta,
 *    temporal theta) with posterior-dominant alpha gradients.
 *  - Berger effect: alpha is attenuated with eyes open and replaced by
 *    low-amplitude desynchronized beta.
 *  - Spontaneous eye blink artifacts with realistic frontopolar-maximum
 *    fields and gamma-distributed inter-blink intervals.
 *  - Sleep micro-architecture (vertex sharp waves, K-complexes, spindles).
 *  - Pink (1/f) background noise.
 *  - Transient event injection (spike, sharp wave, spike-and-wave, polyspike).
 *
 * References: American Academy of Neurological EEG primers; learningeeg.com
 * descriptions of normal awake / drowsy / sleep patterns.
 */

import {
  ELECTRODES_1020,
  regionOf,
  blinkField,
  lateralEogField,
  alphaGradient,
  muGradient,
  frontalBetaGradient,
  frontocentralGradient,
  bifrontalGradient,
  leftHemisphereGradient,
} from './electrodes.js'

// ??? Constants ???????????????????????????????????????????????????????????????

export const SAMPLE_RATE = 256          // Hz
export const WINDOW_SIZE = SAMPLE_RATE * 10  // 10-second window

export { ELECTRODES_1020 }

const nativeRandom = Math.random
let activeRandom = nativeRandom

function random() {
  return activeRandom()
}

function makeRng(seed) {
  let a = seed | 0
  return function rng() {
    a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ??? Rhythm Definitions ??????????????????????????????????????????????????????

export const RHYTHMS = {
  delta: { min: 0.5, max: 4,   label: 'Delta (?)', color: '#7B5EA7' },
  theta: { min: 4,   max: 8,   label: 'Theta (?)', color: '#00D4FF' },
  alpha: { min: 8,   max: 13,  label: 'Alpha (?)', color: '#00FFB0' },
  beta:  { min: 13,  max: 30,  label: 'Beta (?)',  color: '#FF6B35' },
  gamma: { min: 30,  max: 80,  label: 'Gamma (?)', color: '#FFD166' },
}

// ??? Noise ???????????????????????????????????????????????????????????????????

/** Box-Muller gaussian random number */
function gaussianRandom(mean = 0, std = 1) {
  const u = 1 - random()
  const v = random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Generate pink-ish noise (1/f approximation via summed octaves) */
function pinkNoise(length) {
  const white = Array.from({ length }, () => gaussianRandom(0, 1))
  const pink  = new Float32Array(length)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0
  for (let i = 0; i < length; i++) {
    const w = white[i]
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.96900 * b2 + w * 0.1538520
    b3 = 0.86650 * b3 + w * 0.3104856
    b4 = 0.55000 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.0168980
    pink[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.11
  }
  return pink
}

// ??? Core Generators ?????????????????????????????????????????????????????????

/**
 * Generate a background EEG rhythm as a sum of sine components.
 * @param {number} length   - number of samples
 * @param {number} fs       - sample rate (Hz)
 * @param {object} options  - { freqBands, amplitude, noiseLevel, seed }
 */
export function generateBackground(length, fs = SAMPLE_RATE, options = {}) {
  const {
    freqBands  = ['alpha'],
    amplitude  = 50,        // µV
    noiseLevel = 0.3,
    seed       = null,
  } = options
  const previousRandom = activeRandom
  if (seed != null) activeRandom = makeRng(seed)

  try {
  const signal = new Float32Array(length)
  const noise  = pinkNoise(length)

  freqBands.forEach(band => {
    const { min, max } = RHYTHMS[band] ?? RHYTHMS.alpha
    const nComponents = 4
    for (let c = 0; c < nComponents; c++) {
      const freq  = min + random() * (max - min)
      const phase = random() * 2 * Math.PI
      const amp   = amplitude * (0.5 + random() * 0.5) / nComponents
      for (let i = 0; i < length; i++) {
        signal[i] += amp * Math.sin(2 * Math.PI * freq * (i / fs) + phase)
      }
    }
  })

  for (let i = 0; i < length; i++) {
    signal[i] += noise[i] * amplitude * noiseLevel
  }

  return signal
  } finally {
    if (seed != null) activeRandom = previousRandom
  }
}

// ??? Modulated Rhythm Generator ??????????????????????????????????????????????

/**
 * Add a narrow-band rhythmic component with slow amplitude envelope
 * (waxing/waning) and gentle frequency drift — mimics the way biological
 * rhythms like alpha and mu modulate in vivo.
 *
 * The envelope is a rectified low-frequency carrier plus a noise floor, so
 * the rhythm waxes and wanes every 1–3 s rather than being steady.
 */
function addModulatedBand(signal, fs, {
  centerFreq,
  bandwidthHz = 1.5,
  amplitude   = 30,
  nComponents = 3,
  envFreqMin  = 0.1,      // Hz — carrier for waxing/waning
  envFreqMax  = 0.3,
  envFloor    = 0.25,     // minimum envelope (0..1) — never silences completely
  phase0,
}) {
  const length = signal.length
  const envFreq = envFreqMin + random() * (envFreqMax - envFreqMin)
  const envPhase = random() * 2 * Math.PI

  // Build a smooth amplitude envelope (0..1)
  const env = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const t = i / fs
    const c = 0.5 + 0.5 * Math.sin(2 * Math.PI * envFreq * t + envPhase)
    env[i]  = envFloor + (1 - envFloor) * c
  }

  for (let c = 0; c < nComponents; c++) {
    const freq  = centerFreq + (random() - 0.5) * bandwidthHz
    const phase = phase0 != null ? phase0 + c * 0.4 : random() * 2 * Math.PI
    const amp   = amplitude * (0.6 + random() * 0.4) / nComponents
    for (let i = 0; i < length; i++) {
      signal[i] += amp * env[i] * Math.sin(2 * Math.PI * freq * (i / fs) + phase)
    }
  }
}

/**
 * Add wideband pink-ish noise scaled to amplitude.
 */
function addPinkNoiseTo(signal, amplitude, noiseLevel) {
  const noise = pinkNoise(signal.length)
  for (let i = 0; i < signal.length; i++) signal[i] += noise[i] * amplitude * noiseLevel
}

// ??? Source-Based Rhythm Mixing ??????????????????????????????????????????????
// Real EEG is dominated by volume conduction: a single cortical generator
// projects onto every nearby electrode at varying amplitudes. Adjacent
// electrodes share most of their signal (correlation 0.7–0.9). The original
// per-channel `addModulatedBand` calls produced *independent* phase per
// channel, which made the simulation look like sprinkled noise rather than
// coherent brain activity. The helpers below build a unit-amplitude "source"
// once per pattern, then project it into each channel with a regional gain
// and a tiny phase jitter that mimics propagation latency.

/** Build a unit-amplitude source rhythm. Returns a Float32Array. */
function buildSourceRhythm(nSamples, fs, opts) {
  const buf = new Float32Array(nSamples)
  addModulatedBand(buf, fs, { ...opts, amplitude: 1 })
  return buf
}

/**
 * Mix a shared source buffer into a target channel.
 *  - `gain`: per-channel amplitude multiplier (already includes the gradient
 *    and the global amplitude).
 *  - `phaseJitterSamples`: max ± circular shift, in samples — preserves high
 *    coherence while producing tiny inter-channel time offsets, so the
 *    waveform isn't phase-locked exactly across all 19 sites.
 *  - `incoherenceFactor`: 0..1 — fraction of the channel's contribution that
 *    is added as new randomly-phased components instead of from the source.
 *    Real coherence is high but not 1.0; a small incoherent component
 *    prevents the simulation looking artificially synchronous.
 */
function mixSource(target, source, gain, phaseJitterSamples = 0, _fs = SAMPLE_RATE) {
  if (!gain) return
  const offset = phaseJitterSamples > 0
    ? Math.floor((random() * 2 - 1) * phaseJitterSamples)
    : 0
  const N = target.length
  for (let i = 0; i < N; i++) {
    let j = i + offset
    if (j < 0) j += N
    else if (j >= N) j -= N
    target[i] += source[j] * gain
  }
}

// ??? Ambient artefacts (always-on at low amplitude) ??????????????????????????

/**
 * Slow baseline drift — very-low-frequency wander (~0.05–0.3 Hz). Larger at
 * temporal/posterior leads where skin/sweat artifact and cable strain are
 * more pronounced clinically.
 */
function addBaselineDrift(signal, fs, label, amplitude) {
  const r = regionOf(label)
  const isPostOrTemp = r === 'midtemporal' || r === 'posttemporal' ||
                       r === 'parietal'    || r === 'occipital'
  const driftAmp = amplitude * (isPostOrTemp ? 0.15 : 0.07)
  if (driftAmp < 0.5) return
  const f1  = 0.05 + random() * 0.10
  const f2  = 0.15 + random() * 0.15
  const ph1 = random() * 2 * Math.PI
  const ph2 = random() * 2 * Math.PI
  for (let i = 0; i < signal.length; i++) {
    const t = i / fs
    signal[i] += driftAmp * (
      0.7 * Math.sin(2 * Math.PI * f1 * t + ph1) +
      0.4 * Math.sin(2 * Math.PI * f2 * t + ph2)
    )
  }
}

/**
 * Build a shared cardiac beat schedule for one recording. Each beat is a
 * timestamp (seconds) — the same schedule is then projected onto every
 * channel by `addCardiacPulse` so QRS complexes appear synchronously
 * across the head (the heart only beats once).
 */
function buildCardiacSchedule(durationSec, hr = 65) {
  const ibiMean = 60 / hr
  const beats = []
  let t = 0.2 + random() * 0.5
  while (t < durationSec - 0.1) {
    beats.push(t)
    t += ibiMean * (0.92 + random() * 0.16)            // ~10% HRV
  }
  return beats
}

/**
 * Cardiac pulse / ECG artifact — most prominent at ear references and
 * temporal/posterior leads near the carotid pulsation. Adds a low-amplitude
 * QRS-like spike + small T-wave shaped bump at the SHARED beat times so
 * every channel pulses synchronously.
 */
function addCardiacPulse(signal, fs, label, beatTimes) {
  const r = regionOf(label)
  // µV peak amplitudes per region. Ear references often show prominent QRS
  // contamination (20–40 µV is typical clinically); temporal/posterior
  // leads pick up smaller pulse-related artifact from scalp arteries.
  const ampMap = {
    ear:           22,
    posttemporal:  9,
    midtemporal:   8,
    parietal:      4.5,
    occipital:     4.5,
    central:       2,
    frontal:       1.5,
    frontopolar:   1,
  }
  const amp = ampMap[r] ?? 1
  if (amp < 1) return
  const lagS    = (r === 'occipital' || r === 'parietal') ? 0.04 : 0
  const widthN  = Math.max(2, Math.round(0.025 * fs))
  const tWidthN = Math.max(2, Math.round(0.07  * fs))
  beatTimes.forEach(t => {
    const center = Math.round((t + lagS) * fs)
    // QRS-like sharp deflection
    for (let i = -widthN; i <= widthN; i++) {
      const idx = center + i
      if (idx < 0 || idx >= signal.length) continue
      const x = i / widthN
      signal[idx] += amp * Math.exp(-x * x * 8) * (1 - 0.5 * x)
    }
    // Smaller T-wave bump
    const tCenter = center + Math.round(0.22 * fs)
    for (let i = -tWidthN; i <= tWidthN; i++) {
      const idx = tCenter + i
      if (idx < 0 || idx >= signal.length) continue
      const x = i / tWidthN
      signal[idx] += amp * 0.3 * Math.exp(-x * x * 2.5)
    }
  })
}

// ??? Transient Injectors ?????????????????????????????????????????????????????

/**
 * Inject a spike transient into a signal buffer.
 * @param {Float32Array} signal  - signal to modify in-place
 * @param {number} sampleIndex   - center of spike
 * @param {object} options       - { amplitude, duration, polarity }
 */
export function injectSpike(signal, sampleIndex, options = {}) {
  const {
    amplitude = 150,   // µV
    duration  = 0.06,  // seconds (< 70 ms = spike)
    polarity  = -1,    // -1 = negative (classic EEG spike)
    asymmetry = 0.3,   // rise:fall ratio
  } = options

  const halfW = Math.round((duration * SAMPLE_RATE) / 2)

  for (let i = sampleIndex - halfW; i <= sampleIndex + halfW; i++) {
    if (i < 0 || i >= signal.length) continue
    const t = (i - sampleIndex) / halfW          // normalised -1..1
    const env = t < 0
      ? Math.exp(-Math.pow(t / asymmetry, 2) * 4)
      : Math.exp(-Math.pow(t / (1 - asymmetry), 2) * 4)
    signal[i] += polarity * amplitude * env
  }
  return signal
}

/** Inject a sharp wave (70–200 ms). */
export function injectSharpWave(signal, sampleIndex, options = {}) {
  return injectSpike(signal, sampleIndex, {
    amplitude: 100,
    duration:  0.12,
    polarity:  -1,
    asymmetry: 0.4,
    ...options,
  })
}

function kComplexTransient(dt, amp = 250, {
  prePositiveScale = 0.10,
  negativeScale = 0.48,
  positiveScale = 1.00,
  terminalScale = 0.16,
} = {}) {
  let v = 0

  if (dt >= -0.070 && dt < 0.010) {
    const x = (dt + 0.070) / 0.080
    v += amp * prePositiveScale * Math.sin(Math.PI * x)
  }
  if (dt >= 0 && dt <= 0.105) {
    const x = dt / 0.105
    const sharp = x < 0.45 ? x / 0.45 : (1 - x) / 0.55
    v += -amp * negativeScale * Math.max(0, sharp)
  }
  if (dt >= 0.100 && dt <= 0.720) {
    const x = (dt - 0.100) / 0.620
    v += amp * positiveScale * Math.pow(Math.sin(Math.PI * x), 1.08)
  }
  if (dt >= 0.660 && dt <= 0.980) {
    const x = (dt - 0.660) / 0.320
    v += -amp * terminalScale * Math.sin(Math.PI * x)
  }

  return v
}

export function injectKComplex(signal, sampleIndex, fs = SAMPLE_RATE, {
  amp = 250,
  ...morphology
} = {}) {
  const start = Math.round(-0.08 * fs)
  const end = Math.round(1.02 * fs)

  for (let i = start; i <= end; i++) {
    const idx = sampleIndex + i
    if (idx < 0 || idx >= signal.length) continue
    signal[idx] += kComplexTransient(i / fs, amp, morphology)
  }
}

/** Inject spike-and-wave complex (spike followed by slow wave). */
export function injectSpikeAndWave(signal, sampleIndex, options = {}) {
  const { frequency = 3 } = options
  injectSpike(signal, sampleIndex, { amplitude: 200, duration: 0.04, polarity: -1 })
  const swStart    = sampleIndex + Math.round(SAMPLE_RATE * 0.06)
  const swDuration = Math.round(SAMPLE_RATE * 0.25)
  for (let i = 0; i < swDuration; i++) {
    const idx = swStart + i
    if (idx >= signal.length) break
    signal[idx] += 80 * Math.sin(Math.PI * i / swDuration)
  }
  return signal
}

/** Inject polyspike burst. */
export function injectPolyspike(signal, sampleIndex, options = {}) {
  const { count = 4, spacing = 0.025 } = options
  for (let k = 0; k < count; k++) {
    const idx = sampleIndex + Math.round(k * spacing * SAMPLE_RATE)
    injectSpike(signal, idx, {
      amplitude: 120 - k * 15,
      duration:  0.03,
      polarity:  k % 2 === 0 ? -1 : 1,
    })
  }
  return signal
}

/**
 * Inject a triphasic wave (classic metabolic / hepatic encephalopathy pattern).
 * Three blunt phases: small positive ? large negative ? slower positive.
 * Duration ~350 ms total, no needle-like spike component.
 */
export function injectTriphasicWave(signal, sampleIndex, options = {}) {
  const {
    amplitude = 120,
    duration  = 0.35,
  } = options
  const total = Math.round(duration * SAMPLE_RATE)
  if (total < 3) return signal
  const p1End = Math.round(total * 0.18)   // phase 1: brief small positive
  const p2End = Math.round(total * 0.55)   // phase 2: dominant blunt negative
  // phase 3 fills the rest: broad positive afterwave

  for (let i = 0; i < total; i++) {
    const idx = sampleIndex + i
    if (idx < 0 || idx >= signal.length) continue
    let v
    if (i < p1End) {
      v = +0.35 * amplitude * Math.sin(Math.PI * i / p1End)
    } else if (i < p2End) {
      const t = (i - p1End) / (p2End - p1End)
      v = -1.00 * amplitude * Math.sin(Math.PI * t)
    } else {
      const t = (i - p2End) / (total - p2End)
      v = +0.72 * amplitude * Math.sin(Math.PI * t)
    }
    signal[idx] += v
  }
  return signal
}

/** Inject muscle artifact (high-frequency burst). */
export function injectMuscleArtifact(signal, sampleIndex, options = {}) {
  const { duration = 0.5, amplitude = 80 } = options
  const len = Math.round(duration * SAMPLE_RATE)
  for (let i = 0; i < len; i++) {
    const idx = sampleIndex + i
    if (idx >= signal.length) break
    const env = Math.sin(Math.PI * i / len)
    signal[idx] += gaussianRandom(0, amplitude * env)
  }
  return signal
}

/**
 * Inject an eye blink with realistic morphology.
 *
 * A blink produces a positive deflection at frontopolar channels because
 * closing the eyelid briefly brings the positive cornea closer to the
 * Fp electrodes. The waveform rises quickly (~50–80 ms) and decays more
 * slowly (~200–300 ms) — a skewed bell shape, NOT a symmetric sine.
 *
 * @param {Float32Array} signal
 * @param {number} sampleIndex - sample at which blink onset begins
 * @param {object} options
 *   - amplitude: peak µV at this channel (caller scales by field factor)
 *   - riseMs: ms from onset to peak (default 70)
 *   - fallMs: ms from peak back to baseline (default 220)
 *   - polarity: +1 (Fp positive, standard) or ?1
 */
export function injectEyeBlink(signal, sampleIndex, options = {}) {
  const {
    amplitude = 200,
    riseMs    = 70,
    fallMs    = 220,
    polarity  = +1,
  } = options

  const riseN = Math.round((riseMs / 1000) * SAMPLE_RATE)
  const fallN = Math.round((fallMs / 1000) * SAMPLE_RATE)
  const total = riseN + fallN

  for (let i = 0; i < total; i++) {
    const idx = sampleIndex + i
    if (idx < 0 || idx >= signal.length) continue
    let v
    if (i < riseN) {
      // Smooth rise (half sine)
      v = Math.sin((Math.PI / 2) * (i / riseN))
    } else {
      // Exponential-ish decay
      const k = (i - riseN) / fallN
      v = Math.cos((Math.PI / 2) * k) * Math.exp(-1.1 * k)
    }
    signal[idx] += polarity * amplitude * v
  }
  return signal
}

/**
 * Inject a lateral (horizontal) eye-movement artefact. Saccades produce a
 * step-and-hold deflection at frontotemporal electrodes: F7 and F8 form a
 * dipole pair (anti-phase), with smaller contributions at Fp1/Fp2, T7/T8
 * and F3/F4. Caller supplies `polarity * field(label)` as the amplitude.
 */
export function injectLateralEyeMovement(signal, sampleIndex, options = {}) {
  const {
    amplitude  = 80,
    durationMs = 350,
  } = options
  const N = Math.round((durationMs / 1000) * SAMPLE_RATE)
  if (N < 4) return signal
  for (let i = 0; i < N; i++) {
    const idx = sampleIndex + i
    if (idx < 0 || idx >= signal.length) continue
    const x = i / N
    // step-and-hold morphology: ~70 ms ramp up, plateau, slower return
    let v
    if (x < 0.2)      v = x / 0.2
    else if (x < 0.7) v = 1
    else              v = (1 - x) / 0.3
    signal[idx] += amplitude * v
  }
  return signal
}

/**
 * Field factor for a lateral (horizontal) eye movement at a given electrode.
 * `direction` is +1 (rightward gaze: F8 positive) or -1 (leftward: F7 positive).
 * Re-exported from electrodes.js for backward compatibility.
 */
export { lateralEogField } from './electrodes.js'

/**
 * Generate a train of saccade events (seconds) with random direction. Real
 * awake subjects make 1–3 saccades per second when scanning visually; we
 * default to a more conservative 25/min (sustained gaze with periodic
 * shifts) to keep the trace readable.
 */
export function generateSaccadeTimes(durationSec, ratePerMin = 25) {
  if (ratePerMin <= 0) return []
  const meanIbi = 60 / ratePerMin
  const events = []
  let t = 0.5 + random() * meanIbi
  while (t < durationSec - 0.5) {
    events.push({ t, direction: random() > 0.5 ? +1 : -1 })
    const u   = Math.max(1e-6, random())
    const ibi = -meanIbi * Math.log(u)            // exponential
    t += Math.max(0.4, ibi)
  }
  return events
}

/**
 * Generate a train of spontaneous blink times (seconds) over a duration.
 * Inter-blink intervals are gamma-distributed so bursts and pauses look
 * natural (not perfectly periodic).
 *
 * @param {number} durationSec
 * @param {number} ratePerMin  - mean blink rate (default 18/min)
 */
export function generateBlinkTimes(durationSec, ratePerMin = 18) {
  if (ratePerMin <= 0) return []
  const meanIbi = 60 / ratePerMin           // seconds
  const times = []
  let t = 0.3 + random() * meanIbi     // first blink offset
  while (t < durationSec - 0.2) {
    times.push(t)
    // Gamma(k=2, theta=meanIbi/2) approximation = sum of two exponentials
    const u1 = Math.max(1e-6, random())
    const u2 = Math.max(1e-6, random())
    const ibi = -(meanIbi / 2) * (Math.log(u1) + Math.log(u2))
    t += Math.max(0.25, ibi)                // minimum plausible inter-blink
  }
  return times
}

// ??? Multi-Channel EEG Generator ?????????????????????????????????????????????

// Electrode definitions and gradient functions are now in electrodes.js.
// Unique-to-this-file gradients below:

/** Left anterior-temporal field — for TLE interictal sharps. */
function leftTemporalSpikeGradient(label) {
  switch (label) {
    case 'F7': case 'T7':             return 1.00
    case 'P7':                        return 0.55
    case 'Fp1':                       return 0.55
    case 'F3':                        return 0.42
    case 'C3':                        return 0.30
    case 'P3':                        return 0.18
    default: return 0
  }
}

/** Focal breach — left-central max over a skull defect. */
function breachGradient(label) {
  switch (label) {
    case 'C3':                        return 1.00
    case 'T7':                        return 0.65
    case 'F3':                        return 0.55
    case 'P3':                        return 0.55
    case 'Cz':                        return 0.32
    default: return 0
  }
}

/** Frontal-maximum alpha (inverted gradient) — for alpha coma. */
function alphaComaFieldGradient(label) {
  switch (regionOf(label)) {
    case 'frontopolar':  return 1.00
    case 'frontal':      return 0.95
    case 'central':      return 0.72
    case 'midtemporal':  return 0.55
    case 'parietal':     return 0.40
    case 'posttemporal': return 0.30
    case 'occipital':    return 0.25
    case 'ear':          return 0.05
    default:             return 0.10
  }
}

/**
 * Generate a full multi-channel EEG dataset.
 * Returns an object: { channels: { [label]: Float32Array }, sampleRate, duration }
 *
 * @param {object} options
 *   - duration, sampleRate, amplitude, noiseLevel, seed
 *   - pattern: one of the sandbox pattern ids in patterns.js
 *   - eyesClosed: boolean (applies to 'normal_awake')
 *   - blinksEnabled: boolean (default true when eyes open)
 *   - blinkRate: blinks per minute (default 18)
 */
export function generateMultiChannelEEG(options = {}) {
  const {
    duration      = 10,
    sampleRate    = SAMPLE_RATE,
    pattern       = 'normal_awake',
    noiseLevel    = 0.25,
    amplitude     = 50,
    eyesClosed    = true,
    blinksEnabled = true,
    blinkRate     = 18,
    seed          = null,
  } = options
  const previousRandom = activeRandom
  activeRandom = seed == null ? nativeRandom : makeRng(seed)

  try {
  const nSamples = Math.round(duration * sampleRate)
  const channels = {}

  // ?? Shared cortical-source rhythms ??????????????????????????????????????
  // Build each major rhythm ONCE per pattern as a unit-amplitude source. The
  // per-channel functions then mix the source in scaled by its regional
  // gradient with a small phase jitter, producing realistic inter-channel
  // coherence while still allowing local variability via per-channel pink
  // noise and small incoherent components.
  const awakeSources = {
    alpha: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  10,
      bandwidthHz: 1.4,
      nComponents: 3,
      envFreqMin:  0.12,
      envFreqMax:  0.28,
      envFloor:    eyesClosed ? 0.45 : 0.30,
    }),
    mu: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  10.5,
      bandwidthHz: 1.0,
      nComponents: 2,
      envFreqMin:  0.05,
      envFreqMax:  0.15,
      envFloor:    0.3,
    }),
    muHarmonic: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  21,
      bandwidthHz: 1.0,
      nComponents: 1,
      envFloor:    0.3,
    }),
    beta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  20,
      bandwidthHz: 6,
      nComponents: 3,
      envFreqMin:  0.2,
      envFreqMax:  0.6,
      envFloor:    0.4,
    }),
    tempTheta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  6,
      bandwidthHz: 2,
      nComponents: 2,
      envFreqMin:  0.08,
      envFreqMax:  0.2,
      envFloor:    0.2,
    }),
  }

  // Emit a realistic awake background for one channel, taking the electrode
  // label and eye state into account.
  function awakeChannel(label) {
    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude, noiseLevel * 0.6)

    // Alpha (posterior dominant rhythm) — strongly gated by eye state.
    // Source projects with a tiny per-channel phase offset (~10 ms) so the
    // PDR is highly coherent across O1/O2/P3/P4 but not phase-identical.
    const alphaGain = alphaGradient(label) * amplitude * (eyesClosed ? 1.2 : 0.12)
    mixSource(sig, awakeSources.alpha, alphaGain, /* jitter */ 3)

    // Mu rhythm (central 8–12 Hz, arched) — present regardless of eye state.
    const muGain = muGradient(label) * amplitude * 0.25
    if (muGain > 0.5) {
      mixSource(sig, awakeSources.mu, muGain, 2)
      // Very mild arched harmonic at 21 Hz hinting at mu morphology
      mixSource(sig, awakeSources.muHarmonic, muGain * 0.3, 2)
    }

    // Low-amplitude frontal/diffuse beta — prominent when eyes open
    // (desynchronised, "alert" cortex).
    const betaGain = frontalBetaGradient(label) * amplitude *
      (eyesClosed ? 0.12 : 0.22)
    mixSource(sig, awakeSources.beta, betaGain, 4)

    // Temporal theta — more in mid/post-temporal channels (small in adults).
    if (regionOf(label) === 'midtemporal' || regionOf(label) === 'posttemporal') {
      mixSource(sig, awakeSources.tempTheta, amplitude * 0.15, 3)
    }

    return sig
  }

  // Drowsy / N1: attenuated background with diffuse theta, slow horizontal
  // roving eye movements, and no sustained posterior dominant rhythm.
  // Shared sources for the drowsy state — same source-projection idea as
  // awake, so theta is coherent across frontocentral channels.
  const drowsySources = {
    alpha: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  8.2,
      bandwidthHz: 2.0,
      nComponents: 2,
      envFreqMin:  0.15,
      envFreqMax:  0.3,
      envFloor:    0.02,
    }),
    theta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  5.5,
      bandwidthHz: 2,
      nComponents: 3,
      envFreqMin:  0.1,
      envFreqMax:  0.25,
      envFloor:    0.4,
    }),
  }
  const drowsyRovingEye = {
    freq: 0.20 + random() * 0.08,
    phase: random() * 2 * Math.PI,
    amp: amplitude * (1.05 + random() * 0.25),
    envFreq: 0.025 + random() * 0.035,
    envPhase: random() * 2 * Math.PI,
  }

  function drowsyChannel(label) {
    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude * 0.72, noiseLevel * 0.65)

    // Trace residual alpha only; N1 should not retain an awake PDR.
    const alphaGain = alphaGradient(label) * amplitude * 0.10
    mixSource(sig, drowsySources.alpha, alphaGain, 3)

    // Diffuse theta — slightly amplified frontocentrally
    const thetaGain = amplitude * 0.40 *
      (regionOf(label) === 'central' || regionOf(label) === 'frontal' ? 1.1 : 0.85)
    mixSource(sig, drowsySources.theta, thetaGain, 4)

    const eog = lateralEogField(label, 1)
    if (Math.abs(eog) >= 0.04) {
      for (let i = 0; i < nSamples; i++) {
        const t = i / sampleRate
        const env = 0.65 + 0.35 * Math.sin(2 * Math.PI * drowsyRovingEye.envFreq * t + drowsyRovingEye.envPhase)
        const slow =
          Math.sin(2 * Math.PI * drowsyRovingEye.freq * t + drowsyRovingEye.phase) +
          0.18 * Math.sin(2 * Math.PI * drowsyRovingEye.freq * 2 * t + drowsyRovingEye.phase * 0.7)
        sig[i] += eog * drowsyRovingEye.amp * env * slow
      }
    }
    return sig
  }

  // Light NREM-ish sleep: delta-theta background + vertex sharps + sleep
  // spindles at Cz/Fz + occasional K-complexes.
  // Shared delta/theta sources so frontocentral slowing is bilaterally
  // coherent. Vertex sharps and K-complexes are also pre-scheduled here so
  // they appear synchronously across Cz/C3/C4/Fz as in real recordings,
  // rather than at independent times per channel.
  const sleepSources = {
    delta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  1.5,
      bandwidthHz: 1.8,
      nComponents: 3,
      envFreqMin:  0.05,
      envFreqMax:  0.15,
      envFloor:    0.6,
    }),
    theta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  4.5,
      bandwidthHz: 2,
      nComponents: 2,
      envFloor:    0.4,
    }),
  }

  // Pre-scheduled vertex sharps (1 per ~5 s) — same time across vertex sites
  const vertexTimes = []
  {
    const n = Math.max(1, Math.round(duration / 5))
    for (let k = 0; k < n; k++) {
      vertexTimes.push(0.8 + random() * (duration - 1.6))
    }
  }
  // Pre-scheduled K-complexes (1 per ~8 s) — high-voltage frontocentral
  // complexes that are optionally followed by a spindle.
  const kComplexEvents = []
  {
    const n = Math.max(1, Math.round(duration / 8))
    const minT = 1.1
    const maxT = Math.max(minT + 0.35, duration - 1.2)
    for (let k = 0; k < n; k++) {
      kComplexEvents.push({
        t: minT + random() * (maxT - minT),
        ampJ: 0.86 + random() * 0.30,
      })
    }
  }
  // Pre-scheduled spindles — synchronous across centroparietal cortex
  const spindleSchedule = []
  {
    const n = Math.round(duration / 4)
    for (let k = 0; k < n; k++) {
      spindleSchedule.push({
        t:    1 + random() * (duration - 2),
        dur:  0.6 + random() * 0.8,
        freq: 12.5 + random() * 1.5,
        ph:   random() * 2 * Math.PI,
      })
    }
    kComplexEvents.forEach(({ t }) => {
      if (t + 0.80 >= duration || random() > 0.65) return
      spindleSchedule.push({
        t:    t + 0.58 + random() * 0.20,
        dur:  0.55 + random() * 0.60,
        freq: 12.4 + random() * 1.4,
        ph:   random() * 2 * Math.PI,
      })
    })
  }

  function kComplexSleepField(label) {
    const map = {
      Fz: 1.00, Cz: 0.92,
      F3: 0.78, F4: 0.78,
      Fp1: 0.62, Fp2: 0.62,
      C3: 0.58, C4: 0.58,
      F7: 0.34, F8: 0.34,
      Pz: 0.38, P3: 0.24, P4: 0.24,
      T7: 0.18, T8: 0.18,
    }
    return map[label] ?? 0
  }

  function kComplexLagSec(label) {
    switch (regionOf(label)) {
      case 'frontopolar': return -0.010
      case 'frontal': return 0
      case 'central': return 0.018
      case 'midtemporal': return 0.026
      case 'parietal': return 0.038
      default: return 0.020
    }
  }

  function sleepChannel(label) {
    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude, noiseLevel * 0.9)

    // Delta background, larger frontally/centrally
    const isFrontalOrCentral = regionOf(label) === 'frontal' ||
                               regionOf(label) === 'frontopolar' ||
                               regionOf(label) === 'central'
    mixSource(sig, sleepSources.delta, amplitude * (isFrontalOrCentral ? 1.7 : 1.0), 4)
    mixSource(sig, sleepSources.theta, amplitude * 0.5, 4)

    // Sleep spindles — same schedule across all relevant channels, scaled by
    // regional amplitude. Cz/Fz dominant, C3/C4 next, F3/F4 lower, mild
    // elsewhere (so spindles can faintly show on parietal channels too).
    const spindleAmp = (label === 'Cz' || label === 'Fz') ? amplitude * 0.9
                    : (label === 'C3' || label === 'C4') ? amplitude * 0.75
                    : (label === 'F3' || label === 'F4') ? amplitude * 0.45
                    : (label === 'Pz' || label === 'P3' || label === 'P4') ? amplitude * 0.25
                    : amplitude * 0.10
    if (spindleAmp > 1) {
      spindleSchedule.forEach(({ t, dur, freq, ph }) => {
        const start = Math.round(t * sampleRate)
        const spDur = Math.round(dur * sampleRate)
        for (let i = 0; i < spDur; i++) {
          const idx = start + i
          if (idx >= nSamples) break
          const env = Math.sin(Math.PI * i / spDur)
          sig[idx] += spindleAmp * env *
            Math.sin(2 * Math.PI * freq * i / sampleRate + ph)
        }
      })
    }

    // Vertex sharp waves — sporadic negative sharp transient at Cz/C3/C4/Fz
    if (label === 'Cz' || label === 'C3' || label === 'C4' || label === 'Fz') {
      const vertexAmp = label === 'Cz' ? 110 : 75
      vertexTimes.forEach(t => {
        injectSharpWave(sig, Math.round(t * sampleRate),
          { amplitude: vertexAmp, duration: 0.12, polarity: -1 })
      })
    }

    // K-complexes — high-voltage biphasic complexes, maximal Fz/Cz with
    // symmetric parasagittal spread and a mild anterior-to-posterior lag.
    const kField = kComplexSleepField(label)
    if (kField > 0.05) {
      const lag = kComplexLagSec(label)
      kComplexEvents.forEach(({ t, ampJ }) => {
        injectKComplex(sig, Math.round((t + lag) * sampleRate), sampleRate, {
          amp: 255 * kField * ampJ,
        })
      })
    }

    return sig
  }

  // Focal slowing: polymorphic delta/theta concentrated over one region
  // (here: left temporal T7/P7/F7), with normal-looking background elsewhere.
  // The slowing arises from a single underlying focal generator, so T7/P7/F7
  // should track each other strongly. Build the slowing as shared sources
  // and project them with a regional gain instead of generating fresh
  // independent rhythms per channel.
  const focalSources = {
    delta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  2,
      bandwidthHz: 2,
      nComponents: 4,
      envFreqMin:  0.15,
      envFreqMax:  0.4,
      envFloor:    0.3,
    }),
    theta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  6,
      bandwidthHz: 2,
      nComponents: 3,
      envFloor:    0.4,
    }),
    slowAlpha: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  9,
      bandwidthHz: 1.5,
      nComponents: 2,
      envFloor:    0.2,
    }),
  }
  // Field weights for the focus — peak at T7 (anatomic centre of the cluster),
  // dropping off toward P7 and F7. Outside the cluster, weight is 0.
  function focalLeftField(label) {
    switch (label) {
      case 'T7': return 1.00
      case 'P7': return 0.78
      case 'F7': return 0.72
      default:   return 0
    }
  }

  function focalSlowingChannel(label) {
    const f = focalLeftField(label)
    if (f === 0) return awakeChannel(label)

    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude, noiseLevel * 0.9)
    mixSource(sig, focalSources.delta,     amplitude * 2.2 * f, 3)
    mixSource(sig, focalSources.theta,     amplitude * 1.3 * f, 3)
    mixSource(sig, focalSources.slowAlpha, alphaGradient(label) * amplitude * 0.25, 2)
    return sig
  }

  // Burst-suppression: periods of near-flat suppression alternating with
  // mixed-frequency bursts. PRE-COMPUTE the schedule once — bursts must be
  // bilaterally synchronous (this was previously broken: each channel had
  // its own independent burst schedule).
  const burstSchedule = []
  {
    let t = 0.2
    while (t < duration - 0.5) {
      const burstDur = 0.5 + random() * 1.2
      // Build the burst waveform once; channels project it with mild
      // regional variation (small amplitude jitter) so they aren't perfectly
      // identical, but timing and morphology stay locked.
      const len = Math.round(burstDur * sampleRate)
      const burst = new Float32Array(len)
      addPinkNoiseTo(burst, amplitude * 1.6, 0.6)
      addModulatedBand(burst, sampleRate, {
        centerFreq: 6, bandwidthHz: 3, amplitude: amplitude * 1.8,
        nComponents: 2, envFloor: 0.7,
      })
      addModulatedBand(burst, sampleRate, {
        centerFreq: 14, bandwidthHz: 4, amplitude: amplitude * 0.9,
        nComponents: 2, envFloor: 0.5,
      })
      // Apply rise/fall envelope to soften onset and offset
      for (let i = 0; i < len; i++) {
        const env = i < len * 0.08 ? i / (len * 0.08)
                  : i > len * 0.9  ? (len - i) / (len * 0.1)
                  : 1
        burst[i] *= env
      }
      burstSchedule.push({
        start: Math.round(t * sampleRate),
        len,
        burst,
      })
      t += burstDur + 2 + random() * 2
    }
  }

  function burstSuppressionChannel(label) {
    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude * 0.15, noiseLevel)     // suppression floor
    const ampJitter = 0.92 + random() * 0.16        // ±8% per channel
    burstSchedule.forEach(({ start, len, burst }) => {
      for (let i = 0; i < len; i++) {
        const idx = start + i
        if (idx >= nSamples) break
        sig[idx] += burst[i] * ampJitter
      }
    })
    return sig
  }

  // Slow-wave sleep (N3): very high amplitude diffuse delta, fewer spindles.
  // Shared delta sources so the high-amplitude slow waves are bilaterally
  // synchronous (a defining feature of N3) rather than independently random.
  const n3Sources = {
    delta1: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  1.2,
      bandwidthHz: 1.0,
      nComponents: 3,
      envFreqMin:  0.03,
      envFreqMax:  0.10,
      envFloor:    0.75,
    }),
    delta2: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  2.5,
      bandwidthHz: 1.5,
      nComponents: 2,
      envFloor:    0.55,
    }),
  }

  function deltaSleepChannel(label) {
    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude, noiseLevel)
    const frontalCentral = regionOf(label) === 'frontal' ||
                           regionOf(label) === 'frontopolar' ||
                           regionOf(label) === 'central'
    mixSource(sig, n3Sources.delta1, amplitude * (frontalCentral ? 2.8 : 1.6), 5)
    mixSource(sig, n3Sources.delta2, amplitude * 0.8, 5)
    return sig
  }

  // Diffuse slowing / encephalopathy background — diffuse theta + delta with
  // residual A-P gradient on attenuated slow alpha. Diffuse slowing is by
  // definition bilaterally synchronous, so source projection matters here.
  const encephSources = {
    theta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  5,
      bandwidthHz: 2.2,
      nComponents: 3,
      envFloor:    0.55,
    }),
    delta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  2,
      bandwidthHz: 1.5,
      nComponents: 2,
      envFloor:    0.5,
    }),
    slowAlpha: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  7.5,
      bandwidthHz: 1.2,
      nComponents: 2,
      envFloor:    0.3,
    }),
  }

  function encephalopathyChannel(label) {
    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude, noiseLevel * 0.7)
    // Diffuse theta dominant
    mixSource(sig, encephSources.theta, amplitude * 1.05, 4)
    // Delta overlay — slightly more anteriorly
    const anterior = regionOf(label) === 'frontal' || regionOf(label) === 'frontopolar'
    mixSource(sig, encephSources.delta, amplitude * (anterior ? 0.9 : 0.55), 4)
    // Residual attenuated, slowed alpha preserving an A-P gradient
    const slowAlphaGain = alphaGradient(label) * amplitude * 0.30
    mixSource(sig, encephSources.slowAlpha, slowAlphaGain, 3)
    return sig
  }

  // Alpha coma: diffuse non-reactive alpha with FRONTAL max (inverted field).
  // Single shared alpha source — alpha coma is famously *monotonous* and
  // synchronous across the head.
  const alphaComaSource = buildSourceRhythm(nSamples, sampleRate, {
    centerFreq:  10,
    bandwidthHz: 0.7,
    nComponents: 2,
    envFreqMin:  0.03,
    envFreqMax:  0.08,
    envFloor:    0.9,
  })

  function alphaComaChannel(label) {
    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude * 0.35, noiseLevel * 0.5)
    mixSource(sig, alphaComaSource,
      alphaComaFieldGradient(label) * amplitude * 0.95, 2)
    return sig
  }

  // Electrocerebral inactivity — near-flat, residual technical noise only.
  function ecsChannel(label) {
    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude * 0.04, noiseLevel * 0.3)
    return sig
  }

  // Breach rhythm: awake background amplified over a skull defect.
  // Sharpened beta + accentuated alpha share a single source so the
  // amplified rhythm at C3/T7/F3/P3 is coherent — these channels surround
  // the same skull defect and should track each other.
  const breachSources = {
    sharpBeta: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  18,
      bandwidthHz: 6,
      nComponents: 3,
      envFreqMin:  0.15,
      envFreqMax:  0.4,
      envFloor:    0.55,
    }),
    sharpAlpha: buildSourceRhythm(nSamples, sampleRate, {
      centerFreq:  10,
      bandwidthHz: 1.0,
      nComponents: 2,
      envFloor:    0.6,
    }),
  }

  function breachChannel(label) {
    const sig = awakeChannel(label)
    const f = breachGradient(label)
    if (f <= 0) return sig
    for (let i = 0; i < nSamples; i++) sig[i] *= (1 + f * 1.6)
    mixSource(sig, breachSources.sharpBeta,  amplitude * 1.5 * f, 3)
    mixSource(sig, breachSources.sharpAlpha, amplitude * 1.2 * f, 2)
    return sig
  }

  // Hypsarrhythmia: chaotic very-high-amplitude disorganized slowing with
  // asynchronous multifocal sharp waves. Each channel gets its own random
  // morphology — that's the whole point (asynchrony).
  function hypsarrhythmiaChannel(label) {
    const sig = new Float32Array(nSamples)
    addPinkNoiseTo(sig, amplitude * 2.0, noiseLevel * 1.3)
    addModulatedBand(sig, sampleRate, {
      centerFreq:  1.5 + random() * 1.5,
      bandwidthHz: 2.5,
      amplitude:   amplitude * 3.8,
      nComponents: 4,
      envFreqMin:  0.05,
      envFreqMax:  0.4,
      envFloor:    0.5,
    })
    addModulatedBand(sig, sampleRate, {
      centerFreq:  3 + random() * 2,
      bandwidthHz: 3,
      amplitude:   amplitude * 2.2,
      nComponents: 3,
      envFloor:    0.4,
    })
    // Random asynchronous multifocal sharp waves
    const nSpikes = Math.round(duration * 2.2)
    for (let k = 0; k < nSpikes; k++) {
      const pos = Math.round(random() * nSamples)
      const amp = 180 + random() * 260
      injectSharpWave(sig, pos, {
        amplitude: amp,
        duration:  0.08 + random() * 0.1,
        polarity:  random() > 0.5 ? -1 : +1,
      })
    }
    return sig
  }

  // LPDs background — left hemisphere attenuated/slowed, right side normal.
  function lpdsBackgroundChannel(label) {
    return leftHemisphereGradient(label) > 0.3
      ? encephalopathyChannel(label)
      : awakeChannel(label)
  }

  // ?? Shared cardiac schedule for the whole recording ????????????????????
  // The heart only beats once: every channel must show QRS at the same time.
  const recordingHr   = 60 + Math.round(random() * 12)   // 60–72 bpm
  const cardiacBeats  = buildCardiacSchedule(duration, recordingHr)

  // ?? Build each channel ??????????????????????????????????????????????????
  ELECTRODES_1020.forEach(label => {
    let sig
    switch (pattern) {
      case 'normal_sleep':            sig = sleepChannel(label);            break
      case 'normal_drowsy':           sig = drowsyChannel(label);           break
      case 'fast_alpha_variant':      sig = awakeChannel(label);            break
      case 'mu_rhythm':               sig = awakeChannel(label);            break
      case 'central_midline_theta':    sig = awakeChannel(label);            break
      case 'lambda_waves':            sig = awakeChannel(label);            break
      case 'rmtd':                    sig = drowsyChannel(label);           break
      case 'wicket_rhythm':           sig = drowsyChannel(label);           break
      case 'sreda':                   sig = drowsyChannel(label);           break
      case 'small_sharp_spikes':      sig = drowsyChannel(label);           break
      case 'phantom_spike_wave':      sig = drowsyChannel(label);           break
      case 'positive_spikes_14_6':    sig = drowsyChannel(label);           break
      case 'normal_rem':              sig = drowsyChannel(label);           break
      case 'slow_wave_sleep':         sig = deltaSleepChannel(label);       break
      case 'focal_slowing':           sig = focalSlowingChannel(label);     break
      case 'burst_suppression':       sig = burstSuppressionChannel(label); break
      case 'hypsarrhythmia':          sig = hypsarrhythmiaChannel(label);   break
      case 'alpha_coma':              sig = alphaComaChannel(label);        break
      case 'electrocerebral_silence': sig = ecsChannel(label);              break
      case 'breach_rhythm':           sig = breachChannel(label);           break
      case 'diffuse_slowing':
      case 'firda':
      case 'gpds':
      case 'triphasic_waves':         sig = encephalopathyChannel(label);   break
      case 'lpds':                    sig = lpdsBackgroundChannel(label);   break
      case 'slow_spike_wave':
      case 'birds':
      case 'centrotemporal_spikes':   sig = drowsyChannel(label);           break
      case 'temporal_sharps':
      case 'polyspike_jme':
      case 'photoparoxysmal':
      case 'absence':
      case 'normal_awake':
      default:
        sig = awakeChannel(label)
    }

    // Ear channels are mostly silent references
    if (label === 'A1' || label === 'A2') {
      sig = new Float32Array(nSamples)
      addPinkNoiseTo(sig, amplitude * 0.1, noiseLevel)
    }

    // ?? Ambient artifacts always present in real recordings ?????????????
    // Slow baseline drift (0.05–0.3 Hz): skin/sweat, cable strain.
    // Cardiac pulse: visible at temporal/posterior leads and ear refs.
    // ECI leaves these out (the whole point is near-flat signal).
    if (pattern !== 'electrocerebral_silence') {
      addBaselineDrift(sig, sampleRate, label, amplitude)
      addCardiacPulse(sig, sampleRate, label, cardiacBeats)
    }

    channels[label] = sig
  })

  if (pattern === 'central_midline_theta') {
    const field = {
      Cz: 1.00, Pz: 0.68, Fz: 0.52,
      C3: 0.22, C4: 0.22, P3: 0.14, P4: 0.14, F3: 0.08, F4: 0.08,
    }
    const startSec = 0.45
    const durationSec = Math.max(0, Math.min(5.0, duration - startSec))
    const start = Math.round(startSec * sampleRate)
    const end = Math.min(nSamples, Math.round((startSec + durationSec) * sampleRate))
    const frequency = 5.7
    Object.entries(field).forEach(([label, weight]) => {
      for (let i = start; i < end; i++) {
        const elapsed = (i - start) / sampleRate
        const remaining = (end - i) / sampleRate
        const taper = Math.min(1, elapsed / 0.7, remaining / 0.7)
        const phase = 2 * Math.PI * frequency * elapsed
        channels[label][i] += 72 * weight * Math.max(0, taper) * (
          Math.sin(phase) + 0.10 * Math.sin(2 * phase + 0.35)
        )
      }
    })
  }

  if (pattern === 'wicket_rhythm') {
    const fields = {
      left: { T7: 1, F7: 0.24, P7: 0.30, C3: 0.05, A1: 0.05 },
      right: { T8: 1, F8: 0.24, P8: 0.30, C4: 0.05, A2: 0.05 },
    }
    const events = [
      { start: 0.7, duration: 1.8, side: 'left', hz: 8.4, amp: 45, phase: 0.3 },
      { start: 3.4, duration: 1.5, side: 'right', hz: 9.2, amp: 40, phase: 1.1 },
    ]
    events.forEach(event => {
      const start = Math.round(event.start * sampleRate)
      const end = Math.min(nSamples, Math.round((event.start + event.duration) * sampleRate))
      Object.entries(fields[event.side]).forEach(([label, field]) => {
        for (let i = start; i < end; i++) {
          const elapsed = (i - start) / sampleRate
          const edge = Math.min(1, elapsed / 0.24, (event.duration - elapsed) / 0.24)
          const envelope = Math.max(0, edge)
          const phase = event.phase + 2 * Math.PI * event.hz * elapsed
          channels[label][i] += event.amp * field * envelope * (
            Math.sin(phase) + 0.34 * Math.sin(2 * phase + 0.48) + 0.10 * Math.sin(3 * phase + 0.18)
          )
        }
      })
    })
  }

  if (pattern === 'sreda') {
    const field = {
      P7: 1.00, P8: 0.94, T7: 0.86, T8: 0.82,
      P3: 0.78, P4: 0.74, Pz: 0.62,
      O1: 0.48, O2: 0.46, C3: 0.30, C4: 0.28, Cz: 0.22,
      F7: 0.14, F8: 0.13,
    }
    const startSec = Math.min(0.55, duration * 0.16)
    const endSec = Math.max(startSec, duration - Math.min(0.35, duration * 0.10))
    const hz = 6.1
    const phase0 = 0.48
    const start = Math.round(startSec * sampleRate)
    const end = Math.min(nSamples, Math.round(endSec * sampleRate))
    Object.entries(field).forEach(([label, gain]) => {
      for (let i = start; i < end; i++) {
        const elapsed = (i - start) / sampleRate
        const remaining = (end - i) / sampleRate
        const envelope = Math.min(1, elapsed / 0.12, remaining / 0.16)
        const onsetSharpness = Math.max(0, 1 - elapsed / 1.1)
        const phase = phase0 + 2 * Math.PI * hz * elapsed
        channels[label][i] += 58 * gain * Math.max(0, envelope) * (
          Math.sin(phase) +
          (0.20 + 0.18 * onsetSharpness) * Math.sin(2 * phase + 0.42) +
          0.07 * Math.sin(3 * phase - 0.18)
        )
      }
    })
  }

  if (pattern === 'small_sharp_spikes') {
    const fields = {
      left: { T7: 1.00, F7: 0.62, P7: 0.54, C3: 0.22, A1: 0.16, F3: 0.12, P3: 0.10 },
      right: { T8: 1.00, F8: 0.62, P8: 0.54, C4: 0.22, A2: 0.16, F4: 0.12, P4: 0.10 },
    }
    const events = [
      { time: 0.48, side: 'left', amp: 34, polarity: -1 },
      { time: 1.18, side: 'right', amp: 39, polarity: -1 },
      { time: 2.02, side: 'left', amp: 31, polarity: 1 },
      { time: 2.76, side: 'right', amp: 36, polarity: -1 },
      { time: 3.58, side: 'left', amp: 42, polarity: -1 },
      { time: 4.52, side: 'right', amp: 33, polarity: -1 },
    ]
    events.filter(event => event.time < duration).forEach(event => {
      Object.entries(fields[event.side]).forEach(([label, gain]) => {
        const center = Math.round(event.time * sampleRate)
        const firstOffset = -Math.round(0.025 * sampleRate)
        const lastOffset = Math.round(0.105 * sampleRate)
        for (let offset = firstOffset; offset <= lastOffset; offset++) {
          const sample = center + offset
          if (sample < 0 || sample >= nSamples) continue
          const dt = offset / sampleRate
          const sharp = Math.exp(-Math.pow((dt - 0.012) / 0.016, 2) * 5.5)
          const returnPhase = Math.exp(-Math.pow((dt - 0.060) / 0.027, 2) * 4.5)
          channels[label][sample] += event.polarity * event.amp * gain * (sharp - 0.34 * returnPhase)
        }
      })
    })
  }

  if (pattern === 'phantom_spike_wave') {
    const field = {
      O1: 1.00, O2: 0.96, P7: 0.80, P8: 0.77,
      P3: 0.68, P4: 0.65, Pz: 0.58,
      T7: 0.38, T8: 0.36, C3: 0.20, C4: 0.19, Cz: 0.16,
      F3: 0.08, F4: 0.08,
    }
    const runs = [
      { start: 0.55, duration: 1.35, hz: 6.0, amp: 42 },
      { start: 3.15, duration: 1.10, hz: 6.2, amp: 38 },
    ]
    runs.filter(run => run.start < duration).forEach(run => {
      const start = Math.round(run.start * sampleRate)
      const end = Math.min(nSamples, Math.round((run.start + run.duration) * sampleRate))
      const period = 1 / run.hz
      Object.entries(field).forEach(([label, gain]) => {
        for (let i = start; i < end; i++) {
          const elapsed = (i - start) / sampleRate
          const remaining = (end - i) / sampleRate
          const envelope = Math.min(1, elapsed / 0.12, remaining / 0.16)
          const cycle = elapsed % period
          const spike = -run.amp * 0.76 * Math.exp(-Math.pow((cycle - 0.018) / 0.010, 2) * 5.5)
          const wavePosition = (cycle - 0.040) / (period - 0.045)
          const slowWave = wavePosition >= 0 && wavePosition <= 1
            ? run.amp * Math.sin(Math.PI * wavePosition)
            : 0
          channels[label][i] += gain * Math.max(0, envelope) * (spike + slowWave)
        }
      })
    })
  }

  if (pattern === 'positive_spikes_14_6') {
    const fields = {
      left: { T7: 1.00, P7: 0.84, O1: 0.58, P3: 0.42, C3: 0.18, T8: 0.10, P8: 0.08, A1: 0.04 },
      right: { T8: 1.00, P8: 0.84, O2: 0.58, P4: 0.42, C4: 0.18, T7: 0.10, P7: 0.08, A2: 0.04 },
    }
    const runs = [
      { start: 0.55, duration: 0.72, side: 'left', hz: 14.0, amp: 52 },
      { start: 2.15, duration: 0.82, side: 'right', hz: 6.0, amp: 56 },
      { start: 4.05, duration: 0.64, side: 'right', hz: 14.2, amp: 48 },
    ]
    runs.filter(run => run.start < duration).forEach(run => {
      const start = Math.round(run.start * sampleRate)
      const end = Math.min(nSamples, Math.round((run.start + run.duration) * sampleRate))
      const period = 1 / run.hz
      Object.entries(fields[run.side]).forEach(([label, gain]) => {
        for (let i = start; i < end; i++) {
          const elapsed = (i - start) / sampleRate
          const remaining = (end - i) / sampleRate
          const envelope = Math.min(1, elapsed / 0.08, remaining / 0.10)
          const phase = (elapsed % period) / period
          const arch = -0.38 * run.amp * Math.sin(Math.PI * phase)
          const spike = run.amp * Math.exp(-Math.pow((phase - 0.72) / 0.075, 2) * 4.2)
          channels[label][i] += gain * Math.max(0, envelope) * (arch + spike)
        }
      })
    })
  }

  // ?? Spontaneous eye blinks ??????????????????????????????????????????????
  // Blinks only occur when the subject is awake with open eyes.
  const NO_BLINK_PATTERNS = new Set([
    'normal_sleep', 'normal_drowsy', 'normal_rem', 'slow_wave_sleep',
    'burst_suppression', 'alpha_coma', 'electrocerebral_silence',
    'hypsarrhythmia', 'gpds', 'triphasic_waves', 'diffuse_slowing',
    'firda', 'centrotemporal_spikes', 'slow_spike_wave',
    'positive_spikes_14_6',
  ])
  const awakeWithOpenEyes = !eyesClosed && !NO_BLINK_PATTERNS.has(pattern)
  const showBlinks = blinksEnabled && awakeWithOpenEyes

  if (showBlinks) {
    const blinkTimes = generateBlinkTimes(duration, blinkRate)
    blinkTimes.forEach(t => {
      const s0 = Math.round(t * sampleRate)
      const peakAmp = 180 + random() * 80      // 180–260 µV at Fp
      const riseMs  = 55 + random() * 30
      const fallMs  = 180 + random() * 90
      ELECTRODES_1020.forEach(label => {
        const f = blinkField(label)
        if (f < 0.02) return
        injectEyeBlink(channels[label], s0, {
          amplitude: peakAmp * f,
          riseMs,
          fallMs,
          polarity: +1,
        })
      })
    })
  }

  // ?? Lateral eye movements (saccades) ????????????????????????????????????
  // Saccades depend only on the subject having eyes open — they're separate
  // from the blink toggle (a user might disable blinks for visual clarity but
  // we still want saccade artefacts present in awake eyes-open recordings).
  if (awakeWithOpenEyes) {
    const saccadeEvents = generateSaccadeTimes(duration, 22)
    saccadeEvents.forEach(({ t, direction }) => {
      const s0     = Math.round(t * sampleRate)
      const peak   = 60 + random() * 40       // 60–100 µV at F7/F8
      const durMs  = 280 + random() * 140
      ELECTRODES_1020.forEach(label => {
        const f = lateralEogField(label, direction)
        if (Math.abs(f) < 0.05) return
        injectLateralEyeMovement(channels[label], s0, {
          amplitude:  peak * f,
          durationMs: durMs,
        })
      })
    })
  }

  // ?? Pattern-specific transient injection ????????????????????????????????
  if (pattern === 'absence') {
    // 3 Hz generalised spike-and-wave, maximal frontocentral, attenuated
    // posteriorly. Real absence discharges are NOT perfectly periodic:
    // each complex shows ±5–10% jitter, and the discharge typically slows
    // slightly toward its end (e.g. 3.5 ? 2.5 Hz over a 5-s run). The
    // amplitude also waxes early in the run and tapers off.
    const burstStart = 1.0
    const burstEnd   = duration - 1.0
    const cmplxLen   = Math.round(sampleRate * 0.38)
    const spikeOffset = 10

    const scaleFor = (region) => (
      region === 'frontal' || region === 'central' ? 1.0
        : region === 'frontopolar' ? 0.9
        : region === 'parietal'    ? 0.7
        : region === 'occipital'   ? 0.55
        : region === 'ear'         ? 0.0
        :                            0.6
    )

    let t = burstStart
    while (t < burstEnd) {
      // Run-position fraction: 0 at start of discharge, 1 at end
      const x = (t - burstStart) / (burstEnd - burstStart)
      // Frequency tapers from 3.4 ? 2.6 Hz over the run
      const freq = 3.4 - 0.8 * x
      // Amplitude profile: ramps in over first 5%, tapers over last 20%
      const ampEnv = x < 0.05 ? x / 0.05
                   : x > 0.80 ? (1 - x) / 0.20
                   : 1
      // ±6% timing jitter on each complex
      const period = (1 / freq) * (0.94 + random() * 0.12)

      const scratch = new Float32Array(cmplxLen)
      injectSpikeAndWave(scratch, spikeOffset, { frequency: 3 })
      const s0 = Math.round(t * sampleRate)
      ELECTRODES_1020.forEach(label => {
        const scale = scaleFor(regionOf(label)) * ampEnv
        if (scale <= 0) return
        for (let i = 0; i < cmplxLen; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          channels[label][idx] += scratch[i] * scale
        }
      })
      t += period
    }
  }

  // ?? GPDs: bilaterally synchronous ~1 Hz sharp-and-slow ?????????????????
  // Real periodic discharges have ±10–15% IBI variation and small per-
  // complex amplitude jitter. Perfectly metronomic timing is a giveaway
  // for a synthetic trace.
  if (pattern === 'gpds') {
    const ibiMean  = 1.0
    const cmplxLen = Math.round(sampleRate * 0.42)
    let t = 0.6
    while (t < duration - 0.5) {
      const ampJ = 0.85 + random() * 0.30           // ±15% per complex
      const scratch = new Float32Array(cmplxLen)
      injectSharpWave(scratch, 12,
        { amplitude: 130 * ampJ, duration: 0.11, polarity: -1 })
      const swStart = Math.round(sampleRate * 0.15)
      const swLen   = Math.round(sampleRate * 0.26)
      for (let i = 0; i < swLen; i++) {
        const idx = swStart + i
        if (idx >= cmplxLen) break
        scratch[idx] += 70 * ampJ * Math.sin(Math.PI * i / swLen)
      }
      const s0 = Math.round(t * sampleRate)
      ELECTRODES_1020.forEach(label => {
        const scale = frontocentralGradient(label)
        if (scale <= 0.05) return
        for (let i = 0; i < cmplxLen; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          channels[label][idx] += scratch[i] * scale
        }
      })
      t += ibiMean * (0.88 + random() * 0.24)       // ±12% IBI jitter
    }
  }

  // ?? LPDs: left-lateralised ~1 Hz periodic discharges ???????????????????
  if (pattern === 'lpds') {
    const ibiMean  = 1.1
    const cmplxLen = Math.round(sampleRate * 0.38)
    let t = 0.7
    while (t < duration - 0.5) {
      const ampJ = 0.85 + random() * 0.30
      const scratch = new Float32Array(cmplxLen)
      injectSharpWave(scratch, 12,
        { amplitude: 120 * ampJ, duration: 0.09, polarity: -1 })
      const swStart = Math.round(sampleRate * 0.13)
      const swLen   = Math.round(sampleRate * 0.22)
      for (let i = 0; i < swLen; i++) {
        const idx = swStart + i
        if (idx >= cmplxLen) break
        scratch[idx] += 55 * ampJ * Math.sin(Math.PI * i / swLen)
      }
      const s0 = Math.round(t * sampleRate)
      ELECTRODES_1020.forEach(label => {
        const scale = leftHemisphereGradient(label)
        if (scale <= 0.08) return
        for (let i = 0; i < cmplxLen; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          channels[label][idx] += scratch[i] * scale
        }
      })
      t += ibiMean * (0.88 + random() * 0.24)
    }
  }

  // ?? Triphasic waves: ~1.5 Hz blunt 3-phase, A-P phase lag ??????????????
  if (pattern === 'triphasic_waves') {
    const ibiMean  = 0.65
    const cmplxLen = Math.round(sampleRate * 0.4)
    // Samples of anterior?posterior lag per region (classic triphasic lag)
    const regionLag = {
      frontopolar: 0,
      frontal:     4,
      central:     10,
      midtemporal: 10,
      parietal:    16,
      posttemporal:18,
      occipital:   22,
      ear:         0,
      other:       8,
    }
    let t = 0.5
    while (t < duration - 0.6) {
      const ampJ = 0.85 + random() * 0.30
      const scratch = new Float32Array(cmplxLen)
      injectTriphasicWave(scratch, 0,
        { amplitude: 140 * ampJ, duration: 0.35 })
      const s0 = Math.round(t * sampleRate)
      ELECTRODES_1020.forEach(label => {
        const scale = bifrontalGradient(label)
        if (scale <= 0.05) return
        const lag = regionLag[regionOf(label)] ?? 8
        for (let i = 0; i < cmplxLen; i++) {
          const idx = s0 + i + lag
          if (idx < 0 || idx >= nSamples) continue
          channels[label][idx] += scratch[i] * scale
        }
      })
      t += ibiMean * (0.88 + random() * 0.24)
    }
  }

  // ?? FIRDA: bifrontal rhythmic 2–3 Hz delta bursts ??????????????????????
  if (pattern === 'firda') {
    const bursts = [
      { t: 1.0, dur: 3.2 },
      { t: 6.0, dur: 2.6 },
    ]
    bursts.forEach(({ t: tStart, dur }) => {
      if (tStart + dur > duration - 0.2) return
      const burstLen = Math.round(dur * sampleRate)
      const freq = 2.5
      const scratch = new Float32Array(burstLen)
      const rampN = Math.round(sampleRate * 0.3)
      for (let i = 0; i < burstLen; i++) {
        const x = i / sampleRate
        const env = i < rampN ? (i / rampN)
                  : i > burstLen - rampN ? ((burstLen - i) / rampN)
                  : 1
        scratch[i] = env * 110 * Math.sin(2 * Math.PI * freq * x)
      }
      const s0 = Math.round(tStart * sampleRate)
      ELECTRODES_1020.forEach(label => {
        const scale = bifrontalGradient(label)
        if (scale <= 0.05) return
        for (let i = 0; i < burstLen; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          channels[label][idx] += scratch[i] * scale
        }
      })
    })
  }

  // ?? Slow spike-and-wave (Lennox-Gastaut): ~2 Hz, frontocentral max ?????
  // LGS complexes are notoriously irregular — individual complexes vary in
  // timing (±15%) and morphology, and "slow spike-wave" rarely runs at a
  // metronome 2 Hz. Real recordings show 1.5–2.5 Hz drift across a run.
  if (pattern === 'slow_spike_wave') {
    const ibiMean  = 0.5                                   // ~2 Hz
    const cmplxLen = Math.round(sampleRate * 0.52)
    let t = 0.6
    while (t < duration - 0.6) {
      const ampJ = 0.82 + random() * 0.36
      const scratch = new Float32Array(cmplxLen)
      injectSpike(scratch, 14,
        { amplitude: 180 * ampJ, duration: 0.08, polarity: -1 })
      const swStart = Math.round(sampleRate * 0.15)
      const swLen   = Math.round(sampleRate * 0.40)
      for (let i = 0; i < swLen; i++) {
        const idx = swStart + i
        if (idx >= cmplxLen) break
        scratch[idx] += 100 * ampJ * Math.sin(Math.PI * i / swLen)
      }
      const s0 = Math.round(t * sampleRate)
      ELECTRODES_1020.forEach(label => {
        // per-channel asymmetry — LGS discharges often imperfectly synchronous
        const scale = frontocentralGradient(label) * (0.85 + random() * 0.25)
        if (scale <= 0.05) return
        for (let i = 0; i < cmplxLen; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          channels[label][idx] += scratch[i] * scale
        }
      })
      t += ibiMean * (0.85 + random() * 0.30)         // ±15% IBI jitter
    }
  }

  // ?? Polyspike-and-wave bursts (JME): 4–6 Hz in short runs ??????????????
  if (pattern === 'polyspike_jme') {
    const burstTimes = [1.5, 4.4, 7.2]
    burstTimes.forEach(tStart => {
      if (tStart >= duration - 0.8) return
      const burstDur  = 0.8 + random() * 0.6
      const burstEnd  = tStart + burstDur
      const complexPeriod = 1 / 5                          // 5 Hz
      for (let t = tStart; t < burstEnd; t += complexPeriod) {
        const cmplxLen = Math.round(sampleRate * 0.2)
        const scratch  = new Float32Array(cmplxLen)
        injectPolyspike(scratch, 16, { count: 3, spacing: 0.02 })
        const swStart = Math.round(sampleRate * 0.08)
        const swLen   = Math.round(sampleRate * 0.12)
        for (let i = 0; i < swLen; i++) {
          const idx = swStart + i
          if (idx >= cmplxLen) break
          scratch[idx] += 75 * Math.sin(Math.PI * i / swLen)
        }
        const s0 = Math.round(t * sampleRate)
        ELECTRODES_1020.forEach(label => {
          const scale = frontocentralGradient(label)
          if (scale <= 0.05) return
          for (let i = 0; i < cmplxLen; i++) {
            const idx = s0 + i
            if (idx >= nSamples) break
            channels[label][idx] += scratch[i] * scale
          }
        })
      }
    })
  }

  // ?? Centrotemporal spikes (SeLECTS/BECTS): bilateral independent dipole ??
  if (pattern === 'centrotemporal_spikes') {
    // Rolandic dipole: negative max centrotemporal, positive frontal.
    const leftField = (label) => {
      switch (label) {
        case 'C3': case 'T7': return 1.00
        case 'P7':            return 0.55
        case 'P3':            return 0.45
        case 'Cz':            return 0.35
        case 'F3':            return -0.65           // dipole reversal
        case 'Fp1':           return -0.45
        case 'F7':            return -0.35
        default: return 0
      }
    }
    const rightField = (label) => {
      switch (label) {
        case 'C4': case 'T8': return 1.00
        case 'P8':            return 0.55
        case 'P4':            return 0.45
        case 'Cz':            return 0.35
        case 'F4':            return -0.65
        case 'Fp2':           return -0.45
        case 'F8':            return -0.35
        default: return 0
      }
    }
    const spikeSchedule = [
      { t: 1.1, field: leftField  },
      { t: 2.4, field: rightField },
      { t: 3.6, field: leftField  },
      { t: 5.3, field: leftField  },
      { t: 6.5, field: rightField },
      { t: 8.0, field: leftField  },
      { t: 9.1, field: rightField },
    ]
    spikeSchedule.forEach(({ t, field }) => {
      const cmplxLen = Math.round(sampleRate * 0.36)
      const scratch  = new Float32Array(cmplxLen)
      injectSharpWave(scratch, 16, { amplitude: 180, duration: 0.1, polarity: -1 })
      const swStart = Math.round(sampleRate * 0.14)
      const swLen   = Math.round(sampleRate * 0.22)
      for (let i = 0; i < swLen; i++) {
        const idx = swStart + i
        if (idx >= cmplxLen) break
        scratch[idx] += 85 * Math.sin(Math.PI * i / swLen)
      }
      const s0 = Math.round(t * sampleRate)
      ELECTRODES_1020.forEach(label => {
        const scale = field(label)
        if (scale === 0) return
        for (let i = 0; i < cmplxLen; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          channels[label][idx] += scratch[i] * scale
        }
      })
    })
  }

  // ?? Temporal sharps (TLE): left anterior-temporal interictal sharps ????
  if (pattern === 'temporal_sharps') {
    const times = [1.4, 3.2, 5.1, 7.0, 8.8]
    times.forEach(t => {
      const cmplxLen = Math.round(sampleRate * 0.4)
      const scratch  = new Float32Array(cmplxLen)
      injectSharpWave(scratch, 16, { amplitude: 140, duration: 0.12, polarity: -1 })
      const swStart = Math.round(sampleRate * 0.17)
      const swLen   = Math.round(sampleRate * 0.22)
      for (let i = 0; i < swLen; i++) {
        const idx = swStart + i
        if (idx >= cmplxLen) break
        scratch[idx] += 70 * Math.sin(Math.PI * i / swLen)
      }
      const s0 = Math.round(t * sampleRate)
      ELECTRODES_1020.forEach(label => {
        const scale = leftTemporalSpikeGradient(label)
        if (scale <= 0.05) return
        for (let i = 0; i < cmplxLen; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          channels[label][idx] += scratch[i] * scale
        }
      })
    })
  }

  if (pattern === 'birds') {
    const field = {
      T7: 1.00, F7: 0.82, P7: 0.72, C3: 0.48,
      F3: 0.32, P3: 0.28, Cz: 0.12, T8: 0.08,
    }
    const runs = [
      { start: 0.8, duration: 2.1, hz: 6.2, amp: 82, phase: 0.4 },
      { start: 6.2, duration: 1.5, hz: 5.7, amp: 74, phase: 1.1 },
    ]
    runs.filter(run => run.start < duration).forEach(run => {
      const start = Math.round(run.start * sampleRate)
      const end = Math.min(nSamples, Math.round((run.start + run.duration) * sampleRate))
      Object.entries(field).forEach(([label, gain]) => {
        for (let i = start; i < end; i++) {
          const elapsed = (i - start) / sampleRate
          const remaining = (end - i) / sampleRate
          const envelope = Math.min(1, elapsed / 0.07, remaining / 0.09)
          const phase = run.phase + 2 * Math.PI * run.hz * elapsed
          channels[label][i] += run.amp * gain * Math.max(0, envelope) * (
            Math.sin(phase) + 0.38 * Math.sin(2 * phase + 0.35) + 0.12 * Math.sin(3 * phase - 0.2)
          )
        }
      })
    })
  }

  // ?? Photoparoxysmal: photic driving at O1/O2, then generalized PPR ?????
  if (pattern === 'photoparoxysmal') {
    const flashFreq  = 16
    const flashStart = 0.8
    const flashEnd   = 4.2
    // Photic driving — occipital following response at flash frequency
    ;['O1', 'O2'].forEach(label => {
      for (let t = flashStart; t < flashEnd; t += 1 / flashFreq) {
        const s    = Math.round(t * sampleRate)
        const durN = Math.round(sampleRate * 0.025)
        for (let i = 0; i < durN; i++) {
          const idx = s + i
          if (idx >= nSamples) break
          channels[label][idx] += 75 * Math.sin(Math.PI * i / durN)
        }
      }
    })
    // PPR — starts ~2.5 s after flash, outlasts the stimulus
    const pprStart = 2.5
    const pprEnd   = 6.5
    const pprPeriod = 1 / 4.5                              // 4.5 Hz
    for (let t = pprStart; t < pprEnd; t += pprPeriod) {
      const cmplxLen = Math.round(sampleRate * 0.22)
      const scratch  = new Float32Array(cmplxLen)
      injectPolyspike(scratch, 16, { count: 3, spacing: 0.022 })
      const swStart = Math.round(sampleRate * 0.08)
      const swLen   = Math.round(sampleRate * 0.13)
      for (let i = 0; i < swLen; i++) {
        const idx = swStart + i
        if (idx >= cmplxLen) break
        scratch[idx] += 80 * Math.sin(Math.PI * i / swLen)
      }
      const s0 = Math.round(t * sampleRate)
      ELECTRODES_1020.forEach(label => {
        const scale = frontocentralGradient(label)
        if (scale <= 0.05) return
        for (let i = 0; i < cmplxLen; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          channels[label][idx] += scratch[i] * scale
        }
      })
    }
  }

  return { channels, sampleRate, duration, nSamples, pattern }
  } finally {
    activeRandom = previousRandom
  }
}

// ??? Time Axis ????????????????????????????????????????????????????????????????

/** Generate time axis array (seconds) for a given sample count */
export function makeTimeAxis(nSamples, sampleRate = SAMPLE_RATE) {
  return Array.from({ length: nSamples }, (_, i) => i / sampleRate)
}

