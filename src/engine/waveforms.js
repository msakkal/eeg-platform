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
  generateBackground,
  injectSpike,
  injectSharpWave,
  injectPolyspike,
  injectSpikeAndWave,
  injectMuscleArtifact,
  injectEyeBlink,
  SAMPLE_RATE,
} from './signalGenerator'

// ─── Local helpers ───────────────────────────────────────────────────────────

function gauss(mean = 0, std = 1) {
  const u = 1 - Math.random(), v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Add a narrow-band rhythm with slow (0.1–0.3 Hz) amplitude envelope. */
function addRhythm(sig, fs, {
  centerFreq, bandwidthHz = 1.2, amplitude = 40, nComp = 3,
  envFreq = 0.15 + Math.random() * 0.2, envFloor = 0.3,
}) {
  const envPhase = Math.random() * 2 * Math.PI
  for (let c = 0; c < nComp; c++) {
    const f     = centerFreq + (Math.random() - 0.5) * bandwidthHz
    const ph    = Math.random() * 2 * Math.PI
    const amp   = amplitude * (0.6 + Math.random() * 0.4) / nComp
    for (let i = 0; i < sig.length; i++) {
      const t  = i / fs
      const e  = envFloor + (1 - envFloor) *
                 (0.5 + 0.5 * Math.sin(2 * Math.PI * envFreq * t + envPhase))
      sig[i] += amp * e * Math.sin(2 * Math.PI * f * t + ph)
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

/** Arched (mu-rhythm) oscillation: sinusoid with negative half flattened. */
function addArched(sig, fs, { freq = 10, amp = 40, envFreq = 0.2, envFloor = 0.2 }) {
  const envPhase = Math.random() * 2 * Math.PI
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

/** Inject a vertex sharp wave — negative sharp transient (~150 ms). */
function injectVertexSharp(sig, at, { amp = 120 } = {}) {
  const dur = Math.round(0.15 * SAMPLE_RATE)
  for (let i = -dur; i <= dur; i++) {
    const idx = at + i
    if (idx < 0 || idx >= sig.length) continue
    const t = i / dur
    // Asymmetric sharp: faster rise than fall
    const env = t < 0 ? Math.exp(-Math.pow(t / 0.35, 2) * 4)
                      : Math.exp(-Math.pow(t / 0.55, 2) * 4)
    sig[idx] += -amp * env
  }
}

/** Inject a K-complex: sharp negative then broad positive slow, ≥0.5 s. */
function injectKComplex(sig, at, { amp = 180 } = {}) {
  // Phase 1: sharp negative deflection ~150 ms
  injectSharpWave(sig, at, { amplitude: amp, duration: 0.18, polarity: -1, asymmetry: 0.35 })
  // Phase 2: slower positive wave ~450 ms
  const s2  = at + Math.round(0.12 * SAMPLE_RATE)
  const dur = Math.round(0.45 * SAMPLE_RATE)
  for (let i = 0; i < dur; i++) {
    const idx = s2 + i
    if (idx >= sig.length) break
    sig[idx] += amp * 0.55 * Math.sin(Math.PI * i / dur)
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

/** Inject a POSTS: surface-positive sharp triangular wave (~4 Hz trains). */
function injectPOSTS(sig, at, { amp = 60 } = {}) {
  // Asymmetric triangular: steep rise, slower fall
  const riseN = Math.round(0.04 * SAMPLE_RATE)
  const fallN = Math.round(0.11 * SAMPLE_RATE)
  for (let i = 0; i < riseN + fallN; i++) {
    const idx = at + i
    if (idx >= sig.length) return
    const v = i < riseN ? i / riseN : 1 - (i - riseN) / fallN
    sig[idx] += amp * v                 // positive polarity
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
    amplitude:   '5–30 µV',
    morphology:  'Low amplitude, symmetric, often intermixed with faster rhythms',
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

  mu: {
    id:          'mu',
    group:       'background',
    label:       'Mu Rhythm',
    freq:        '8–12 Hz (alpha range)',
    amplitude:   '20–60 µV',
    morphology:  'Arciform / comb-shaped; asymmetric (sharp negative peaks, rounded positives)',
    location:    'Central, over the rolandic strip (C3/C4)',
    reactivity:  'Attenuates with CONTRALATERAL hand movement or intent to move',
    clinical:    'Normal variant; persistence at rest, unilateral, or asymmetric can be pathological',
    pathological: false,
    color:       '#7FFFD4',
  },

  // ── Sleep features ───────────────────────────────────────────────────────
  vertex_sharp_wave: {
    id:          'vertex_sharp_wave',
    group:       'sleep',
    label:       'Vertex Sharp Wave',
    freq:        'Transient',
    duration:    '100–200 ms',
    amplitude:   '50–250 µV',
    morphology:  'Monophasic (usually negative) sharp transient, symmetrical',
    location:    'Cz maximum; often C3/C4. Symmetric bilaterally',
    reactivity:  'Provoked by arousing stimuli during drowsiness / N1',
    clinical:    'Normal feature of N1–N2 sleep; can appear "spiky" and be misread as epileptiform',
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
    duration:    '≥ 500 ms',
    amplitude:   '100–400 µV',
    morphology:  'Sharp negative wave immediately followed by a broad slow positive wave; often followed by a spindle',
    location:    'Fz/Cz maximum',
    reactivity:  'Spontaneous or evoked by stimuli during N2',
    clinical:    'Defining graphoelement of N2 sleep. Periodic K-complexes can resemble generalised periodic discharges if taken out of context.',
    pathological: false,
    color:       '#9CC9FF',
  },

  posts: {
    id:          'posts',
    group:       'sleep',
    label:       'POSTS',
    freq:        '4–5 Hz (trains)',
    duration:    '~200 ms each',
    amplitude:   '20–75 µV',
    morphology:  'Surface-positive triangular/sharply-contoured waves; steep rising limb',
    location:    'O1 and O2, symmetric',
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
    clinical:    'Classic for hepatic / uraemic / metabolic encephalopathy; also seen post-anoxic, septic, and CJD-related states',
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
export function generateDemoTrace(patternId, sampleRate = SAMPLE_RATE) {
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
      addNoise(sig, 4)
      addRhythm(sig, sampleRate, {
        centerFreq: 20, bandwidthHz: 6, amplitude: 22, nComp: 4,
        envFreq: 0.4, envFloor: 0.45,
      })
      return sig
    }
    case 'theta': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 5)
      addRhythm(sig, sampleRate, {
        centerFreq: 6, bandwidthHz: 2.0, amplitude: 70, nComp: 3,
        envFreq: 0.15, envFloor: 0.4,
      })
      return sig
    }
    case 'delta': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 6)
      addRhythm(sig, sampleRate, {
        centerFreq: 1.8, bandwidthHz: 1.5, amplitude: 130, nComp: 3,
        envFreq: 0.1, envFloor: 0.5,
      })
      return sig
    }
    case 'mu': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 4)
      addArched(sig, sampleRate, { freq: 10, amp: 55, envFreq: 0.15, envFloor: 0.2 })
      // A dusting of background alpha/beta for context
      addRhythm(sig, sampleRate, { centerFreq: 20, amplitude: 10, nComp: 2, envFloor: 0.5 })
      return sig
    }

    // ── Sleep features ───────────────────────────────────────────────────
    case 'vertex_sharp_wave': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 6, amplitude: 25, nComp: 2, envFloor: 0.5 })
      ;[0.6, 1.5, 2.4].forEach(t =>
        injectVertexSharp(sig, Math.round(t * sampleRate), { amp: 140 }))
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
      addRhythm(sig, sampleRate, { centerFreq: 2, amplitude: 25, nComp: 2, envFloor: 0.5 })
      injectKComplex(sig, Math.round(0.9 * sampleRate), { amp: 190 })
      // K-complex often followed by a sleep spindle
      injectSpindle(sig, Math.round(1.55 * sampleRate), { amp: 35, durSec: 0.8, freq: 13 })
      injectKComplex(sig, Math.round(2.3 * sampleRate), { amp: 150 })
      return sig
    }
    case 'posts': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 2.5, amplitude: 20, nComp: 2, envFloor: 0.5 })
      // Train at ~4 Hz from 0.4 s to 1.5 s
      const period = Math.round(sampleRate / 4)
      for (let s = Math.round(0.4 * sampleRate); s < Math.round(1.5 * sampleRate); s += period) {
        injectPOSTS(sig, s, { amp: 60 + Math.random() * 20 })
      }
      // Shorter run later
      for (let s = Math.round(2.0 * sampleRate); s < Math.round(2.6 * sampleRate); s += period) {
        injectPOSTS(sig, s, { amp: 55 + Math.random() * 15 })
      }
      return sig
    }

    // ── Epileptiform ─────────────────────────────────────────────────────
    case 'spike': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 10, amplitude: 35, nComp: 2, envFloor: 0.5 })
      ;[0.6, 1.4, 2.2].forEach(t => {
        const at = Math.round(t * sampleRate)
        injectSpike(sig, at, { amplitude: 180, duration: 0.05 })
        // After-going slow wave
        const sw = at + Math.round(0.05 * sampleRate)
        const swDur = Math.round(0.18 * sampleRate)
        for (let i = 0; i < swDur; i++) {
          const idx = sw + i
          if (idx >= nSamples) break
          sig[idx] += 40 * Math.sin(Math.PI * i / swDur)
        }
      })
      return sig
    }
    case 'sharp_wave': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 10, amplitude: 35, nComp: 2, envFloor: 0.5 })
      ;[0.7, 1.6, 2.4].forEach(t => injectSharpWave(sig, Math.round(t * sampleRate)))
      return sig
    }
    case 'polyspike': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 10, amplitude: 25, nComp: 2, envFloor: 0.4 })
      ;[0.8, 1.8].forEach(t => injectPolyspike(sig, Math.round(t * sampleRate), { count: 5 }))
      return sig
    }
    case 'spike_wave': {
      // Regular 3 Hz generalised spike-and-wave run
      const sig = new Float32Array(nSamples)
      addNoise(sig, 3)
      addRhythm(sig, sampleRate, { centerFreq: 9, amplitude: 20, nComp: 2, envFloor: 0.5 })
      const period = Math.round(sampleRate / 3)
      for (let s = Math.round(0.3 * sampleRate); s < nSamples - period; s += period) {
        injectSpikeAndWave(sig, s, { frequency: 3 })
      }
      return sig
    }
    case 'hypsarrhythmia': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 12)
      // Chaotic high-amplitude slow background
      addRhythm(sig, sampleRate, { centerFreq: 1.2, bandwidthHz: 1.5, amplitude: 140, nComp: 4, envFloor: 0.2 })
      addRhythm(sig, sampleRate, { centerFreq: 3,   bandwidthHz: 2,   amplitude:  90, nComp: 3, envFloor: 0.2 })
      addRhythm(sig, sampleRate, { centerFreq: 6,   bandwidthHz: 3,   amplitude:  60, nComp: 3, envFloor: 0.2 })
      // Multifocal, asynchronous spikes at random times
      const nSpikes = 18
      for (let k = 0; k < nSpikes; k++) {
        const t = Math.random() * (dur - 0.1)
        const at = Math.round(t * sampleRate)
        const polarity = Math.random() > 0.5 ? -1 : 1
        injectSpike(sig, at, {
          amplitude: 150 + Math.random() * 180,
          duration:  0.04 + Math.random() * 0.08,
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
      // ~1.5 Hz triphasic train
      const period = Math.round(sampleRate / 1.5)
      for (let s = Math.round(0.25 * sampleRate); s < nSamples - period; s += period) {
        injectTriphasic(sig, s, { amp: 130 + (Math.random() - 0.5) * 25 })
      }
      return sig
    }
    case 'gpds': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 4)
      // Severely suppressed / slow background
      addRhythm(sig, sampleRate, { centerFreq: 2, amplitude: 12, nComp: 2, envFloor: 0.6 })
      // ~1 Hz periodic sharp-and-slow complex
      const period = Math.round(sampleRate / 1.0)
      for (let s = Math.round(0.2 * sampleRate); s < nSamples - period; s += period) {
        // Sharp component
        injectSharpWave(sig, s, { amplitude: 140, duration: 0.12, polarity: -1 })
        // Brief after-going slow wave
        const swDur = Math.round(0.22 * sampleRate)
        for (let i = 0; i < swDur; i++) {
          const idx = s + Math.round(0.09 * sampleRate) + i
          if (idx >= nSamples) break
          sig[idx] += 55 * Math.sin(Math.PI * i / swDur)
        }
      }
      return sig
    }
    case 'lpds': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 5)
      // Slowed focal background
      addRhythm(sig, sampleRate, { centerFreq: 3, amplitude: 30, nComp: 2, envFloor: 0.5 })
      addRhythm(sig, sampleRate, { centerFreq: 1.5, amplitude: 40, nComp: 2, envFloor: 0.5 })
      // Periodic lateralized sharp complexes ~0.8 Hz
      const period = Math.round(sampleRate / 0.8)
      for (let s = Math.round(0.15 * sampleRate); s < nSamples - period; s += period) {
        injectSharpWave(sig, s, { amplitude: 200, duration: 0.10, polarity: -1 })
        // Smaller follower
        injectSharpWave(sig, s + Math.round(0.07 * sampleRate),
          { amplitude: 70, duration: 0.06, polarity: +1 })
      }
      return sig
    }

    // ── Abnormal non-epileptiform ────────────────────────────────────────
    case 'focal_slowing': {
      const sig = new Float32Array(nSamples)
      addNoise(sig, 6)
      // Polymorphic delta/theta, irregular
      addRhythm(sig, sampleRate, { centerFreq: 2, bandwidthHz: 2, amplitude: 110, nComp: 4, envFloor: 0.3 })
      addRhythm(sig, sampleRate, { centerFreq: 5, bandwidthHz: 2, amplitude: 60,  nComp: 3, envFloor: 0.3 })
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
        const freq = 2.5 + (Math.random() - 0.5) * 0.3
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
      injectMuscleArtifact(sig, Math.round(1.0 * sampleRate), { duration: 1.0, amplitude: 100 })
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
}
