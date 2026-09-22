/**
 * Waveform Pattern Catalogue
 * Defines EEG waveform types with metadata and generator presets.
 *
 * Demos aim for clinically recognisable morphology:
 *   - Background rhythms wax and wane (narrow-band sinusoids + slow envelope).
 *   - Burst-suppression: polymorphic high-amplitude bursts with embedded
 *     sharps on a near-flat suppression floor.
 *   - Periodic patterns (triphasic, GPDs, LPDs): explicit multiphasic
 *     morphology and regular inter-discharge intervals.
 *   - Sleep features (vertex, K-complex, spindles, POSTS) modelled
 *     individually rather than via generic band synthesis.
 *
 * References: learningeeg.com, ACNS ICU EEG terminology (Hirsch 2021).
 */

import {
  injectSpike,
  injectSharpWave,
  injectEyeBlink,
  injectKComplex,
  SAMPLE_RATE,
} from './signalGenerator.js'

// ─── Local helpers ───────────────────────────────────────────────────────────

const nativeRandom = Math.random
let activeRandom = nativeRandom
const TWO_PI = 2 * Math.PI

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

function seedFromString(value) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h | 0
}

function gauss(mean = 0, std = 1) {
  const u = 1 - random(), v = random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function makeIrregularEnvelope(length, fs, {
  floor = 0.3,
  drift = 0.996,
  slowFreq = 0.18,
  phase = random() * 2 * Math.PI,
} = {}) {
  const env = new Float32Array(length)
  let state = 0
  for (let i = 0; i < length; i++) {
    const t = i / fs
    state = drift * state + (1 - drift) * gauss(0, 1)
    const slow = 0.5 + 0.5 * Math.sin(2 * Math.PI * slowFreq * t + phase)
    const noisy = Math.max(0, Math.min(1, slow + state))
    env[i] = floor + (1 - floor) * noisy
  }
  return env
}

/** Add a narrow-band rhythm with a slightly irregular waxing/waning envelope. */
function addRhythm(sig, fs, {
  centerFreq, bandwidthHz = 1.2, amplitude = 40, nComp = 3,
  envFreq = 0.15 + random() * 0.2, envFloor = 0.3, envDrift = 0.996,
}) {
  const env = makeIrregularEnvelope(sig.length, fs, {
    floor: envFloor,
    slowFreq: envFreq,
    drift: envDrift,
  })
  for (let c = 0; c < nComp; c++) {
    const f     = centerFreq + (random() - 0.5) * bandwidthHz
    const ph    = random() * 2 * Math.PI
    const amp   = amplitude * (0.6 + random() * 0.4) / nComp
    for (let i = 0; i < sig.length; i++) {
      const t  = i / fs
      sig[i] += amp * env[i] * Math.sin(2 * Math.PI * f * t + ph)
    }
  }
}

/** Add low-amplitude pink-ish noise. */
function addNoise(sig, std = 4) {
  let x = 0
  for (let i = 0; i < sig.length; i++) {
    // 1-pole lowpass on white noise → brown-ish noise
    x = 0.96 * x + 0.04 * gauss(0, std)
    sig[i] += x
  }
}

function addPolymorphicSlow(sig, fs, {
  amplitude = 100,
  minFreq = 0.7,
  maxFreq = 4,
  nComp = 7,
  envFloor = 0.25,
} = {}) {
  const env = makeIrregularEnvelope(sig.length, fs, {
    floor: envFloor,
    slowFreq: 0.08 + random() * 0.12,
    drift: 0.99,
  })
  for (let c = 0; c < nComp; c++) {
    const f = minFreq + random() * (maxFreq - minFreq)
    const ph = random() * 2 * Math.PI
    const wobbleFreq = 0.04 + random() * 0.05
    const amp = amplitude * (0.45 + random() * 0.75) / nComp
    for (let i = 0; i < sig.length; i++) {
      const t = i / fs
      const warped = t + 0.025 * Math.sin(2 * Math.PI * wobbleFreq * t + ph)
      sig[i] += amp * env[i] * Math.sin(2 * Math.PI * f * warped + ph)
    }
  }
}

function injectAfterSlowWave(sig, at, fs, {
  amp = 55,
  delay = 0.06,
  duration = 0.28,
  polarity = 1,
} = {}) {
  const s = at + Math.round(delay * fs)
  const n = Math.max(1, Math.round(duration * fs))
  for (let i = 0; i < n; i++) {
    const idx = s + i
    if (idx < 0 || idx >= sig.length) continue
    const x = i / n
    sig[idx] += polarity * amp * Math.sin(Math.PI * x) * Math.exp(-0.4 * x)
  }
}

function injectPolyspikeAndSlow(sig, at, fs, {
  count = 4,
  amp = 180,
  spacing = 0.026,
} = {}) {
  for (let k = 0; k < count; k++) {
    injectSpike(sig, at + Math.round(k * spacing * fs), {
      amplitude: amp * (1 - k * 0.09) * (0.9 + random() * 0.18),
      duration: 0.035 + random() * 0.012,
      polarity: -1,
      asymmetry: 0.28,
    })
  }
  injectAfterSlowWave(sig, at + Math.round(count * spacing * fs), fs, {
    amp: amp * 0.42,
    delay: 0.035,
    duration: 0.35,
    polarity: 1,
  })
}

function injectSpikeWaveComplex(sig, at, fs, {
  spikeAmp = 190,
  slowAmp = 115,
  slowDuration = 0.24,
} = {}) {
  injectSpike(sig, at, {
    amplitude: spikeAmp * (0.9 + random() * 0.2),
    duration: 0.038 + random() * 0.01,
    polarity: -1,
    asymmetry: 0.25,
  })
  injectAfterSlowWave(sig, at, fs, {
    amp: slowAmp * (0.9 + random() * 0.2),
    delay: 0.045,
    duration: slowDuration,
    polarity: 1,
  })
}

function injectEmgBurst(sig, fs, {
  startSec = 1,
  duration = 1,
  amplitude = 70,
} = {}) {
  const start = Math.round(startSec * fs)
  const n = Math.round(duration * fs)
  const phases = Array.from({ length: 12 }, () => random() * 2 * Math.PI)
  const freqs = Array.from({ length: 12 }, () => 32 + random() * 58)
  for (let i = 0; i < n; i++) {
    const idx = start + i
    if (idx >= sig.length) break
    const x = i / n
    const env = Math.sin(Math.PI * x) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 7 * x))
    let v = gauss(0, 0.35)
    for (let c = 0; c < freqs.length; c++) {
      v += Math.sin(2 * Math.PI * freqs[c] * i / fs + phases[c]) / freqs.length
    }
    sig[idx] += amplitude * env * v
  }
}

/** Arched (mu-rhythm) oscillation: sinusoid with negative half flattened. */
function addArched(sig, fs, { freq = 10, amp = 40, envFreq = 0.2, envFloor = 0.2 }) {
  const envPhase = random() * 2 * Math.PI
  for (let i = 0; i < sig.length; i++) {
    const t = i / fs
    const e = envFloor + (1 - envFloor) *
              Math.max(0, Math.sin(2 * Math.PI * envFreq * t + envPhase))
    const raw = Math.sin(2 * Math.PI * freq * t)
    // Flatten the troughs so peaks look "combed" / arched
    const shaped = raw > 0 ? raw : raw * 0.25
    sig[i] += amp * e * shaped
  }
}

function smoothstep(edge0, edge1, x) {
  const u = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return u * u * (3 - 2 * u)
}

function muArciformCarrier(phase, harmonic = 0.24) {
  // Mu is a non-sinusoidal alpha-range rhythm, not a train of identical
  // sharp transients. A modest phase-locked second harmonic broadens the
  // positive arch and steepens the negative vertex while keeping the trace
  // and its derivatives continuous. A tiny third harmonic adds the subtle
  // pre-vertex shoulder often responsible for its comb-like appearance.
  return Math.sin(phase) +
    harmonic * Math.cos(2 * phase) +
    0.035 * Math.sin(3 * phase + 0.35)
}

/** Mu rhythm: central alpha-range, arciform, and movement-reactive. */
function addMuRhythm(sig, fs, {
  freq = 10,
  amp = 44,
  envFloor = 0.35,
  blockStartSec = 1.16,
  blockEndSec = 1.82,
  blockDepth = 0.82,
} = {}) {
  const env = makeIrregularEnvelope(sig.length, fs, {
    floor: envFloor,
    slowFreq: 0.10 + random() * 0.06,
    drift: 0.997,
  })
  const tmp = new Float32Array(sig.length)
  const fmPhase = random() * TWO_PI
  let phase = random() * TWO_PI
  let mean = 0

  for (let i = 0; i < sig.length; i++) {
    const t = i / fs
    const f = freq +
      0.18 * Math.sin(TWO_PI * 0.07 * t + fmPhase) +
      0.06 * Math.sin(TWO_PI * 0.23 * t + fmPhase * 0.7)
    phase += TWO_PI * f / fs

    const blockIn = smoothstep(blockStartSec - 0.12, blockStartSec + 0.02, t)
    const blockOut = smoothstep(blockEndSec, blockEndSec + 0.18, t)
    const movementBlock = blockIn * (1 - blockOut)
    const blockScale = 1 - blockDepth * movementBlock
    const microVariation = 1 +
      0.035 * Math.sin(TWO_PI * 0.9 * t + fmPhase) +
      0.018 * Math.sin(TWO_PI * 2.1 * t + fmPhase * 0.43)
    const harmonic = 0.23 + 0.025 * Math.sin(TWO_PI * 0.19 * t + fmPhase * 1.3)

    tmp[i] = amp * env[i] * blockScale * microVariation * muArciformCarrier(phase, harmonic)
    mean += tmp[i]
  }

  mean /= sig.length
  for (let i = 0; i < sig.length; i++) sig[i] += tmp[i] - mean
}

/** Inject a normal sleep vertex wave: brief V-shaped surface-negative sharp. */
function injectVertexSharp(sig, at, fs = SAMPLE_RATE, {
  amp = 125,
  preShoulder = 0.16,
  postShoulder = 0.24,
  riseSec = 0.045,
  fallSec = 0.080,
} = {}) {
  const start = Math.round(-0.11 * fs)
  const end = Math.round(0.18 * fs)

  for (let i = start; i <= end; i++) {
    const idx = at + i
    if (idx < 0 || idx >= sig.length) continue
    const t = i / fs
    let v = 0

    if (t >= -0.105 && t < -riseSec * 0.65) {
      const x = (t + 0.105) / (0.105 - riseSec * 0.65)
      v += amp * preShoulder * Math.pow(Math.sin(Math.PI * x), 1.25)
    }
    if (t >= -riseSec && t <= 0) {
      const x = (t + riseSec) / riseSec
      v += -amp * Math.pow(x, 1.18)
    } else if (t > 0 && t <= fallSec) {
      const x = t / fallSec
      v += -amp * Math.pow(1 - x, 1.45)
    }
    if (t > fallSec * 0.55 && t <= 0.175) {
      const x = (t - fallSec * 0.55) / (0.175 - fallSec * 0.55)
      v += amp * postShoulder * Math.pow(Math.sin(Math.PI * x), 1.15)
    }

    sig[idx] += v
  }
}

/** Inject a sleep spindle: 12–14 Hz, 0.5–1.5 s, waxing/waning envelope. */
function injectSpindle(sig, at, { amp = 35, durSec = 1.0, freq = 13 } = {}) {
  const dur = Math.round(durSec * SAMPLE_RATE)
  for (let i = 0; i < dur; i++) {
    const idx = at + i
    if (idx >= sig.length) break
    const env = Math.sin(Math.PI * i / dur)    // 0..1..0
    sig[idx] += amp * env * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE)
  }
}

/** Inject a triphasic wave: brief positive → large negative → large positive. */
function injectTriphasic(sig, at, { amp = 120 } = {}) {
  const p1 = Math.round(0.08 * SAMPLE_RATE)   // short positive bump
  const p2 = Math.round(0.12 * SAMPLE_RATE)   // large negative
  const p3 = Math.round(0.22 * SAMPLE_RATE)   // broad positive
  let idx = at
  for (let i = 0; i < p1; i++, idx++) {
    if (idx >= sig.length) return
    sig[idx] += amp * 0.35 * Math.sin(Math.PI * i / p1)
  }
  for (let i = 0; i < p2; i++, idx++) {
    if (idx >= sig.length) return
    sig[idx] += -amp * Math.sin(Math.PI * i / p2)
  }
  for (let i = 0; i < p3; i++, idx++) {
    if (idx >= sig.length) return
    sig[idx] += amp * 0.85 * Math.sin(Math.PI * i / p3)
  }
}

/** Inject a POSTS: asymmetric surface-positive occipital sharp transient. */
function injectPOSTS(sig, at, fs = SAMPLE_RATE, {
  amp = 60,
  riseSec = 0.045,
  fallSec = 0.105,
  shoulder = 0.10,
} = {}) {
  const preN = Math.round(0.025 * fs)
  const riseN = Math.round(riseSec * fs)
  const fallN = Math.round(fallSec * fs)
  const postN = Math.round(0.030 * fs)
  const totalN = preN + riseN + fallN + postN

  for (let i = 0; i < totalN; i++) {
    const idx = at + i
    if (idx >= sig.length) return
    let v

    if (i < preN) {
      v = -amp * shoulder * Math.sin(Math.PI * i / preN)
    } else if (i < preN + riseN) {
      const x = (i - preN) / riseN
      v = amp * Math.pow(x, 0.78)
    } else if (i < preN + riseN + fallN) {
      const x = (i - preN - riseN) / fallN
      v = amp * Math.pow(1 - x, 1.18)
    } else {
      const x = (i - preN - riseN - fallN) / postN
      v = -amp * shoulder * 0.65 * Math.sin(Math.PI * x)
    }

    sig[idx] += v
  }
}

// ─── Pattern Registry ─────────────────────────────────────────────────────────

export const WAVEFORM_PATTERNS = {

  // ── Background rhythms ───────────────────────────────────────────────────
  alpha: {
    id:          'alpha',
    group:       'background',
    label:       'Alpha',
    freq:        '8–13 Hz',
    amplitude:   '20–100 µV',
    morphology:  'Sinusoidal, symmetric; waxes and wanes',
    location:    'Occipital / posterior, maximal with eyes closed',
    reactivity:  'Attenuates (blocks) with eye opening — Berger effect',
    clinical:    'Normal posterior dominant rhythm in awake adults',
    pathological: false,
    color:       '#00FFB0',
  },

  beta: {
    id:          'beta',
    group:       'background',
    label:       'Beta',
    freq:        '13–30 Hz',
    amplitude:   '5–20 µV (usually low voltage)',
    morphology:  'Low-amplitude, symmetric fast activity, often intermixed with background rhythms',
    location:    'Frontal / central',
    reactivity:  'Attenuated by movement; enhanced by eyes open and alertness',
    clinical:    'Normal; enhanced by benzodiazepines and barbiturates',
    pathological: false,
    color:       '#FF6B35',
  },

  theta: {
    id:          'theta',
    group:       'background',
    label:       'Theta',
    freq:        '4–8 Hz',
    amplitude:   '20–100 µV',
    morphology:  'Rounded or irregular',
    location:    'Diffuse or temporal',
    reactivity:  'Variable',
    clinical:    'Normal in children and drowsiness; abnormal if diffuse in awake adults',
    pathological: 'context-dependent',
    color:       '#00D4FF',
  },

  delta: {
    id:          'delta',
    group:       'background',
    label:       'Delta',
    freq:        '0.5–4 Hz',
    amplitude:   '100–400 µV',
    morphology:  'High amplitude, irregular to polymorphic',
    location:    'Diffuse (GSWD) or focal',
    reactivity:  'Typically non-reactive if abnormal',
    clinical:    'Normal in NREM sleep; pathological if focal or in awake adults',
    pathological: 'context-dependent',
    color:       '#7B5EA7',
  },

  lambda_waves: {
    id:          'lambda_waves',
    group:       'background',
    label:       'Lambda Waves',
    freq:        'Transient (irregular, non-rhythmic)',
    duration:    '100–200 ms',
    amplitude:   '20–50 µV typical',
    morphology:  'Sharply contoured surface-positive monophasic or biphasic transients resembling the Greek letter lambda',
    location:    'Occipital, maximal at O1/O2; commonly asymmetric or unilateral with limited posterior spread',
    reactivity:  'Appear with eyes open during active visual scanning; disappear with eye closure and visual fixation',
    clinical:    'Normal awake variant that may resemble occipital spikes; the visual-scanning context and absence with eye closure are distinguishing features',
    pathological: false,
    color:       '#A7F3D0',
  },

  mu: {
    id:          'mu',
    group:       'background',
    label:       'Mu Rhythm',
    freq:        '8–13 Hz (central alpha; often ~9–11 Hz)',
    amplitude:   '20–60 µV',
    morphology:  'Arciform / comb-shaped; asymmetric with a sharp negative component and rounded positive arch',
    location:    'Central sensorimotor cortex, maximal at C3/C4/Cz; may be asymmetric or unilateral',
    reactivity:  'Attenuates with contralateral movement, motor imagery, or tactile stimulation; not eye opening',
    clinical:    'Normal awake rhythm that can mimic central sharp waves; marked asymmetry or focal loss needs clinical context',
    pathological: false,
    color:       '#7FFFD4',
  },

  central_midline_theta: {
    id:          'central_midline_theta',
    group:       'background',
    label:       'Central Midline Theta Rhythm',
    freq:        '4–7 Hz',
    duration:    'Runs usually lasting at least 3 seconds',
    amplitude:   'Often >50 µV at the vertex',
    morphology:  'Monomorphic, rhythmic theta in smooth or mildly arciform spindle-like runs without ictal evolution',
    location:    'Midline central/parietal vertex, usually maximal at Cz with spread to Pz and Fz',
    reactivity:  'May occur during wakefulness or drowsiness; no consistent clinical correlate',
    clinical:    'Uncommon midline theta pattern also called the Ciganek rhythm; interpret in clinical context and distinguish from evolving ictal theta',
    pathological: false,
    color:       '#60A5FA',
  },

  wicket_rhythm: {
    id:          'wicket_rhythm',
    group:       'background',
    label:       'Wicket Rhythm',
    freq:        '6–11 Hz (commonly 8–10 Hz)',
    duration:    'Isolated waves or brief trains lasting about 0.5–3 s',
    amplitude:   '60–200 µV',
    morphology:  'Arciform, comb-like temporal waves with a sharp negative crest and rounded return; no after-going slow wave',
    location:    'Anterior- to mid-temporal, unilateral or independently bilateral',
    reactivity:  'Most prominent during drowsiness and light sleep; does not evolve',
    clinical:    'Benign normal variant and common temporal epileptiform mimic. Isolated waves are often called wicket spikes.',
    pathological: false,
    color:       '#8BE0D0',
  },

  sreda: {
    id:          'sreda',
    group:       'background',
    label:       'SREDA',
    freq:        '5–7 Hz (usually about 6 Hz)',
    duration:    'Usually 20–80 s; the teaching trace shows a shortened run',
    amplitude:   'Approximately 40–100 µV',
    morphology:  'Sharply contoured or notched rhythmic theta with an abrupt onset and offset and little internal evolution',
    location:    'Bilateral posterior temporal and parietal regions, often synchronous but sometimes asymmetric',
    reactivity:  'Occurs during wakefulness or drowsiness without a clinical correlate or postictal change',
    clinical:    'Uncommon benign adult variant that can closely mimic an electrographic seizure, especially in older adults.',
    pathological: false,
    color:       '#6FE7DD',
  },

  small_sharp_spikes: {
    id:          'small_sharp_spikes',
    group:       'background',
    label:       'Small Sharp Spikes (BETS)',
    freq:        'Isolated transients rather than a rhythm',
    duration:    'Main sharp component usually < 50 ms',
    amplitude:   'Usually < 50 µV',
    morphology:  'Low-amplitude monophasic or diphasic sharp transient without a prominent after-going slow wave',
    location:    'Broad anterior- to mid-temporal field; unilateral or independently bilateral',
    reactivity:  'Appears during drowsiness and light NREM sleep without background disruption',
    clinical:    'Benign adult sleep variant. The historical term benign epileptiform transient of sleep does not imply epilepsy.',
    pathological: false,
    color:       '#9BE7C4',
  },

  phantom_spike_wave: {
    id:          'phantom_spike_wave',
    group:       'background',
    label:       'Phantom Spike-Wave',
    freq:        '5–7 Hz (typically about 6 Hz)',
    duration:    'Brief bursts, usually 0.5–2 s',
    amplitude:   'Low amplitude; the spike is small relative to the slow wave',
    morphology:  'Tiny sharp spike followed by a rounded slow wave, repeating at approximately 6 Hz without evolution',
    location:    'Usually bilateral posterior/occipital maximum in the benign FOLD form',
    reactivity:  'Most often appears during relaxed wakefulness or drowsiness without a clinical correlate',
    clinical:    'The posterior low-amplitude FOLD form is benign; anterior high-amplitude WHAM morphology deserves greater caution.',
    pathological: false,
    color:       '#B7E4C7',
  },

  positive_spikes_14_6: {
    id:          'positive_spikes_14_6',
    group:       'background',
    label:       '14 & 6 Hz Positive Spikes',
    freq:        '14 Hz or 6 Hz',
    duration:    'Brief bursts lasting approximately 0.5–1 s',
    amplitude:   'Usually < 75 µV',
    morphology:  'Arciform or comb-shaped trains with pointed surface-positive peaks',
    location:    'Posterior temporal maximum, unilateral or independently bilateral, with parietal and occipital spread',
    reactivity:  'Occurs during drowsiness and light sleep; best seen with long interelectrode distances or an ear reference',
    clinical:    'Benign age-related variant seen predominantly in children and adolescents; it has no epileptogenic significance.',
    pathological: false,
    color:       '#A8E6CF',
  },

  posterior_slow_waves_youth: {
    id:          'posterior_slow_waves_youth',
    group:       'background',
    label:       'Posterior Slow Waves of Youth',
    freq:        '2–4 Hz slow waves, intermixed with an age-appropriate posterior dominant rhythm',
    duration:    'Isolated waves or brief, non-evolving runs',
    amplitude:   'Usually 50–150 µV; may exceed the surrounding posterior rhythm',
    morphology:  'Bilateral synchronous, rounded delta waves that may be notched by superimposed posterior alpha',
    location:    'Occipital maximum at O1/O2 with parietal spread and a steep posterior-to-anterior gradient',
    reactivity:  'Seen during relaxed wakefulness with eyes closed and attenuates with eye opening along with the posterior rhythm',
    clinical:    'Benign age-related variant of childhood and adolescence; symmetry, posterior restriction, preserved background, and lack of evolution distinguish it from pathologic slowing.',
    pathological: false,
    color:       '#74D3AE',
  },

  // ── Sleep features ───────────────────────────────────────────────────────
  vertex_sharp_wave: {
    id:          'vertex_sharp_wave',
    group:       'sleep',
    label:       'Vertex Sharp Wave',
    freq:        'Transient',
    duration:    '100–200 ms main sharp component',
    amplitude:   '50–150 µV typical; occasionally larger',
    morphology:  'Surface-negative V-shaped sharp transient, often bi- or triphasic with small positive shoulders',
    location:    'Cz maximum with symmetric spread to C3/C4 and midline frontal-parietal leads',
    reactivity:  'Spontaneous or evoked by arousal, auditory, or tactile stimuli during drowsiness / N1–N2',
    clinical:    'Normal N1–N2 graphoelement; can appear spiky, but symmetry, state, and lack of a prominent after-going slow wave distinguish it from epileptiform activity',
    pathological: false,
    color:       '#B0E0FF',
  },

  sleep_spindle: {
    id:          'sleep_spindle',
    group:       'sleep',
    label:       'Sleep Spindle',
    freq:        '12–14 Hz (sigma band)',
    duration:    '0.5–2 s',
    amplitude:   '20–80 µV',
    morphology:  'Sinusoidal burst with waxing-then-waning amplitude envelope',
    location:    'Maximal Cz/Fz; visible on C3, C4, Fz, and parasagittal chains',
    reactivity:  'Stable marker of N2 sleep',
    clinical:    'Hallmark of N2 sleep; reduction is seen in thalamic dysfunction',
    pathological: false,
    color:       '#88CCFF',
  },

  k_complex: {
    id:          'k_complex',
    group:       'sleep',
    label:       'K-Complex',
    freq:        'Transient',
    duration:    '≥ 500 ms (typically about 0.5–1 s)',
    amplitude:   '100–400 µV',
    morphology:  'High-voltage biphasic complex: a well-delineated steep surface-negative sharp wave followed immediately by a broad positive slow component; may be followed by a spindle',
    location:    'Frontocentral maximum, usually Fz/Cz, with symmetric parasagittal spread',
    reactivity:  'Spontaneous or evoked by stimuli during N2',
    clinical:    'Defining graphoelement of N2 sleep. A benign mitten wave can arise when a spindle-related sharp component merges with a same-polarity slow wave. In contrast, dyshormia is an abnormal epileptiform spike or spike-wave discharge superimposed on or coupled to a K-complex. Periodic K-complexes can resemble generalised periodic discharges if taken out of context.',
    pathological: false,
    color:       '#9CC9FF',
  },

  posts: {
    id:          'posts',
    group:       'sleep',
    label:       'POSTS',
    freq:        '4–5 Hz (trains)',
    duration:    '80–200 ms each',
    amplitude:   '20–75 µV',
    morphology:  'Surface-positive, sharply contoured triangular waves with a steep rising limb and slower return; occur singly or in 4–5 Hz trains',
    location:    'Occipital maximum at O1/O2, usually synchronous and symmetric but sometimes asymmetric',
    reactivity:  'Appear in N1–N2 sleep; disappear with arousal',
    clinical:    'Positive Occipital Sharp Transients of Sleep — BENIGN. Commonly misread as occipital sharp waves.',
    pathological: false,
    color:       '#AADDBB',
  },

  // ── Epileptiform transients ──────────────────────────────────────────────
  spike: {
    id:          'spike',
    group:       'epileptiform',
    label:       'Spike',
    freq:        'Transient',
    duration:    '< 70 ms',
    amplitude:   '50–500 µV',
    morphology:  'Sharply contoured, asymmetric, steep rise, usually negative; followed by after-going slow wave',
    location:    'Focal or generalised',
    reactivity:  'N/A',
    clinical:    'Epileptiform discharge; strongly associated with epilepsy',
    pathological: true,
    color:       '#FF4444',
  },

  sharp_wave: {
    id:          'sharp_wave',
    group:       'epileptiform',
    label:       'Sharp Wave',
    freq:        'Transient',
    duration:    '70–200 ms',
    amplitude:   '50–300 µV',
    morphology:  'Pointed, broader than spike; often followed by slow wave',
    location:    'Focal or generalised',
    reactivity:  'N/A',
    clinical:    'Epileptiform; significance similar to spike',
    pathological: true,
    color:       '#FF6B35',
  },

  polyspike: {
    id:          'polyspike',
    group:       'epileptiform',
    label:       'Polyspike',
    freq:        'Transient burst',
    duration:    '< 200 ms (burst)',
    amplitude:   '100–500 µV',
    morphology:  'Multiple (3+) spikes in rapid succession',
    location:    'Generalised (typical); less often focal',
    reactivity:  'N/A',
    clinical:    'Seen in generalised epilepsies (JME, Lennox-Gastaut)',
    pathological: true,
    color:       '#FF0066',
  },

  spike_wave: {
    id:          'spike_wave',
    group:       'epileptiform',
    label:       '3 Hz Spike-and-Wave',
    freq:        '2.5–4 Hz (typical absence: 3 Hz)',
    duration:    'Ictal run, often 5–30 s',
    amplitude:   '100–400 µV',
    morphology:  'Spike followed by slow wave, regular repetition at 3 Hz',
    location:    'Generalised, frontally-dominant',
    reactivity:  'Provoked by hyperventilation in childhood absence epilepsy',
    clinical:    '3 Hz: childhood absence epilepsy; <2.5 Hz slow spike-wave: Lennox-Gastaut',
    pathological: true,
    color:       '#FF4466',
  },

  birds: {
    id:          'birds',
    group:       'epileptiform',
    label:       'BIRDs',
    freq:        '> 4 Hz (6 Hz shown)',
    duration:    '0.5 to < 10 s',
    amplitude:   'Variable',
    morphology:  'Abrupt, sharply contoured rhythmic run with at least six cycles (possible BIRDs example)',
    location:    'Focal or generalised (left temporal example shown)',
    reactivity:  'No definite clinical correlate by definition',
    clinical:    'Strong marker of electrographic seizure risk; prompts careful review and continued monitoring',
    pathological: true,
    color:       '#FF3D71',
  },

  hypsarrhythmia: {
    id:          'hypsarrhythmia',
    group:       'epileptiform',
    label:       'Hypsarrhythmia',
    freq:        'Chaotic, multifocal',
    amplitude:   '300–1000+ µV',
    morphology:  'Very high amplitude, disorganised, asynchronous, multifocal spikes and sharp waves on a chaotic slow background',
    location:    'Generalised; asynchronous across hemispheres',
    reactivity:  'Can be modified by sleep (classic "fragmentation") and by treatment (ACTH, vigabatrin)',
    clinical:    'Hallmark of infantile spasms / West syndrome. Requires urgent treatment to preserve development.',
    pathological: true,
    color:       '#FF2255',
  },

  // ── Periodic patterns ────────────────────────────────────────────────────
  triphasic_waves: {
    id:          'triphasic_waves',
    group:       'periodic',
    label:       'Triphasic Waves',
    freq:        '1–2 Hz',
    amplitude:   '100–300 µV',
    morphology:  'Three phases: small positive → large negative → large positive; blunt, not spiky',
    location:    'Generalised, bifrontal or bioccipital maximum; anterior-to-posterior (or reverse) lag',
    reactivity:  'Reactive to stimulation (may briefly attenuate or enhance)',
    clinical:    'Historically associated with toxic-metabolic encephalopathy, but not specific for a metabolic cause and not sufficient by itself to exclude seizure risk',
    pathological: true,
    color:       '#FFB347',
  },

  gpds: {
    id:          'gpds',
    group:       'periodic',
    label:       'Generalised Periodic Discharges (GPDs)',
    freq:        '0.5–2 Hz',
    amplitude:   '50–300 µV',
    morphology:  'Bilaterally synchronous periodic sharp-wave / sharp-and-slow-wave complexes at a regular interval',
    location:    'Generalised',
    reactivity:  'Variable; evolution raises concern for NCSE',
    clinical:    'Post-anoxic encephalopathy, severe metabolic states, CJD (1 Hz), NCSE (ictal-interictal continuum)',
    pathological: true,
    color:       '#FFA552',
  },

  lpds: {
    id:          'lpds',
    group:       'periodic',
    label:       'Lateralised Periodic Discharges (LPDs / PLEDs)',
    freq:        '0.5–2 Hz',
    amplitude:   '75–400 µV',
    morphology:  'Periodic sharply-contoured complexes lateralised to one hemisphere; background often slowed',
    location:    'Unilateral — typically over an acute lesion',
    reactivity:  'Non-reactive; may evolve into focal seizures',
    clinical:    'Acute stroke, herpes encephalitis, focal structural lesion, post-ictal state. Ictal-interictal continuum.',
    pathological: true,
    color:       '#FF8B40',
  },

  // ── Abnormal non-epileptiform ────────────────────────────────────────────
  focal_slowing: {
    id:          'focal_slowing',
    group:       'abnormal',
    label:       'Focal Slowing',
    freq:        '0.5–8 Hz focal',
    amplitude:   'Variable',
    morphology:  'Polymorphic delta or theta, irregular',
    location:    'Unilateral / focal',
    reactivity:  'Non-reactive',
    clinical:    'Focal structural lesion (stroke, tumour, encephalitis)',
    pathological: true,
    color:       '#FFD166',
  },

  firda: {
    id:          'firda',
    group:       'abnormal',
    label:       'FIRDA',
    freq:        '2–3 Hz rhythmic delta bursts',
    amplitude:   '100–300 µV',
    morphology:  'Rhythmic, monomorphic, sinusoidal delta in bursts lasting 2–10 s; waxing and waning',
    location:    'Bifrontal maximum (Fz, F3, F4); symmetric',
    reactivity:  'Typically reactive to eye opening or stimulation',
    clinical:    'Frontal Intermittent Rhythmic Delta Activity — deep midline dysfunction, raised ICP, metabolic encephalopathy',
    pathological: true,
    color:       '#FFC27A',
  },

  burst_suppression: {
    id:          'burst_suppression',
    group:       'abnormal',
    label:       'Burst-Suppression',
    freq:        'Alternating periodic',
    duration:    'Bursts 0.5–3 s; suppression 2–10 s',
    amplitude:   'Bursts: 50–300 µV; suppression: < 5–10 µV',
    morphology:  'High-amplitude mixed-frequency bursts (theta/alpha/beta often with superimposed sharps) separated by near-flat suppression',
    location:    'Generalised and synchronous',
    reactivity:  'Typically non-reactive; variable in anaesthetic titration',
    clinical:    'Profound cortical dysfunction: hypoxic-ischaemic injury, deep general anaesthesia, severe hypothermia, advanced metabolic encephalopathy',
    pathological: true,
    color:       '#A0A0FF',
  },

  breach_rhythm: {
    id:          'breach_rhythm',
    group:       'abnormal',
    label:       'Breach Rhythm',
    freq:        'Alpha and beta range',
    amplitude:   '50–200 µV (2–3× surrounding)',
    morphology:  'Focally high-amplitude sharp-contoured beta and alpha over a skull defect',
    location:    'Focal — overlies a craniotomy or skull defect',
    reactivity:  'Reactive (like underlying normal rhythm)',
    clinical:    'Not epileptiform; a false-positive mimic. Common misread as focal epileptiform activity after craniotomy.',
    pathological: false,
    color:       '#BFA4FF',
  },

  // ── Artifacts ────────────────────────────────────────────────────────────
  muscle_artifact: {
    id:          'muscle_artifact',
    group:       'artifact',
    label:       'Muscle (EMG) Artifact',
    freq:        '> 30 Hz',
    amplitude:   'Variable',
    morphology:  'High-frequency irregular bursts',
    location:    'Temporal / frontal (scalp muscles)',
    reactivity:  'Attenuated by muscle relaxation',
    clinical:    'Non-cerebral; can obscure underlying EEG activity',
    pathological: false,
    color:       '#888888',
  },

  eye_blink: {
    id:          'eye_blink',
    group:       'artifact',
    label:       'Eye Blink Artifact',
    freq:        '< 1 Hz',
    amplitude:   '100–400 µV',
    morphology:  'Bilateral, frontopolar-maximum positive deflection; fast rise (~70 ms), slow fall (~250 ms)',
    location:    'Fp1, Fp2, F3, F4',
    reactivity:  'Reduced with eyes closed',
    clinical:    'Corneoretinal potential artefact; not cerebral',
    pathological: false,
    color:       '#66AAFF',
  },
}

export const WAVEFORM_GROUPS = {
  background:   { label: 'Background Rhythms',         color: '#00FFB0' },
  sleep:        { label: 'Sleep Features',             color: '#88CCFF' },
  epileptiform: { label: 'Epileptiform Discharges',    color: '#FF4444' },
  periodic:     { label: 'Periodic Patterns',          color: '#FFA552' },
  abnormal:     { label: 'Abnormal Non-Epileptiform',  color: '#FFD166' },
  artifact:     { label: 'Artifacts',                  color: '#888888' },
}

// ─── Demo Signal Generators ──────────────────────────────────────────────────

/**
 * Generate a short demo trace for a given waveform pattern.
 * Returns Float32Array (single channel).
 */
export function generateDemoTrace(patternId, sampleRate = SAMPLE_RATE, options = {}) {
  const { seed = seedFromString(patternId) } = options
  const previousRandom = activeRandom
  if (seed != null) activeRandom = makeRng(seed)

  try {
  const dur      = 3
  const nSamples = dur * sampleRate

  switch (patternId) {

    // ── Background rhythms (waxing/waning) ───────────────────────────────
    case 'alpha': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, {
        centerFreq: 10, bandwidthHz: 1.2, amplitude: 60, nComp: 3,
        envFreq: 0.2, envFloor: 0.35,
      })
      return sig
    }
    case 'beta': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 2)
      addRhythm(sig, sampleRate, {
        centerFreq: 20, bandwidthHz: 6, amplitude: 12, nComp: 5,
        envFreq: 0.35, envFloor: 0.55,
      })
      return sig
    }
    case 'theta': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 5)
      addRhythm(sig, sampleRate, {
        centerFreq: 6, bandwidthHz: 2.0, amplitude: 70, nComp: 3,
        envFreq: 0.15, envFloor: 0.35, envDrift: 0.992,
      })
      addPolymorphicSlow(sig, sampleRate, { amplitude: 18, minFreq: 2.5, maxFreq: 5, nComp: 3 })
      return sig
    }
    case 'delta': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 6)
      addPolymorphicSlow(sig, sampleRate, {
        amplitude: 520, minFreq: 0.6, maxFreq: 3.2, nComp: 7, envFloor: 0.35,
      })
      return sig
    }
    case 'lambda_waves': {
      const sig = new Float32Array(nSamples)
      // Low-voltage, desynchronised eyes-open background.
      addNoise(sig, 2.8)
      addRhythm(sig, sampleRate, {
        centerFreq: 18, bandwidthHz: 7, amplitude: 6, nComp: 4,
        envFreq: 0.3, envFloor: 0.6,
      })
      addRhythm(sig, sampleRate, {
        centerFreq: 9.5, bandwidthHz: 2, amplitude: 5, nComp: 2,
        envFreq: 0.2, envFloor: 0.25,
      })
      ;[0.38, 0.72, 1.27, 1.54, 2.12, 2.58].forEach(t => {
        injectLambdaWave(sig, Math.round(t * sampleRate), sampleRate, {
          amp: 37 + random() * 15,
          durationSec: 0.105 + random() * 0.065,
        })
      })
      return sig
    }
    case 'mu': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addMuRhythm(sig, sampleRate, { freq: 10.1, amp: 36, envFloor: 0.34 })
      // Low central beta gives the Mu run realistic awake background context.
      addRhythm(sig, sampleRate, { centerFreq: 18, bandwidthHz: 5, amplitude: 7, nComp: 2, envFloor: 0.55 })
      return sig
    }
    case 'wicket_rhythm': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, {
        centerFreq: 5.5, bandwidthHz: 1.5, amplitude: 14, nComp: 3,
        envFreq: 0.12, envFloor: 0.4,
      })
      const start = Math.round(0.42 * sampleRate)
      const end = Math.round(2.62 * sampleRate)
      const freq = 8.7
      for (let i = start; i < end; i++) {
        const elapsed = (i - start) / sampleRate
        const duration = (end - start) / sampleRate
        const edge = Math.min(1, elapsed / 0.20, (duration - elapsed) / 0.20)
        const envelope = Math.max(0, edge) * (0.94 + 0.06 * Math.sin(2 * Math.PI * 0.45 * elapsed))
        const phase = 2 * Math.PI * freq * elapsed
        sig[i] += 72 * envelope * (
          Math.sin(phase) + 0.34 * Math.sin(2 * phase + 0.48) + 0.10 * Math.sin(3 * phase + 0.18)
        )
      }
      return sig
    }

    case 'sreda': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, {
        centerFreq: 9.5, bandwidthHz: 2.0, amplitude: 8, nComp: 2,
        envFreq: 0.18, envFloor: 0.35,
      })
      const start = Math.round(0.34 * sampleRate)
      const end = Math.round(2.76 * sampleRate)
      const freq = 6.15
      for (let i = start; i < end; i++) {
        const elapsed = (i - start) / sampleRate
        const remaining = (end - i) / sampleRate
        const envelope = Math.min(1, elapsed / 0.10, remaining / 0.14)
        const phase = 2 * Math.PI * freq * elapsed
        const onsetSharpness = Math.max(0, 1 - elapsed / 0.75)
        sig[i] += 58 * Math.max(0, envelope) * (
          Math.sin(phase) +
          (0.20 + 0.18 * onsetSharpness) * Math.sin(2 * phase + 0.42) +
          0.07 * Math.sin(3 * phase - 0.18)
        )
      }
      return sig
    }
    case 'small_sharp_spikes': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3.2)
      addRhythm(sig, sampleRate, {
        centerFreq: 5.7, bandwidthHz: 1.8, amplitude: 14, nComp: 3,
        envFreq: 0.14, envFloor: 0.42,
      })
      ;[0.48, 1.06, 1.78, 2.42].forEach((time, index) => {
        const center = Math.round(time * sampleRate)
        const polarity = index === 2 ? 1 : -1
        const amp = 30 + random() * 12
        for (let offset = -Math.round(0.025 * sampleRate); offset <= Math.round(0.105 * sampleRate); offset++) {
          const sample = center + offset
          if (sample < 0 || sample >= nSamples) continue
          const dt = offset / sampleRate
          const sharp = Math.exp(-Math.pow((dt - 0.012) / 0.016, 2) * 5.5)
          const returnPhase = Math.exp(-Math.pow((dt - 0.060) / 0.027, 2) * 4.5)
          sig[sample] += polarity * amp * (sharp - 0.34 * returnPhase)
        }
      })
      return sig
    }
    case 'phantom_spike_wave': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, {
        centerFreq: 5.5, bandwidthHz: 1.6, amplitude: 10, nComp: 3,
        envFreq: 0.13, envFloor: 0.38,
      })
      const start = Math.round(0.48 * sampleRate)
      const end = Math.round(2.35 * sampleRate)
      const period = 1 / 6.05
      for (let i = start; i < end; i++) {
        const elapsed = (i - start) / sampleRate
        const remaining = (end - i) / sampleRate
        const envelope = Math.min(1, elapsed / 0.12, remaining / 0.16)
        const cycle = elapsed % period
        const spike = -29 * Math.exp(-Math.pow((cycle - 0.018) / 0.010, 2) * 5.5)
        const wavePosition = (cycle - 0.040) / (period - 0.045)
        const slowWave = wavePosition >= 0 && wavePosition <= 1
          ? 38 * Math.sin(Math.PI * wavePosition)
          : 0
        sig[i] += Math.max(0, envelope) * (spike + slowWave)
      }
      return sig
    }
    case 'central_midline_theta': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, {
        centerFreq: 10, bandwidthHz: 1.8, amplitude: 7, nComp: 2,
        envFreq: 0.18, envFloor: 0.3,
      })
      const start = Math.round(0.10 * sampleRate)
      const end = Math.round(2.95 * sampleRate)
      const frequency = 5.7
      for (let i = start; i < end; i++) {
        const elapsed = (i - start) / sampleRate
        const remaining = (end - i) / sampleRate
        const envelope = Math.min(1, elapsed / 0.42, remaining / 0.42)
        const phase = 2 * Math.PI * frequency * elapsed
        sig[i] += 68 * Math.max(0, envelope) * (
          Math.sin(phase) + 0.10 * Math.sin(2 * phase + 0.35)
        )
      }
      return sig
    }
    case 'positive_spikes_14_6': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, {
        centerFreq: 5.4, bandwidthHz: 1.8, amplitude: 12, nComp: 3,
        envFreq: 0.12, envFloor: 0.4,
      })
      ;[
        { start: 0.35, duration: 0.68, hz: 14.1, amp: 48 },
        { start: 1.62, duration: 0.82, hz: 6.05, amp: 54 },
      ].forEach(run => {
        const start = Math.round(run.start * sampleRate)
        const end = Math.min(nSamples, Math.round((run.start + run.duration) * sampleRate))
        const period = 1 / run.hz
        for (let i = start; i < end; i++) {
          const elapsed = (i - start) / sampleRate
          const remaining = (end - i) / sampleRate
          const envelope = Math.min(1, elapsed / 0.08, remaining / 0.10)
          const phase = (elapsed % period) / period
          const arch = -0.38 * run.amp * Math.sin(Math.PI * phase)
          const positiveSpike = run.amp * Math.exp(-Math.pow((phase - 0.72) / 0.075, 2) * 4.2)
          sig[i] += Math.max(0, envelope) * (arch + positiveSpike)
        }
      })
      return sig
    }
    case 'posterior_slow_waves_youth': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, {
        centerFreq: 9.4, bandwidthHz: 1.2, amplitude: 42, nComp: 3,
        envFreq: 0.2, envFloor: 0.42,
      })
      ;[
        { start: 0.34, duration: 0.92, hz: 2.7, amp: 102 },
        { start: 1.65, duration: 1.02, hz: 3.1, amp: 118 },
      ].forEach(run => {
        const start = Math.round(run.start * sampleRate)
        const end = Math.min(nSamples, Math.round((run.start + run.duration) * sampleRate))
        for (let i = start; i < end; i++) {
          const elapsed = (i - start) / sampleRate
          const remaining = (end - i) / sampleRate
          const envelope = Math.min(1, elapsed / 0.16, remaining / 0.20)
          const phase = 2 * Math.PI * run.hz * elapsed
          const roundedDelta = Math.sin(phase) + 0.12 * Math.sin(2 * phase + 0.35)
          const alphaNotch = 0.16 * Math.sin(2 * Math.PI * 9.4 * elapsed + 0.5)
          sig[i] += Math.max(0, envelope) * run.amp * (roundedDelta + alphaNotch)
        }
      })
      return sig
    }

    // ── Sleep features ───────────────────────────────────────────────────
    case 'vertex_sharp_wave': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 2.5)
      addRhythm(sig, sampleRate, {
        centerFreq: 5.5, bandwidthHz: 2.0, amplitude: 22, nComp: 3,
        envFreq: 0.12, envFloor: 0.45,
      })
      ;[
        { t: 0.55, amp: 118, preShoulder: 0.12, postShoulder: 0.22, riseSec: 0.042, fallSec: 0.074 },
        { t: 1.18, amp: 138, preShoulder: 0.17, postShoulder: 0.25, riseSec: 0.046, fallSec: 0.082 },
        { t: 1.86, amp: 105, preShoulder: 0.08, postShoulder: 0.18, riseSec: 0.039, fallSec: 0.070 },
        { t: 2.48, amp: 128, preShoulder: 0.14, postShoulder: 0.21, riseSec: 0.044, fallSec: 0.078 },
      ].forEach(({ t, amp, ...shape }) =>
        injectVertexSharp(sig, Math.round(t * sampleRate), sampleRate, { amp, ...shape }))
      return sig
    }
    case 'sleep_spindle': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      // Light N2-like background
      addRhythm(sig, sampleRate, { centerFreq: 2, amplitude: 25, nComp: 2, envFloor: 0.5 })
      addRhythm(sig, sampleRate, { centerFreq: 6, amplitude: 20, nComp: 2, envFloor: 0.5 })
      injectSpindle(sig, Math.round(0.5 * sampleRate), { amp: 45, durSec: 1.1, freq: 13 })
      injectSpindle(sig, Math.round(1.9 * sampleRate), { amp: 40, durSec: 0.9, freq: 12.5 })
      return sig
    }
    case 'k_complex': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 1.5, amplitude: 18, nComp: 2, envFloor: 0.45 })
      addRhythm(sig, sampleRate, { centerFreq: 5.2, amplitude: 12, nComp: 2, envFloor: 0.5 })
      // Reuse the sandbox generator with a teaching profile that makes the
      // defining sharp negative phase distinct from the broad positive phase.
      injectKComplex(sig, Math.round(0.82 * sampleRate), sampleRate, {
        amp: 220,
        prePositiveScale: 0.10,
        negativeScale: 0.98,
        positiveScale: 0.64,
        terminalScale: 0.07,
      })
      // K-complex often followed by a sleep spindle
      injectSpindle(sig, Math.round(1.48 * sampleRate), { amp: 28, durSec: 0.82, freq: 13 })
      return sig
    }
    case 'posts': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 2.5, amplitude: 20, nComp: 2, envFloor: 0.5 })
      // POSTS appear in trains at ~4 Hz but each spike is slightly irregular
      // (±10% interval, varying amplitude). Two short trains.
      const trainAt = (start, end, ampMean) => {
        const ibi = 1 / 4
        let t = start
        while (t < end) {
          injectPOSTS(sig, Math.round(t * sampleRate), sampleRate, {
            amp: ampMean + random() * 15,
            riseSec: 0.038 + random() * 0.014,
            fallSec: 0.090 + random() * 0.025,
            shoulder: 0.07 + random() * 0.05,
          })
          t += ibi * (0.90 + random() * 0.20)
        }
      }
      trainAt(0.4, 1.5, 60)
      trainAt(2.0, 2.6, 55)
      return sig
    }

    // ── Epileptiform ─────────────────────────────────────────────────────
    case 'spike': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 10, amplitude: 35, nComp: 2, envFloor: 0.5 })
      ;[0.6, 1.4, 2.2].forEach(t => {
        const at = Math.round(t * sampleRate)
        injectSpike(sig, at, {
          amplitude: 170 + random() * 45,
          duration: 0.04 + random() * 0.015,
          polarity: -1,
          asymmetry: 0.25,
        })
        injectAfterSlowWave(sig, at, sampleRate, {
          amp: 55 + random() * 25,
          delay: 0.05,
          duration: 0.24 + random() * 0.08,
          polarity: 1,
        })
      })
      return sig
    }
    case 'sharp_wave': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 10, amplitude: 35, nComp: 2, envFloor: 0.5 })
      ;[0.7, 1.6, 2.4].forEach(t => {
        const at = Math.round(t * sampleRate)
        injectSharpWave(sig, at, {
          amplitude: 120 + random() * 50,
          duration: 0.095 + random() * 0.045,
          polarity: -1,
          asymmetry: 0.38,
        })
        injectAfterSlowWave(sig, at, sampleRate, {
          amp: 50 + random() * 25,
          delay: 0.09,
          duration: 0.32 + random() * 0.08,
          polarity: 1,
        })
      })
      return sig
    }
    case 'polyspike': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 10, amplitude: 25, nComp: 2, envFloor: 0.4 })
      ;[0.8, 1.8].forEach(t => injectPolyspikeAndSlow(sig, Math.round(t * sampleRate), sampleRate, {
        count: 4 + Math.floor(random() * 2),
        amp: 175 + random() * 45,
      }))
      return sig
    }
    case 'spike_wave': {
      // ~3 Hz generalised spike-and-wave run with realistic timing jitter
      // and slight slowing toward the end of the discharge.
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 9, amplitude: 20, nComp: 2, envFloor: 0.5 })
      const t0 = 0.3, tEnd = dur - 0.4
      let t = t0
      while (t < tEnd) {
        const x    = (t - t0) / (tEnd - t0)
        const freq = 3.4 - 0.6 * x                     // 3.4 → 2.8 Hz
        injectSpikeWaveComplex(sig, Math.round(t * sampleRate), sampleRate, {
          spikeAmp: 170 + 45 * (1 - x),
          slowAmp: 100 + 30 * (1 - x),
          slowDuration: Math.min(0.28, 0.65 / freq),
        })
        t += (1 / freq) * (0.94 + random() * 0.12)
      }
      return sig
    }
    case 'birds': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 7, amplitude: 12, nComp: 2, envFloor: 0.45 })
      const startSec = 0.55
      const endSec = 2.35
      const hz = 6.2
      for (let i = Math.round(startSec * sampleRate); i < Math.round(endSec * sampleRate); i++) {
        const elapsed = i / sampleRate - startSec
        const remaining = endSec - i / sampleRate
        const env = Math.min(1, elapsed / 0.08, remaining / 0.10)
        const phase = TWO_PI * hz * elapsed
        sig[i] += 72 * Math.max(0, env) * (
          Math.sin(phase) + 0.38 * Math.sin(2 * phase + 0.35) + 0.12 * Math.sin(3 * phase - 0.2)
        )
      }
      return sig
    }
    case 'hypsarrhythmia': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 12)
      // Chaotic high-amplitude slow background
      addPolymorphicSlow(sig, sampleRate, { amplitude: 220, minFreq: 0.6, maxFreq: 4.0, nComp: 9, envFloor: 0.12 })
      addRhythm(sig, sampleRate, { centerFreq: 6,   bandwidthHz: 3,   amplitude:  60, nComp: 3, envFloor: 0.2 })
      // Multifocal, asynchronous spikes at random times
      const nSpikes = 18
      for (let k = 0; k < nSpikes; k++) {
        const t = random() * (dur - 0.1)
        const at = Math.round(t * sampleRate)
        const polarity = random() > 0.5 ? -1 : 1
        injectSpike(sig, at, {
          amplitude: 150 + random() * 180,
          duration:  0.04 + random() * 0.08,
          polarity,
        })
      }
      return sig
    }

    // ── Periodic patterns ────────────────────────────────────────────────
    case 'triphasic_waves': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 5)
      // Diffuse theta background (metabolic)
      addRhythm(sig, sampleRate, { centerFreq: 5, amplitude: 25, nComp: 2, envFloor: 0.5 })
      addRhythm(sig, sampleRate, { centerFreq: 2, amplitude: 15, nComp: 2, envFloor: 0.6 })
      // ~1.5 Hz triphasic train with ±12% IBI jitter and amp variability
      const ibiMean = 1 / 1.5
      let t = 0.25
      while (t < dur - ibiMean * 0.5) {
        injectTriphasic(sig, Math.round(t * sampleRate),
          { amp: 130 * (0.85 + random() * 0.30) })
        t += ibiMean * (0.88 + random() * 0.24)
      }
      return sig
    }
    case 'gpds': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 4)
      // Severely suppressed / slow background
      addRhythm(sig, sampleRate, { centerFreq: 2, amplitude: 12, nComp: 2, envFloor: 0.6 })
      // ~1 Hz periodic sharp-and-slow complex with ±12% IBI jitter
      const ibiMean = 1.0
      let t = 0.2
      while (t < dur - ibiMean * 0.5) {
        const ampJ = 0.85 + random() * 0.30
        const s    = Math.round(t * sampleRate)
        injectSharpWave(sig, s,
          { amplitude: 140 * ampJ, duration: 0.12, polarity: -1 })
        injectAfterSlowWave(sig, s, sampleRate, {
          amp: 60 * ampJ,
          delay: 0.09,
          duration: 0.28,
          polarity: 1,
        })
        t += ibiMean * (0.88 + random() * 0.24)
      }
      return sig
    }
    case 'lpds': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 5)
      // Slowed focal background
      addRhythm(sig, sampleRate, { centerFreq: 3, amplitude: 30, nComp: 2, envFloor: 0.5 })
      addRhythm(sig, sampleRate, { centerFreq: 1.5, amplitude: 40, nComp: 2, envFloor: 0.5 })
      // Periodic lateralized sharp complexes ~0.8 Hz with ±15% IBI jitter
      const ibiMean = 1 / 0.8
      let t = 0.15
      while (t < dur - ibiMean * 0.5) {
        const ampJ = 0.85 + random() * 0.30
        const s    = Math.round(t * sampleRate)
        injectSharpWave(sig, s,
          { amplitude: 200 * ampJ, duration: 0.10, polarity: -1 })
        injectAfterSlowWave(sig, s, sampleRate, {
          amp: 85 * ampJ,
          delay: 0.08,
          duration: 0.34,
          polarity: 1,
        })
        t += ibiMean * (0.85 + random() * 0.30)
      }
      return sig
    }

    // ── Abnormal non-epileptiform ────────────────────────────────────────
    case 'focal_slowing': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 6)
      // Polymorphic delta/theta, irregular
      addPolymorphicSlow(sig, sampleRate, { amplitude: 230, minFreq: 0.7, maxFreq: 3.8, nComp: 8, envFloor: 0.25 })
      addRhythm(sig, sampleRate, { centerFreq: 5, bandwidthHz: 2, amplitude: 45,  nComp: 3, envFloor: 0.35 })
      // Minimal alpha — the attenuated side
      addRhythm(sig, sampleRate, { centerFreq: 9, amplitude: 12, nComp: 1, envFloor: 0.5 })
      return sig
    }
    case 'firda': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 4)
      addRhythm(sig, sampleRate, { centerFreq: 7, amplitude: 18, nComp: 2, envFloor: 0.5 })
      // FIRDA bursts — rhythmic 2.5 Hz trains, ~1–2 s each
      const bursts = [
        { t0: 0.3, dur: 1.3 },
        { t0: 2.0, dur: 0.9 },
      ]
      bursts.forEach(({ t0, dur: bDur }) => {
        const s0 = Math.round(t0 * sampleRate)
        const n  = Math.round(bDur * sampleRate)
        const freq = 2.5 + (random() - 0.5) * 0.3
        for (let i = 0; i < n; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          const env = Math.sin(Math.PI * i / n)       // rises and falls
          sig[idx] += 140 * env * Math.sin(2 * Math.PI * freq * i / sampleRate)
        }
      })
      return sig
    }
    case 'burst_suppression': {
      // Realistic pattern: polymorphic bursts (theta/alpha/beta + embedded
      // sharps) with rise/fall envelope, separated by a near-flat floor.
      const sig = new Float32Array(nSamples)
      // Suppression floor — very-low-amplitude noise only
      for (let i = 0; i < nSamples; i++) sig[i] = gauss(0, 2.5)

      // Build each burst on a scratch buffer, envelope it, and insert.
      const bursts = [
        { t0: 0.25, dur: 0.9 },
        { t0: 1.55, dur: 0.7 },
        { t0: 2.55, dur: 0.4 },
      ]

      bursts.forEach(({ t0, dur: bDur }) => {
        const bN    = Math.round(bDur * sampleRate)
        const burst = new Float32Array(bN)
        // Mixed-frequency content
        addNoise(burst, 14)
        addRhythm(burst, sampleRate, {
          centerFreq: 6, bandwidthHz: 3, amplitude: 160, nComp: 3, envFloor: 0.6,
        })
        addRhythm(burst, sampleRate, {
          centerFreq: 12, bandwidthHz: 4, amplitude: 110, nComp: 3, envFloor: 0.6,
        })
        addRhythm(burst, sampleRate, {
          centerFreq: 22, bandwidthHz: 6, amplitude: 55, nComp: 3, envFloor: 0.5,
        })
        // Embed 1–2 sharp transients inside the burst — characteristic of
        // the pattern seen in hypoxic-ischaemic encephalopathy.
        injectSharpWave(burst, Math.round(bN * 0.25),
          { amplitude: 170, duration: 0.09, polarity: -1 })
        if (bN > 0.4 * sampleRate) {
          injectSharpWave(burst, Math.round(bN * 0.65),
            { amplitude: 140, duration: 0.07, polarity: +1 })
        }
        // Envelope: rapid rise, gentle plateau, steeper fall (bursts end abruptly)
        const riseN = Math.round(bN * 0.08)
        const fallN = Math.round(bN * 0.12)
        for (let i = 0; i < bN; i++) {
          const env = i < riseN ? i / riseN
                    : i > bN - fallN ? (bN - i) / fallN
                    : 1
          burst[i] *= env
        }
        // Insert into main signal
        const s0 = Math.round(t0 * sampleRate)
        for (let i = 0; i < bN; i++) {
          const idx = s0 + i
          if (idx >= nSamples) break
          sig[idx] += burst[i]
        }
      })
      return sig
    }
    case 'breach_rhythm': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      // High-amplitude, sharp-contoured beta and alpha — breach accentuates
      // normal rhythms rather than producing abnormal content.
      addArched(sig, sampleRate, { freq: 10, amp: 90, envFreq: 0.2, envFloor: 0.3 })
      addRhythm(sig, sampleRate, {
        centerFreq: 20, bandwidthHz: 8, amplitude: 55, nComp: 3, envFloor: 0.4,
      })
      return sig
    }

    // ── Artifacts ────────────────────────────────────────────────────────
    case 'muscle_artifact': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 10, amplitude: 25, nComp: 2, envFloor: 0.5 })
      injectEmgBurst(sig, sampleRate, { startSec: 0.8, duration: 1.35, amplitude: 120 })
      injectEmgBurst(sig, sampleRate, { startSec: 2.25, duration: 0.45, amplitude: 75 })
      return sig
    }
    case 'eye_blink': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 10, amplitude: 22, nComp: 2, envFloor: 0.5 })
      ;[0.5, 1.5, 2.4].forEach(t =>
        injectEyeBlink(sig, Math.round(t * sampleRate), { amplitude: 280 }))
      return sig
    }
    default: {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 10, amplitude: 50, nComp: 3, envFloor: 0.4 })
      return sig
    }
  }
  } finally {
    if (seed != null) activeRandom = previousRandom
  }
}

/** Inject one surface-positive lambda wave on an eyes-open occipital trace. */
function injectLambdaWave(sig, at, fs = SAMPLE_RATE, {
  amp = 45,
  durationSec = 0.14,
} = {}) {
  const n = Math.max(1, Math.round(durationSec * fs))
  for (let i = 0; i <= n; i++) {
    const idx = at + i
    if (idx < 0 || idx >= sig.length) continue
    const x = i / n
    let value = 0

    if (x < 0.20) value -= amp * 0.10 * Math.sin(Math.PI * x / 0.20)
    if (x >= 0.12 && x < 0.40) {
      value += amp * Math.pow((x - 0.12) / 0.28, 0.72)
    } else if (x >= 0.40 && x < 0.84) {
      value += amp * Math.pow(1 - (x - 0.40) / 0.44, 1.18)
    }
    if (x >= 0.72) value -= amp * 0.08 * Math.sin(Math.PI * (x - 0.72) / 0.28)
    sig[idx] += value
  }
}

