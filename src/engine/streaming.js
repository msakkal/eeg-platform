import { OneShotSeizureOverlay, describeFocalPlan } from './seizures.js'
import { ADDITIONAL_PATTERN_CONFIG, createAdditionalOverlay } from './additionalPatterns.js'

/**
 * Streaming EEG Engine
 * ────────────────────
 * Sample-by-sample analytical synthesis with three architectural
 * improvements over the older buffered `signalGenerator.js`:
 *
 *   1.  Streaming: each channel maintains its own phase accumulators and
 *       computes voltage on demand at clock time `t`. There is no fixed
 *       buffer length and therefore no loop boundary every minute.
 *
 *   2.  Shared-source coherence across ALL bands: alpha is dominated by a
 *       global posterior-dominant rhythm phase (PDR) for occipital/parietal
 *       sites and tapers anteriorly. Beta/theta/delta similarly mix a shared
 *       global driver with each channel's local oscillator, so adjacent
 *       electrodes are highly coherent but not phase-identical.
 *
 *   3.  Pathology overlays compose: each overlay produces an `{overlay,
 *       preserve}` pair per (electrode, time). Several can be active
 *       simultaneously — e.g. diffuse slowing + intermittent FIRDA bursts.
 *
 * Ambient artifacts (slow drift, cardiac pulse, blinks, saccades) are
 * implemented as the same overlay protocol so they layer cleanly with
 * pathology overlays.
 *
 * The streaming engine is used by `useEEGSignal` for the live Sandbox
 * view. Full multi-channel EEG viewers share this same engine; the older
 * buffered `signalGenerator.js` remains in place for the small
 * `generateDemoTrace` calls used by the Waveforms / Findings / Quiz
 * catalogues, which are render-once explanatory snippets rather than full
 * EEG backgrounds.
 */

import { ELECTRODES_1020 } from './signalGenerator.js'
import {
  regionOf,
  blinkField,
  lateralEogField,
  frontocentralGradient,
  bifrontalGradient,
  leftHemisphereGradient,
  cardiacAmpForRegion,
  muGradient,
} from './electrodes.js'
import { isActivationProcedureAllowed } from './patterns.js'

export const SAMPLE_RATE = 256

// ─── Region classification ───────────────────────────────────────────────────
// Electrode definitions and all gradient functions are now in electrodes.js.

// ─── Deterministic PRNG (mulberry32) ─────────────────────────────────────────

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

// ─── Slow stochastic envelope (irregular multi-timescale wax/wane) ──────────
//
// Real alpha amplitude wax/wane is driven by stochastic thalamic processes,
// not by a clean sinusoidal LFO. We approximate the real spectrum by
// cascading three low-pass filters with different time constants on white
// noise — the sum gives ~1/f² (red) envelope variation on timescales from
// fractions of a second to ~10 seconds, which matches what's observed.
// The output is squashed via tanh into a fixed [floor, ceil] amplitude range.

class SlowEnvelope {
  constructor(rng, { floor = 0.35, ceil = 1.0, drive = 0.30, _seed = 0 } = {}) {
    this.rng = rng
    this.floor = floor
    this.ceil  = ceil
    this.drive = drive
    // Three independent low-pass states with different time constants
    // (α=0.0001 → ~10 s, α=0.002 → ~0.5 s, α=0.01 → ~0.1 s @ 256 Hz)
    this.s0 = 0
    this.s1 = 0
    this.s2 = 0
    // Pre-warm to a non-zero value so the envelope doesn't open from 0
    for (let i = 0; i < 4000; i++) this.step()
  }
  step() {
    // Independent white noise samples scale up the integrators so the
    // resulting low-pass output has visible variance.
    const w0 = (this.rng() - 0.5) * 2
    const w1 = (this.rng() - 0.5) * 2
    const w2 = (this.rng() - 0.5) * 2
    this.s0 = 0.9999 * this.s0 + 0.0001 * w0 * 100   // ~10 s timescale
    this.s1 = 0.998  * this.s1 + 0.002  * w1 * 22    // ~0.5 s timescale
    this.s2 = 0.99   * this.s2 + 0.01   * w2 * 10    // ~0.1 s timescale
  }
  value() {
    // Weighted sum favouring the slowest process so the envelope feels
    // organic but multi-scale. Then squash to [floor, ceil] via tanh.
    const raw  = this.s0 * 0.55 + this.s1 * 0.35 + this.s2 * 0.20
    const norm = 0.5 + 0.5 * Math.tanh(raw * this.drive)
    return this.floor + (this.ceil - this.floor) * norm
  }
}

// ─── Mode amplitude tables ──────────────────────────────────────────────────
//
// Per (mode, region) → background band amplitudes A (alpha), B (beta),
// T (theta), D (delta), and pink-noise gain. These are the per-sample
// peak amplitudes the channel's oscillators are scaled to before summing.
//
// Numbers were ported from `signalGenerator.js` where they were embedded
// in per-pattern channel functions, then tightened so amplitudes match
// clinical norms (PDR ~50-70 µV pp at occiput).

function normMode(mode) {
  if (mode === 'awake') return 'normal_awake'
  if (mode === 'drowsy') return 'normal_drowsy'
  if (mode === 'n2') return 'normal_sleep'
  if (mode === 'sws') return 'slow_wave_sleep'
  if (mode === 'rem') return 'normal_rem'
  return mode
}

const _ampsCache = new Map()

function _computeAmps(mode, region, posterior, eyesOpen) {
  const isFrontal = region === 'frontal' || region === 'frontopolar'
  const isCentral = region === 'central'
  const isPosterior = posterior
  const isTemp = region === 'midtemporal' || region === 'posttemporal'

  switch (mode) {
    case 'normal_awake':
      return {
        A: region === 'occipital' ? (eyesOpen ? 4 : 30)
         : region === 'parietal'  ? (eyesOpen ? 3 : 16)
         : region === 'central'   ? 6
         : region === 'frontal'   ? 4 : 5,
        B: region === 'frontal' ? 10 : region === 'central' ? 8 : region === 'temporal' ? 7 : 5,
        T: isTemp ? 4.5 : isPosterior ? 3.5 : 3.0,
        D: isPosterior ? 2.4 : 2.0,
        noiseGain: eyesOpen ? 0.78 : 0.68,
      }
    case 'normal_drowsy':
      return {
        A: isPosterior ? 1.6 : 0.9,
        B: region === 'frontal' ? 1.9 : 1.5,
        T: isTemp ? 16.5 : isCentral ? 15.0 : region === 'parietal' ? 12.5 : region === 'frontal' ? 12.0 : 10.5,
        D: region === 'frontal' ? 4.8 : isCentral ? 4.2 : 3.6,
        noiseGain: 0.50,
      }
    case 'fast_alpha_variant':
      return {
        A: region === 'occipital' ? (eyesOpen ? 4 : 28)
         : region === 'parietal' ? (eyesOpen ? 3 : 15)
         : region === 'central' ? 5 : 3.5,
        B: isFrontal ? 8 : isCentral ? 6 : 4,
        T: isTemp ? 4.5 : 3,
        D: 2,
        noiseGain: eyesOpen ? 0.76 : 0.66,
      }
    case 'mu_rhythm':
      return {
        A: isPosterior ? 3.5 : 2.5,
        B: isFrontal ? 8 : isCentral ? 5 : 4,
        T: isTemp ? 4.5 : 3,
        D: 2,
        noiseGain: 0.66,
      }
    case 'rmtd':
      return {
        // Light drowsiness: fragmented posterior alpha remains visible while
        // low-amplitude mixed theta replaces the slower, theta-dominant N1
        // background. This keeps the focal 5–7 Hz run distinct.
        A: region === 'occipital' ? 10
         : region === 'parietal' ? 6.5
         : isCentral ? 3.0 : 2.0,
        B: isFrontal ? 5.5 : isCentral ? 4.5 : 3.5,
        T: isTemp ? 7.5 : isCentral ? 5.5 : region === 'parietal' ? 4.5 : 4.0,
        D: isFrontal ? 2.8 : 2.2,
        noiseGain: 0.60,
      }
    case 'wicket_rhythm':
      return {
        A: region === 'occipital' ? 8 : region === 'parietal' ? 5 : 2,
        B: isFrontal ? 4.5 : isCentral ? 4 : 3,
        T: isTemp ? 6.5 : isCentral ? 4.5 : 3.5,
        D: isFrontal ? 2.5 : 2,
        noiseGain: 0.58,
      }
    case 'normal_sleep':
      return {
        A: isPosterior ? 1.2 : 0.9,
        B: region === 'frontal' ? 3.0 : isCentral ? 2.6 : 2.2,
        T: isCentral ? 14.0 : isTemp ? 12.4 : 10.5,
        D: region === 'frontal' ? 11.0 : isCentral ? 9.0 : region === 'parietal' ? 7.2 : 6.2,
        noiseGain: 0.62,
      }
    case 'normal_rem':
      return {
        A: isPosterior ? 1.2 : 0.8,
        B: isFrontal ? 5.5 : isCentral ? 4.8 : 3.8,
        T: isTemp ? 12.5 : isFrontal ? 10.5 : isCentral ? 9.5 : 8.5,
        D: isFrontal ? 3.2 : 2.2,
        noiseGain: 0.58,
      }
    case 'slow_wave_sleep':
      return {
        A: 0.5, B: 0.7, T: 1.6,
        D: region === 'frontal' ? 60
         : isCentral ? 50
         : region === 'parietal' ? 38
         : isTemp ? 31 : 26,
        noiseGain: 0.42,
      }
    case 'diffuse_slowing':
      return {
        A: isPosterior ? 3.5 : 1.8,
        B: 3,
        T: isFrontal ? 28 : 22,
        D: isFrontal ? 22 : 14,
        noiseGain: 0.55,
      }
    case 'alpha_coma':
      return {
        A: 0, B: 1.5, T: 2, D: 2,
        noiseGain: 0.36,
      }
    case 'electrocerebral_inactivity':
      return { A: 0, B: 0, T: 0, D: 0, noiseGain: 0.05 }
    default:
      return { A: 6, B: 5, T: 5, D: 3, noiseGain: 0.78 }
  }
}

function modeAmps(mode, region, posterior, eyesOpen) {
  const key = `${normMode(mode)}|${region}|${posterior}|${eyesOpen}`
  if (_ampsCache.has(key)) return _ampsCache.get(key)
  const amps = _computeAmps(normMode(mode), region, posterior, eyesOpen)
  _ampsCache.set(key, amps)
  return amps
}

// Alpha source mixing weight (how much of the channel's alpha comes from the
// shared posterior driver vs the channel's local oscillator). Posterior sites
// are dominated by the global driver → high coherence. Anterior sites mix
// mostly their local oscillator → lower coherence.
function alphaMixFor(mode, region, posterior, eyesOpen) {
  if (mode === 'normal_awake' || mode === 'awake' || mode === 'fast_alpha_variant') {
    if (region === 'occipital') return eyesOpen ? 0.42 : 0.94
    if (region === 'parietal')  return eyesOpen ? 0.24 : 0.68
    if (region === 'central')   return 0.22
    return 0.10
  }
  return 0.14
}

// Beta/theta/delta also mix shared global driver phases with channel-local
// ones, but at lower mix (these rhythms are less spatially coherent than
// alpha in real EEG).
function betaThetaDeltaMix(region) {
  // Region-dependent mix for fast/slow band coherence.
  if (region === 'frontal' || region === 'frontopolar') return 0.30
  if (region === 'central') return 0.25
  return 0.20
}

function muArciformCarrier(phase, harmonic = 0.24) {
  // A smooth fundamental-plus-harmonics model produces the characteristic
  // rounded positive arch and steeper negative vertex without the mechanical
  // look (and excessive high-frequency energy) of a repeated Gaussian notch.
  return Math.sin(phase) +
    harmonic * Math.cos(2 * phase) +
    0.035 * Math.sin(3 * phase + 0.35)
}

function smoothstep(edge0, edge1, value) {
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return x * x * (3 - 2 * x)
}

// ─── Channel ─────────────────────────────────────────────────────────────────

class Channel {
  constructor(name, rng) {
    this.name = name
    this.region = regionOf(name)
    this.posterior = this.region === 'occipital' || this.region === 'parietal'
    // Per-channel phase accumulators (local oscillators)
    this.phAlpha = rng() * 2 * Math.PI
    this.phBeta  = rng() * 2 * Math.PI
    this.phTheta = rng() * 2 * Math.PI
    this.phDelta = rng() * 2 * Math.PI
    // Persistent random frequency offsets — produce inter-channel detuning
    this.alphaOffset = (rng() - 0.5) * 0.8     // ±0.4 Hz
    this.betaOffset  = (rng() - 0.5) * 5.0
    this.thetaOffset = (rng() - 0.5) * 1.0
    this.deltaOffset = (rng() - 0.5) * 0.45
    // Posterior alpha propagation lag (couples shared PDR phase to this
    // channel with a small per-channel offset)
    this.alphaPosteriorLag = (rng() - 0.5) * 0.45
    // FM modulators — slowly walk each channel's center freqs over ~10-20 s
    this.fmAlpha = rng() * 2 * Math.PI
    this.fmBeta  = rng() * 2 * Math.PI
    this.fmTheta = rng() * 2 * Math.PI
    this.fmDelta = rng() * 2 * Math.PI
    // Voss-McCartney pink noise state (3-stage approximation)
    this.b0 = 0; this.b1 = 0; this.b2 = 0
    // Slow drift state (two independent low-freq sinusoids per channel)
    this.driftF1 = 0.05 + rng() * 0.10
    this.driftF2 = 0.15 + rng() * 0.15
    this.driftPh1 = rng() * 2 * Math.PI
    this.driftPh2 = rng() * 2 * Math.PI
    // Per-channel local envelope for alpha — adds a SMALL incoherent slow
    // wax/wane on top of the engine's shared PDR envelope, so adjacent
    // channels' alpha amplitudes track each other strongly but not
    // identically. Tighter range (floor=0.80, ceil=1.20) so the local
    // component contributes per-channel variability rather than dominating.
    this.localAlphaEnv = new SlowEnvelope(rng, { floor: 0.80, ceil: 1.20, drive: 4.0 })
    // Mains (line-noise) interference — small, with slight per-channel
    // amplitude and phase variation so it isn't perfectly identical.
    this.mainsAmp      = 0.7 + rng() * 1.1        // 0.7–1.8 µV
    this.mainsPhaseOff = rng() * 2 * Math.PI
    // Mu rhythm — central rolandic arched ~10 Hz oscillator.
    this.fmMu          = rng() * 2 * Math.PI
    this.muShapePhase  = rng() * 2 * Math.PI
    this.localMuEnv = new SlowEnvelope(rng, { floor: 0.28, ceil: 1.0, drive: 0.85 })
    // Frontotemporal EMG (muscle) haze — one-pole high-pass state.
    this.emgHP   = 0
    this.emgPrev = 0
    this.rng = rng
    this.sampleCount = 0
  }

  // Resolve mode-dependent settings once per output block, not per sample.
  prepare(mode, eyesOpen) {
    if (this.preparedMode === mode && this.preparedEyesOpen === eyesOpen) return
    this.preparedMode = mode
    this.preparedEyesOpen = eyesOpen
    this.amps = modeAmps(mode, this.region, this.posterior, eyesOpen)
    this.alphaMix = alphaMixFor(mode, this.region, this.posterior, eyesOpen)
    this.otherMix = betaThetaDeltaMix(this.region)
  }

  sample(t, opts) {
    const {
      mode,
      pdrPhase,
      pdrEnvelope,
      betaSharedSin,
      thetaSharedSin,
      deltaSharedSin,
      mainsPhase,
      muLeftPhase,
      muRightPhase,
      sampleRate,
      noiseScale = 1,
    } = opts
    const { region, name } = this
    // Advance the per-channel local alpha envelope every 4th sample (64 Hz
    // update rate matching the ~0.1–10 s time constants of the envelope).
    if ((this.sampleCount++ & 3) === 0) {
      this.localAlphaEnv.step()
      this.localMuEnv.step()
    }
    const { A, B, T, D, noiseGain } = this.amps

    // Base center frequencies + persistent offset + slow FM drift
    const alphaCarrier = (mode === 'fast_alpha_variant' ? 16.8
      : mode === 'normal_awake' || mode === 'awake' ? 10 : 9.2)
      + this.alphaOffset
      + 0.18 * Math.sin(2 * Math.PI * 0.08 * t + this.fmAlpha)
    const betaCarrier  = (mode === 'beta' ? 21.5 : 19.0)
      + this.betaOffset
      + 0.9  * Math.sin(2 * Math.PI * 0.10 * t + this.fmBeta)
    const thetaCarrier = (mode === 'normal_drowsy' || mode === 'drowsy' ? 5.8
                         : mode === 'normal_sleep' || mode === 'n2' ? 5.0 : 4.9)
      + this.thetaOffset
      + 0.28 * Math.sin(2 * Math.PI * 0.07 * t + this.fmTheta)
    const deltaCarrier = (mode === 'slow_wave_sleep' || mode === 'sws' ? 1.05
                         : mode === 'normal_sleep' || mode === 'n2' ? 1.45 : 1.3)
      + this.deltaOffset
      + 0.10 * Math.sin(2 * Math.PI * 0.05 * t + this.fmDelta)

    // Advance phase accumulators
    const fA = Math.max(7.5, Math.min(mode === 'fast_alpha_variant' ? 20 : 12.5, alphaCarrier))
    const fB = Math.max(13,  Math.min(30,   betaCarrier))
    const fT = Math.max(3.5, Math.min(7.0,  thetaCarrier))
    const fD = Math.max(0.5, Math.min(3.2,  deltaCarrier))
    this.phAlpha += 2 * Math.PI * fA / sampleRate
    this.phBeta  += 2 * Math.PI * fB / sampleRate
    this.phTheta += 2 * Math.PI * fT / sampleRate
    this.phDelta += 2 * Math.PI * fD / sampleRate

    // Mix shared posterior alpha driver with local oscillator
    const aMix       = this.alphaMix
    const alphaDriv  = Math.sin(pdrPhase + this.alphaPosteriorLag)
    const alphaLocal = Math.sin(this.phAlpha)
    // Apply alpha envelope: the shared posterior-driver contribution waxes
    // and wanes on the GLOBAL pdrEnvelope timescale (so O1 and O2 wax/wane
    // together), while the local oscillator carries its own envelope so the
    // two channels don't track identically. Both envelopes are stochastic
    // (no clean sinusoidal LFO), which gives the trace the irregular
    // "now strong / now fading / now strong again" character of real alpha.
    const localEnv   = this.localAlphaEnv.value()
    const alphaTerm  = aMix * (pdrEnvelope * alphaDriv)
                     + (1 - aMix) * (localEnv * alphaLocal)

    // Lighter mix on other bands — they are less spatially coherent than alpha
    const otherMix   = this.otherMix
    const betaTerm   = otherMix * betaSharedSin  + (1 - otherMix) * Math.sin(this.phBeta)
    const thetaTerm  = otherMix * thetaSharedSin + (1 - otherMix) * Math.sin(this.phTheta)
    const deltaTerm  = otherMix * deltaSharedSin + (1 - otherMix) * Math.sin(this.phDelta)

    let y = A * alphaTerm + B * betaTerm + T * thetaTerm + D * deltaTerm

    // Alpha-coma override: invert the alpha distribution so frontal dominates,
    // and make it nearly monotonous (high envelope floor).
    if (mode === 'alpha_coma') {
      const acAmp =
        region === 'frontopolar' ? 28 :
        region === 'frontal'     ? 26 :
        region === 'central'     ? 18 :
        region === 'midtemporal' ? 13 :
        region === 'parietal'    ? 10 :
        region === 'occipital'   ? 7 : 9
      y += acAmp * Math.sin(pdrPhase + this.alphaPosteriorLag)
    }

    // Pink (1/f) noise — Voss-McCartney 3-stage approximation
    const w = (this.rng() - 0.5) * 2
    this.b0 = 0.99886 * this.b0 + w * 0.0555
    this.b1 = 0.99332 * this.b1 + w * 0.0750
    this.b2 = 0.96900 * this.b2 + w * 0.1538
    const pink = (this.b0 + this.b1 + this.b2 + w * 0.5) * 1.1
    y += noiseScale * noiseGain * 4 * pink

    if (mode === 'electrocerebral_inactivity') return y

    // Slow baseline drift (0.05–0.30 Hz), bigger at temporal/posterior
    const isPostOrTemp = region === 'midtemporal' || region === 'posttemporal' ||
                        region === 'parietal'    || region === 'occipital'
    const driftAmp = isPostOrTemp ? 7 : 3.5
    y += noiseScale * driftAmp * (
      0.7 * Math.sin(2 * Math.PI * this.driftF1 * t + this.driftPh1) +
      0.4 * Math.sin(2 * Math.PI * this.driftF2 * t + this.driftPh2)
    )

    // Mu rhythm — arched (comb-shaped) central rhythm over the rolandic
    // strip. Present in relaxed wakefulness regardless of eye state; the
    // negative peaks are sharp and the positive peaks rounded. It fades out
    // in drowsy/sleep states (no central muscle/rolandic idling there).
    if (mode === 'normal_awake' || mode === 'awake') {
      const muAmp = 9.5 * muGradient(name)
      if (muAmp > 0) {
        const sharedPhase = /[2468]$/.test(name) ? muRightPhase : muLeftPhase
        const phase = sharedPhase + this.alphaPosteriorLag * 0.16 +
          0.10 * Math.sin(2 * Math.PI * 0.06 * t + this.fmMu)
        const harmonic = 0.22 +
          0.025 * Math.sin(2 * Math.PI * 0.17 * t + this.muShapePhase)
        const arched = muArciformCarrier(phase, harmonic)
        const muEnv = this.localMuEnv.value()
        y += muAmp * muEnv * arched
      }

      // Frontalis / temporalis EMG haze — low-level muscle tone always
      // present in the awake state, largest at frontopolar and temporal
      // electrodes. High-passed white noise reads as fast (>~25 Hz) jitter.
      const emgGain = region === 'frontopolar'  ? 3.0
                    : region === 'midtemporal'  ? 3.4
                    : region === 'posttemporal' ? 2.6
                    : region === 'frontal'      ? 2.2
                    : region === 'central'      ? 1.0
                    : 0.5
      const wm = (this.rng() - 0.5) * 2
      this.emgHP   = 0.62 * (this.emgHP + wm - this.emgPrev)
      this.emgPrev = wm
      y += noiseScale * emgGain * this.emgHP
    }

    // Mains line-noise interference (50 Hz) — small. The viewer's notch
    // filter (default 50 Hz) removes it, so the filter visibly does work.
    y += noiseScale * this.mainsAmp * Math.sin(mainsPhase + this.mainsPhaseOff)

    return y
  }
}

// ─── Overlay protocol ───────────────────────────────────────────────────────
//
// An overlay maintains its own per-recording state (event schedules etc.).
// The engine calls `overlay.advance(t)` once per timestep BEFORE sampling
// the channels (so events can be scheduled). Then for each channel, the
// engine calls `overlay.valueFor(channelLabel, t)` to get an
// `{ overlay: µV, preserve: 0..1 }` pair. The channel's voltage is
// computed as `y * preserve + overlay` (chained over all overlays).
//
// Overlays come in two flavours:
//   • Ambient (always-on): blink, saccade, cardiac, drift
//   • Pathology (toggleable, can layer): encephalopathy, FIRDA, GPDs,
//     absence, burst-suppression, …

class CardiacOverlay {
  constructor(rng, hr = 65) {
    this.rng = rng
    this.ibiMean = 60 / hr
    this.nextT = 0.3 + rng() * 0.5
    this.beats = []   // recent beat times (kept ~2 s)
  }
  advance(t) {
    if (t >= this.nextT) {
      this.beats.push(this.nextT)
      this.nextT += this.ibiMean * (0.92 + this.rng() * 0.16)
    }
    // Prune beats older than 2 s
    while (this.beats.length && this.beats[0] < t - 2) this.beats.shift()
  }
  valueFor(label, t) {
    const amp = cardiacAmpForRegion(label)
    if (amp < 1) return { overlay: 0, preserve: 1 }
    const lagS = (regionOf(label) === 'occipital' || regionOf(label) === 'parietal') ? 0.04 : 0
    let o = 0
    for (const beatT of this.beats) {
      const dt = t - (beatT + lagS)
      if (dt < -0.02 || dt > 0.35) continue
      // QRS-like sharp deflection ~ ±25 ms
      const xq = dt / 0.025
      o += amp * Math.exp(-xq * xq * 8) * (1 - 0.5 * xq)
      // T-wave bump ~ 220 ms later, ±70 ms wide
      const xt = (dt - 0.22) / 0.07
      o += amp * 0.3 * Math.exp(-xt * xt * 2.5)
    }
    return { overlay: o, preserve: 1 }
  }
}

class BlinkOverlay {
  constructor(rng, ratePerMin = 18) {
    this.rng = rng
    this.meanIbi = 60 / ratePerMin
    this.nextT = 0.3 + rng() * this.meanIbi
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = {
        t0: this.nextT,
        peak: 180 + this.rng() * 80,
        riseMs: 55 + this.rng() * 30,
        fallMs: 180 + this.rng() * 90,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'blink',
        label: 'Blink',
        detail: 'Eye blink',
      })
      // Gamma(k=2) inter-blink interval
      const u1 = Math.max(1e-6, this.rng())
      const u2 = Math.max(1e-6, this.rng())
      const ibi = -(this.meanIbi / 2) * (Math.log(u1) + Math.log(u2))
      this.nextT += Math.max(0.25, ibi)
    }
    while (this.events.length && this.events[0].t0 + (this.events[0].fallMs + this.events[0].riseMs) / 1000 < t) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    const f = blinkField(label)
    if (f < 0.02) return { overlay: 0, preserve: 1 }
    let o = 0
    for (const ev of this.events) {
      const dt = (t - ev.t0) * 1000  // ms
      if (dt < 0 || dt > ev.riseMs + ev.fallMs) continue
      let v
      if (dt < ev.riseMs) {
        v = Math.sin((Math.PI / 2) * (dt / ev.riseMs))
      } else {
        const k = (dt - ev.riseMs) / ev.fallMs
        v = Math.cos((Math.PI / 2) * k) * Math.exp(-1.1 * k)
      }
      o += ev.peak * f * v
    }
    return { overlay: o, preserve: 1 }
  }
}

class SaccadeOverlay {
  constructor(rng, ratePerMin = 22) {
    this.rng = rng
    this.meanIbi = 60 / ratePerMin
    this.nextT = 0.5 + rng() * this.meanIbi
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = {
        t0: this.nextT,
        peak: 60 + this.rng() * 40,
        durSec: 0.28 + this.rng() * 0.14,
        direction: this.rng() > 0.5 ? +1 : -1,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'saccade',
        label: event.direction > 0 ? 'Right gaze' : 'Left gaze',
        detail: 'Lateral eye movement',
      })
      const u = Math.max(1e-6, this.rng())
      this.nextT += Math.max(0.4, -this.meanIbi * Math.log(u))
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t) this.events.shift()
  }
  valueFor(label, t) {
    let o = 0
    for (const ev of this.events) {
      const f = lateralEogField(label, ev.direction)
      if (Math.abs(f) < 0.05) continue
      const x = (t - ev.t0) / ev.durSec
      if (x < 0 || x > 1) continue
      // Step-and-hold morphology
      const v = x < 0.2 ? x / 0.2
              : x < 0.7 ? 1
              : (1 - x) / 0.3
      o += ev.peak * f * v
    }
    return { overlay: o, preserve: 1 }
  }
}

class SlowRovingEyeMovementOverlay {
  constructor(rng) {
    this.freq = 0.18 + rng() * 0.10
    this.phase = rng() * 2 * Math.PI
    this.envFreq = 0.025 + rng() * 0.035
    this.envPhase = rng() * 2 * Math.PI
    this.amp = 55 + rng() * 28
  }
  advance(/* t */) {}
  valueFor(label, t) {
    const f = lateralEogField(label, 1)
    if (Math.abs(f) < 0.05) return { overlay: 0, preserve: 1 }
    const env = 0.65 + 0.35 * Math.sin(2 * Math.PI * this.envFreq * t + this.envPhase)
    const slow =
      Math.sin(2 * Math.PI * this.freq * t + this.phase) +
      0.18 * Math.sin(2 * Math.PI * this.freq * 2 * t + this.phase * 0.7)
    return { overlay: f * this.amp * env * slow, preserve: 1 }
  }
}

class RapidEyeMovementOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.8 + rng() * 1.4
    this.events = []
    this.direction = rng() > 0.5 ? 1 : -1
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      this.direction *= -1
      const event = {
        t0: this.nextT,
        direction: this.direction,
        amp: 75 + this.rng() * 45,
        durSec: 0.16 + this.rng() * 0.12,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'rapid_eye_movement',
        label: event.direction > 0 ? 'Right gaze' : 'Left gaze',
        detail: event.direction > 0 ? 'Conjugate rightward REM' : 'Conjugate leftward REM',
      })
      this.nextT += 0.35 + this.rng() * 1.15
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.1) this.events.shift()
  }
  valueFor(label, t) {
    let o = 0
    for (const ev of this.events) {
      const field = lateralEogField(label, ev.direction)
      if (Math.abs(field) < 0.04) continue
      const x = (t - ev.t0) / ev.durSec
      if (x < 0 || x > 1) continue
      const shape = x < 0.32
        ? Math.sin((Math.PI / 2) * x / 0.32)
        : Math.cos((Math.PI / 2) * (x - 0.32) / 0.68)
      o += field * ev.amp * shape
    }
    return { overlay: o, preserve: 1 }
  }
}

class MuRhythmEventOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.4 + this.rng() * 1.2
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = {
        t0: this.nextT,
        durSec: 2.4 + this.rng() * 2.4,
        ampJ: 0.84 + this.rng() * 0.22,
        leftAmp: 0.88 + this.rng() * 0.22,
        rightAmp: 0.88 + this.rng() * 0.22,
        centerHz: 8.8 + this.rng() * 1.2,
        sideDeltaHz: (this.rng() - 0.5) * 0.24,
        phase0: this.rng() * 2 * Math.PI,
        rightPhaseLag: (this.rng() - 0.5) * 0.20,
        fmPhase: this.rng() * 2 * Math.PI,
        shapePhase: this.rng() * 2 * Math.PI,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'mu_rhythm',
        label: 'Mu rhythm',
        detail: `Central 8–10 Hz arciform run (${event.durSec.toFixed(1)} s), maximal at C3/C4`,
        durationS: event.durSec,
      })
      this.nextT += event.durSec + 1.5 + this.rng() * 3.0
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) this.events.shift()
  }
  valueFor(label, t) {
    const field = muGradient(label)
    if (field <= 0) return { overlay: 0, preserve: 1 }
    let overlay = 0
    let visibleEnvelope = 0
    for (const event of this.events) {
      const x = (t - event.t0) / event.durSec
      if (x < 0 || x > 1) continue
      const elapsed = t - event.t0
      const taperSec = Math.min(0.72, event.durSec * 0.25)
      const attack = smoothstep(0, taperSec, elapsed)
      const release = 1 - smoothstep(event.durSec - taperSec, event.durSec, elapsed)
      const irregularEnvelope = 1 +
        0.055 * Math.sin(2 * Math.PI * 0.71 * elapsed + event.fmPhase) +
        0.025 * Math.sin(2 * Math.PI * 1.37 * elapsed + event.shapePhase)
      const envelope = attack * release * irregularEnvelope
      visibleEnvelope = Math.max(visibleEnvelope, Math.min(1, envelope))
      const right = /[2468]$/.test(label)
      const frequency = event.centerHz + (right ? event.sideDeltaHz : -event.sideDeltaHz)
      // Integrate a slow sinusoidal frequency modulation analytically so phase
      // remains continuous throughout a run.
      const phase = event.phase0 + (right ? event.rightPhaseLag : 0) +
        2 * Math.PI * frequency * elapsed +
        (0.11 / 0.16) * (
          Math.cos(event.fmPhase) - Math.cos(2 * Math.PI * 0.16 * elapsed + event.fmPhase)
        )
      const harmonic = 0.22 +
        0.025 * Math.sin(2 * Math.PI * 0.21 * elapsed + event.shapePhase)
      const sideAmp = right ? event.rightAmp : event.leftAmp
      overlay += 38 * event.ampJ * sideAmp * field * envelope *
        muArciformCarrier(phase, harmonic)
    }
    return { overlay, preserve: 1 - 0.06 * visibleEnvelope }
  }
}

function lambdaField(label, side, oppositeScale = 0.20) {
  const left = {
    O1: 1.00, O2: oppositeScale,
    P7: 0.38, P3: 0.32, Pz: 0.12,
  }
  const right = {
    O2: 1.00, O1: oppositeScale,
    P8: 0.38, P4: 0.32, Pz: 0.12,
  }
  return (side === 'right' ? right : left)[label] ?? 0
}

function lambdaTransient(dt, duration, amplitude) {
  if (dt < 0 || dt > duration) return 0
  const x = dt / duration
  let value = 0

  // Small leading and terminal opposite-polarity shoulders frame a steep,
  // surface-positive occipital peak without turning it into an epileptiform
  // spike-and-slow-wave complex.
  if (x < 0.20) value -= amplitude * 0.10 * Math.sin(Math.PI * x / 0.20)
  if (x >= 0.12 && x < 0.40) {
    value += amplitude * Math.pow((x - 0.12) / 0.28, 0.72)
  } else if (x >= 0.40 && x < 0.84) {
    value += amplitude * Math.pow(1 - (x - 0.40) / 0.44, 1.18)
  }
  if (x >= 0.72) value -= amplitude * 0.08 * Math.sin(Math.PI * (x - 0.72) / 0.28)
  return value
}

class LambdaWavesOverlay {
  constructor(rng, enabled = true) {
    this.rng = rng
    this.enabled = enabled
    this.nextT = 0.55 + rng() * 1.0
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (!this.enabled) return
    if (t >= this.nextT) {
      const count = 2 + Math.floor(this.rng() * 4)
      const waves = []
      let offset = 0
      const clusterMode = this.rng()
      const dominantSide = this.rng() < 0.5 ? 'left' : 'right'
      for (let i = 0; i < count; i++) {
        const side = clusterMode < 0.42
          ? dominantSide
          : clusterMode < 0.72
            ? (i % 2 === 0 ? dominantSide : (dominantSide === 'left' ? 'right' : 'left'))
            : (this.rng() < 0.5 ? 'left' : 'right')
        waves.push({
          offset,
          side,
          emitted: false,
          oppositeScale: clusterMode < 0.35 ? 0.12 + this.rng() * 0.12 : 0.30 + this.rng() * 0.25,
          duration: 0.105 + this.rng() * 0.070,
          amplitude: 32 + this.rng() * 20,
        })
        offset += 0.22 + this.rng() * 0.42
      }
      const event = {
        t0: this.nextT,
        waves,
        durSec: offset + 0.18,
      }
      this.events.push(event)
      this.nextT += event.durSec + 1.0 + this.rng() * 2.8
    }

    // Annotate each transient at its own onset instead of marking the whole
    // cluster (including the quiet intervals between waves).
    for (const event of this.events) {
      for (const wave of event.waves) {
        const waveT = event.t0 + wave.offset
        if (wave.emitted || t < waveT) continue
        wave.emitted = true
        emitEvent?.({
          t: waveT,
          type: 'lambda_wave',
          label: 'Lambda wave',
          detail: `${wave.side === 'left' ? 'Left' : 'Right'} occipital-positive sharp during visual scanning`,
          durationS: wave.duration,
        })
      }
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    let overlay = 0
    let active = false
    for (const event of this.events) {
      for (const wave of event.waves) {
        const field = lambdaField(label, wave.side, wave.oppositeScale)
        if (field <= 0) continue
        const dt = t - (event.t0 + wave.offset)
        if (dt < 0 || dt > wave.duration) continue
        active = true
        overlay += field * lambdaTransient(dt, wave.duration, wave.amplitude)
      }
    }
    return { overlay, preserve: active ? 0.97 : 1 }
  }
}

function centralMidlineThetaField(label) {
  return ({
    Cz: 1.00,
    Pz: 0.68,
    Fz: 0.52,
    C3: 0.22,
    C4: 0.22,
    P3: 0.14,
    P4: 0.14,
    F3: 0.08,
    F4: 0.08,
  })[label] ?? 0
}

class CentralMidlineThetaOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.45 + rng() * 0.75
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = {
        t0: this.nextT,
        durSec: 3.2 + this.rng() * 2.3,
        frequency: 4.8 + this.rng() * 1.7,
        amplitude: 58 + this.rng() * 24,
        phase: this.rng() * 2 * Math.PI,
        envPhase: this.rng() * 2 * Math.PI,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'central_midline_theta',
        label: 'Central midline theta',
        detail: `${event.frequency.toFixed(1)} Hz non-evolving Cz-maximal midline run`,
        durationS: event.durSec,
      })
      this.nextT += event.durSec + 2.5 + this.rng() * 3.5
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    const field = centralMidlineThetaField(label)
    if (field <= 0) return { overlay: 0, preserve: 1 }
    let overlay = 0
    let visibleEnvelope = 0
    for (const event of this.events) {
      const elapsed = t - event.t0
      if (elapsed < 0 || elapsed > event.durSec) continue
      const taperSec = Math.min(0.9, event.durSec * 0.2)
      const taper = smoothstep(0, taperSec, elapsed) *
        (1 - smoothstep(event.durSec - taperSec, event.durSec, elapsed))
      const envelope = taper * (0.94 + 0.06 * Math.sin(2 * Math.PI * 0.22 * elapsed + event.envPhase))
      const phase = event.phase + 2 * Math.PI * event.frequency * elapsed +
        0.025 * Math.sin(2 * Math.PI * 0.10 * elapsed + event.envPhase)
      const carrier = Math.sin(phase) + 0.10 * Math.sin(2 * phase + 0.35)
      overlay += event.amplitude * field * envelope * carrier
      visibleEnvelope = Math.max(visibleEnvelope, envelope)
    }
    return { overlay, preserve: 1 - 0.05 * Math.min(1, visibleEnvelope) }
  }
}

function rmtdField(label, side) {
  // Compact mid-temporal field. Small anterior/posterior projections retain
  // a visible T7/T8 phase reversal in bipolar chains without making the run
  // look hemispheric or parasagittal.
  const left = { T7: 1.00, P7: 0.27, F7: 0.22, C3: 0.045, A1: 0.05 }
  const right = { T8: 1.00, P8: 0.27, F8: 0.22, C4: 0.045, A2: 0.05 }
  return (side === 'right' ? right : left)[label] ?? 0
}

function rmtdCarrier(phase, notchStrength = 0.22) {
  return Math.sin(phase) +
    notchStrength * Math.sin(2 * phase + 0.55) +
    0.055 * Math.sin(3 * phase - 0.25)
}

class RhythmicMidtemporalThetaOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.55 + rng() * 1.1
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const lateralityRoll = this.rng()
      const laterality = lateralityRoll < 0.40 ? 'left'
        : lateralityRoll < 0.80 ? 'right' : 'bilateral'
      const event = {
        t0: this.nextT,
        durSec: 2.0 + this.rng() * 2.0,
        laterality,
        leftHz: 5.2 + this.rng() * 1.5,
        rightHz: 5.2 + this.rng() * 1.5,
        leftPhase: this.rng() * 2 * Math.PI,
        rightPhase: this.rng() * 2 * Math.PI,
        leftAmp: 27 + this.rng() * 14,
        rightAmp: 27 + this.rng() * 14,
        envPhase: this.rng() * 2 * Math.PI,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'rmtd',
        label: 'Rhythmic mid-temporal theta',
        detail: `${laterality === 'bilateral' ? 'Independent bilateral' : laterality[0].toUpperCase() + laterality.slice(1)} 5–7 Hz non-evolving temporal run`,
        durationS: event.durSec,
      })
      this.nextT += event.durSec + 2.0 + this.rng() * 3.5
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    let overlay = 0
    let visibleEnvelope = 0
    for (const event of this.events) {
      const elapsed = t - event.t0
      if (elapsed < 0 || elapsed > event.durSec) continue
      const taperSec = Math.min(0.65, event.durSec * 0.18)
      const taper = smoothstep(0, taperSec, elapsed) *
        (1 - smoothstep(event.durSec - taperSec, event.durSec, elapsed))
      const envelope = taper * (0.92 +
        0.08 * Math.sin(2 * Math.PI * 0.38 * elapsed + event.envPhase))
      visibleEnvelope = Math.max(visibleEnvelope, envelope)

      for (const side of ['left', 'right']) {
        if (event.laterality !== 'bilateral' && event.laterality !== side) continue
        const field = rmtdField(label, side)
        if (field <= 0) continue
        const frequency = side === 'left' ? event.leftHz : event.rightHz
        const phase0 = side === 'left' ? event.leftPhase : event.rightPhase
        const amplitude = side === 'left' ? event.leftAmp : event.rightAmp
        // Tiny phase modulation prevents a synthetic clock-like trace while
        // retaining the defining lack of ictal frequency evolution.
        const phase = phase0 + 2 * Math.PI * frequency * elapsed +
          0.045 * Math.sin(2 * Math.PI * 0.11 * elapsed + event.envPhase)
        const notch = 0.21 + 0.025 * Math.sin(2 * Math.PI * 0.17 * elapsed + phase0)
        overlay += amplitude * field * envelope * rmtdCarrier(phase, notch)
      }
    }
    return { overlay, preserve: 1 - 0.04 * Math.min(1, visibleEnvelope) }
  }
}

function wicketCarrier(phase) {
  // A narrow crest and broad rounded return create the characteristic
  // arciform "wicket" without an independent after-going slow wave.
  return Math.sin(phase) + 0.34 * Math.sin(2 * phase + 0.48) +
    0.10 * Math.sin(3 * phase + 0.18)
}

class WicketRhythmOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.45 + rng() * 0.8
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const roll = this.rng()
      const laterality = roll < 0.44 ? 'left' : roll < 0.88 ? 'right' : 'bilateral'
      const event = {
        t0: this.nextT,
        durSec: 1.25 + this.rng() * 1.8,
        laterality,
        hz: 7.2 + this.rng() * 2.7,
        phase: this.rng() * 2 * Math.PI,
        amplitude: 32 + this.rng() * 18,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'wicket_rhythm',
        label: 'Wicket rhythm',
        detail: `${laterality === 'bilateral' ? 'Bilateral' : laterality[0].toUpperCase() + laterality.slice(1)} 6–11 Hz arciform temporal train`,
        durationS: event.durSec,
      })
      this.nextT += event.durSec + 1.5 + this.rng() * 3.0
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    let overlay = 0
    let active = 0
    for (const event of this.events) {
      const elapsed = t - event.t0
      if (elapsed < 0 || elapsed > event.durSec) continue
      const taperSec = Math.min(0.34, event.durSec * 0.18)
      const envelope = smoothstep(0, taperSec, elapsed) *
        (1 - smoothstep(event.durSec - taperSec, event.durSec, elapsed))
      active = Math.max(active, envelope)
      for (const side of ['left', 'right']) {
        if (event.laterality !== 'bilateral' && event.laterality !== side) continue
        const field = rmtdField(label, side)
        if (field <= 0) continue
        const sidePhase = side === 'right' ? 0.38 : 0
        overlay += event.amplitude * field * envelope *
          wicketCarrier(event.phase + sidePhase + 2 * Math.PI * event.hz * elapsed)
      }
    }
    return { overlay, preserve: 1 - 0.06 * active }
  }
}

function sredaField(label) {
  // Broad, bilateral posterior temporoparietal field with a modest midline
  // projection. SREDA is usually synchronous, though mild asymmetry is common.
  const field = {
    P7: 1.00, P8: 0.94, T7: 0.86, T8: 0.82,
    P3: 0.78, P4: 0.74, Pz: 0.62,
    O1: 0.48, O2: 0.46, C3: 0.30, C4: 0.28, Cz: 0.22,
    F7: 0.14, F8: 0.13,
  }
  return field[label] ?? 0
}

function sredaCarrier(phase, onsetSharpness) {
  return Math.sin(phase) +
    (0.20 + 0.18 * onsetSharpness) * Math.sin(2 * phase + 0.42) +
    0.07 * Math.sin(3 * phase - 0.18)
}

class SredaOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.55 + rng() * 0.35
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = {
        t0: this.nextT,
        durSec: 7.5 + this.rng() * 4.0,
        hz: 5.5 + this.rng() * 1.1,
        phase: this.rng() * 2 * Math.PI,
        amplitude: 48 + this.rng() * 18,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'sreda',
        label: 'SREDA',
        detail: `Bilateral posterior temporoparietal ${event.hz.toFixed(1)} Hz non-evolving theta run`,
        durationS: event.durSec,
      })
      this.nextT += event.durSec + 4.0 + this.rng() * 5.0
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    const field = sredaField(label)
    if (field <= 0) return { overlay: 0, preserve: 1 }
    let overlay = 0
    let active = 0
    for (const event of this.events) {
      const elapsed = t - event.t0
      if (elapsed < 0 || elapsed > event.durSec) continue
      // The short ramps create SREDA's characteristic relatively abrupt
      // appearance without introducing seizure-like frequency evolution.
      const envelope = smoothstep(0, 0.12, elapsed) *
        (1 - smoothstep(event.durSec - 0.16, event.durSec, elapsed))
      const onsetSharpness = Math.max(0, 1 - elapsed / 1.1)
      const phase = event.phase + 2 * Math.PI * event.hz * elapsed
      overlay += event.amplitude * field * envelope * sredaCarrier(phase, onsetSharpness)
      active = Math.max(active, envelope)
    }
    return { overlay, preserve: 1 - 0.08 * active }
  }
}

function betsField(label, side) {
  const left = { T7: 1.00, F7: 0.62, P7: 0.54, C3: 0.22, A1: 0.16, F3: 0.12, P3: 0.10 }
  const right = { T8: 1.00, F8: 0.62, P8: 0.54, C4: 0.22, A2: 0.16, F4: 0.12, P4: 0.10 }
  return (side === 'right' ? right : left)[label] ?? 0
}

function betsTransient(dt, amplitude, polarity) {
  if (dt < -0.025 || dt > 0.105) return 0
  const sharp = Math.exp(-Math.pow((dt - 0.012) / 0.016, 2) * 5.5)
  const returnPhase = Math.exp(-Math.pow((dt - 0.060) / 0.027, 2) * 4.5)
  return polarity * amplitude * (sharp - 0.34 * returnPhase)
}

class SmallSharpSpikesOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.42 + rng() * 0.35
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const side = this.rng() < 0.5 ? 'left' : 'right'
      const event = {
        t0: this.nextT,
        side,
        amplitude: 27 + this.rng() * 18,
        polarity: this.rng() < 0.84 ? -1 : 1,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'small_sharp_spike',
        label: 'Small sharp spike (BETS)',
        detail: `${side[0].toUpperCase() + side.slice(1)} low-amplitude temporal sleep transient`,
        durationS: 0.13,
      })
      this.nextT += 0.65 + this.rng() * 1.15
    }
    while (this.events.length && this.events[0].t0 < t - 0.16) this.events.shift()
  }
  valueFor(label, t) {
    let overlay = 0
    for (const event of this.events) {
      const field = betsField(label, event.side)
      if (field <= 0) continue
      overlay += field * betsTransient(t - event.t0, event.amplitude, event.polarity)
    }
    // BETS do not attenuate or disrupt the drowsy background.
    return { overlay, preserve: 1 }
  }
}

function phantomSpikeWaveField(label) {
  const field = {
    // Steeper occipital-to-parietal gradient prevents bipolar cancellation
    // while preserving the defining posterior maximum of the FOLD variant.
    O1: 1.00, O2: 0.96, P7: 0.56, P8: 0.53,
    P3: 0.50, P4: 0.47, Pz: 0.44,
    T7: 0.20, T8: 0.19, C3: 0.09, C4: 0.08, Cz: 0.07,
    F3: 0.03, F4: 0.03,
  }
  return field[label] ?? 0
}

function phantomSpikeWaveCycle(cycleTime, period, amplitude) {
  const spike = -amplitude * 0.76 *
    Math.exp(-Math.pow((cycleTime - 0.018) / 0.010, 2) * 5.5)
  const wavePosition = (cycleTime - 0.040) / (period - 0.045)
  const slowWave = wavePosition >= 0 && wavePosition <= 1
    ? amplitude * Math.sin(Math.PI * wavePosition)
    : 0
  return spike + slowWave
}

class PhantomSpikeWaveOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.32 + rng() * 0.28
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = {
        t0: this.nextT,
        durSec: 1.0 + this.rng() * 1.0,
        hz: 5.6 + this.rng() * 0.8,
        amplitude: 48 + this.rng() * 16,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'phantom_spike_wave',
        label: 'Phantom spike-wave',
        detail: `Posterior low-amplitude ${event.hz.toFixed(1)} Hz FOLD-pattern burst`,
        durationS: event.durSec,
      })
      this.nextT += event.durSec + 1.2 + this.rng() * 1.8
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    const field = phantomSpikeWaveField(label)
    if (field <= 0) return { overlay: 0, preserve: 1 }
    let overlay = 0
    for (const event of this.events) {
      const elapsed = t - event.t0
      if (elapsed < 0 || elapsed > event.durSec) continue
      const envelope = smoothstep(0, 0.12, elapsed) *
        (1 - smoothstep(event.durSec - 0.16, event.durSec, elapsed))
      const period = 1 / event.hz
      overlay += field * envelope *
        phantomSpikeWaveCycle(elapsed % period, period, event.amplitude)
    }
    return { overlay, preserve: 1 }
  }
}

function positiveSpikesField(label, side) {
  const left = {
    T7: 1.00, P7: 0.84, O1: 0.58, P3: 0.42,
    C3: 0.18, T8: 0.10, P8: 0.08, A1: 0.04,
  }
  const right = {
    T8: 1.00, P8: 0.84, O2: 0.58, P4: 0.42,
    C4: 0.18, T7: 0.10, P7: 0.08, A2: 0.04,
  }
  return (side === 'left' ? left : right)[label] ?? 0
}

function positiveSpikeCycle(cycleTime, period, amplitude) {
  const phase = cycleTime / period
  const arch = -0.38 * amplitude * Math.sin(Math.PI * phase)
  const spike = amplitude * Math.exp(-Math.pow((phase - 0.72) / 0.075, 2) * 4.2)
  return arch + spike
}

class PositiveSpikes146Overlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.32 + rng() * 0.25
    this.eventIndex = 0
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const isFast = this.eventIndex % 2 === 0
      const event = {
        t0: this.nextT,
        side: this.rng() < 0.5 ? 'left' : 'right',
        durSec: 0.52 + this.rng() * 0.38,
        hz: isFast ? 13.7 + this.rng() * 0.7 : 5.8 + this.rng() * 0.45,
        amplitude: 44 + this.rng() * 18,
      }
      this.events.push(event)
      this.eventIndex += 1
      emitEvent?.({
        t: event.t0,
        type: 'positive_spikes_14_6',
        label: '14 & 6 Hz positive spikes',
        detail: `${event.side[0].toUpperCase() + event.side.slice(1)} posterior-temporal ${event.hz.toFixed(1)} Hz positive-spike burst`,
        durationS: event.durSec,
      })
      this.nextT += event.durSec + 0.85 + this.rng() * 1.15
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    let overlay = 0
    for (const event of this.events) {
      const elapsed = t - event.t0
      if (elapsed < 0 || elapsed > event.durSec) continue
      const field = positiveSpikesField(label, event.side)
      if (field <= 0) continue
      const envelope = smoothstep(0, 0.08, elapsed) *
        (1 - smoothstep(event.durSec - 0.10, event.durSec, elapsed))
      const period = 1 / event.hz
      overlay += field * envelope * positiveSpikeCycle(elapsed % period, period, event.amplitude)
    }
    return { overlay, preserve: 1 }
  }
}

function posteriorSlowWavesYouthField(label) {
  const field = {
    O1: 1.00, O2: 0.96,
    P3: 0.58, P4: 0.56, P7: 0.52, P8: 0.50, Pz: 0.48,
    T7: 0.20, T8: 0.19, C3: 0.16, C4: 0.15, Cz: 0.13,
    F3: 0.05, F4: 0.05, Fz: 0.04,
  }
  return field[label] ?? 0
}

class PosteriorSlowWavesYouthOverlay {
  constructor(rng, eyesOpen = false) {
    this.rng = rng
    this.reactivityScale = eyesOpen ? 0.08 : 1
    this.nextT = 0.38 + rng() * 0.30
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = {
        t0: this.nextT,
        durSec: 0.78 + this.rng() * 0.72,
        hz: 2.4 + this.rng() * 0.9,
        amplitude: 88 + this.rng() * 45,
        phase: this.rng() * 2 * Math.PI,
        alphaPhase: this.rng() * 2 * Math.PI,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'posterior_slow_waves_youth',
        label: 'Posterior slow waves of youth',
        detail: `Bilateral posterior ${event.hz.toFixed(1)} Hz benign slow-wave run with preserved alpha`,
        durationS: event.durSec,
      })
      this.nextT += event.durSec + 0.75 + this.rng() * 1.35
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    const field = posteriorSlowWavesYouthField(label)
    if (field <= 0) return { overlay: 0, preserve: 1 }
    let overlay = 0
    for (const event of this.events) {
      const elapsed = t - event.t0
      if (elapsed < 0 || elapsed > event.durSec) continue
      const taperSec = Math.min(0.20, event.durSec * 0.24)
      const envelope = smoothstep(0, taperSec, elapsed) *
        (1 - smoothstep(event.durSec - taperSec, event.durSec, elapsed))
      const phase = event.phase + 2 * Math.PI * event.hz * elapsed
      const roundedDelta = Math.sin(phase) + 0.12 * Math.sin(2 * phase + 0.35)
      // A small alpha component riding on the slow wave produces the common
      // notched contour while the normal posterior background remains intact.
      const alphaNotch = 0.14 * Math.sin(event.alphaPhase + 2 * Math.PI * 9.4 * elapsed)
      overlay += this.reactivityScale * field * event.amplitude * envelope * (roundedDelta + alphaNotch)
    }
    return { overlay, preserve: 1 }
  }
}

class ActivationProcedureOverlay {
  constructor(kind, rng) {
    this.kind = kind
    this.rng = rng
    this.nextEventT = 0.25
    this.phase = rng() * 2 * Math.PI
    this.flashHz = kind === 'photic_stimulation' ? 12 : 10
  }
  advance(t, emitEvent = null) {
    if (t < this.nextEventT) return
    const meta = {
      hyperventilation: ['hyperventilation', 'Hyperventilation', 'Generalized rhythmic slowing during hyperventilation'],
      photic_stimulation: ['photic_stimulation', 'Photic stimulation', `${this.flashHz} Hz posterior photic driving`],
      photomyogenic_response: ['photomyogenic_response', 'Photomyogenic response', `${this.flashHz} Hz flash-locked frontal muscle response`],
    }[this.kind]
    if (meta) emitEvent?.({ t, type: meta[0], label: meta[1], detail: meta[2] })
    this.nextEventT += 5
  }
  valueFor(label, t) {
    if (this.kind === 'hyperventilation') {
      const region = regionOf(label)
      const field = region === 'frontal' || region === 'frontopolar' ? 1
        : region === 'central' ? 0.78 : region === 'parietal' ? 0.52 : 0.35
      const envelope = 0.62 + 0.38 * Math.sin(2 * Math.PI * 0.055 * t + this.phase)
      return { overlay: field * 28 * envelope * Math.sin(2 * Math.PI * 2.6 * t + this.phase), preserve: 0.93 }
    }
    if (this.kind === 'photic_stimulation') {
      const field = posteriorPhoticField(label)
      return { overlay: field * 24 * Math.sin(2 * Math.PI * this.flashHz * t + this.phase), preserve: 1 }
    }
    if (this.kind === 'photomyogenic_response') {
      const region = regionOf(label)
      const field = region === 'frontopolar' ? 1 : region === 'frontal' ? 0.82 : region === 'midtemporal' ? 0.42 : 0.08
      const flashPhase = ((t * this.flashHz) % 1 + 1) % 1
      const burst = flashPhase < 0.18
        ? Math.sin(Math.PI * flashPhase / 0.18) * Math.sin(2 * Math.PI * 55 * t + this.phase)
        : 0
      return { overlay: field * 52 * burst, preserve: 1 }
    }
    return { overlay: 0, preserve: 1 }
  }
}

// ─── Pathology overlays ─────────────────────────────────────────────────────
//
// Each pathology can be active alongside others. Each returns an
// `{ overlay, preserve }` per (electrode, t). `preserve` < 1 attenuates the
// underlying background (e.g. burst-suppression's near-flat phases).
//
// All field-weight functions are now in electrodes.js (imported at top).

// FIRDA: bifrontal rhythmic delta bursts, intermittent.
class FirdaOverlay {
  constructor(rng) {
    this.rng = rng
    this.phase = rng() * 2 * Math.PI
    this.burstHz = 2.5
    // Burst envelope is a slow gate at ~0.085 Hz, raised power so bursts are
    // discrete (most of the time near zero, then a 2-4 s burst).
    this.gateHz = 0.085
    this.amp = 95
  }
  advance(/* t */) {}
  valueFor(label, t) {
    const w = bifrontalGradient(label)
    if (w < 0.10) return { overlay: 0, preserve: 1 }
    const gate = Math.pow(Math.max(0, Math.sin(2 * Math.PI * this.gateHz * t + this.phase)), 2.6)
    const overlay = w * this.amp * gate * Math.sin(2 * Math.PI * this.burstHz * t + this.phase * 0.5)
    return { overlay, preserve: 1 }
  }
}

// GPDs: bilaterally synchronous ~1 Hz sharp-and-slow complexes.
class GpdsOverlay {
  constructor(rng) {
    this.rng = rng
    this.ibiMean = 1.0
    this.nextT = 0.6
    this.events = []   // {t0, ampJ}
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = { t0: this.nextT, ampJ: 0.85 + this.rng() * 0.30 }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'gpd',
        label: 'GPD',
        detail: 'Generalized periodic discharge',
      })
      this.nextT += this.ibiMean * (0.88 + this.rng() * 0.24)
    }
    while (this.events.length && this.events[0].t0 < t - 0.6) this.events.shift()
  }
  valueFor(label, t) {
    const w = frontocentralGradient(label)
    if (w < 0.05) return { overlay: 0, preserve: 1 }
    let o = 0
    for (const ev of this.events) {
      const dt = t - ev.t0
      if (dt < -0.02 || dt > 0.42) continue
      // Sharp negative ~110 ms, asymmetric
      const xs = (dt - 0.05) / 0.06
      o += -130 * ev.ampJ * w * Math.exp(-xs * xs * 6)
      // After-going slow positive 150-410 ms
      if (dt >= 0.15 && dt <= 0.41) {
        const xw = (dt - 0.15) / 0.26
        o += 70 * ev.ampJ * w * Math.sin(Math.PI * xw)
      }
    }
    return { overlay: o, preserve: 1 }
  }
}

// LPDs: left-lateralised ~1 Hz periodic discharges.
class LpdsOverlay {
  constructor(rng) {
    this.rng = rng
    this.ibiMean = 1.1
    this.nextT = 0.7
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = { t0: this.nextT, ampJ: 0.85 + this.rng() * 0.30 }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'lpd',
        label: 'LPD',
        detail: 'Left periodic discharge',
      })
      this.nextT += this.ibiMean * (0.88 + this.rng() * 0.24)
    }
    while (this.events.length && this.events[0].t0 < t - 0.5) this.events.shift()
  }
  valueFor(label, t) {
    const w = leftHemisphereGradient(label)
    if (w < 0.08) return { overlay: 0, preserve: 1 }
    let o = 0
    for (const ev of this.events) {
      const dt = t - ev.t0
      if (dt < -0.02 || dt > 0.38) continue
      const xs = (dt - 0.04) / 0.05
      o += -120 * ev.ampJ * w * Math.exp(-xs * xs * 7)
      if (dt >= 0.13 && dt <= 0.35) {
        const xw = (dt - 0.13) / 0.22
        o += 55 * ev.ampJ * w * Math.sin(Math.PI * xw)
      }
    }
    return { overlay: o, preserve: 1 }
  }
}

// Absence: 3 Hz spike-and-wave run, frontocentral max, tapers in frequency
// and amplitude across the run (3.4 → 2.6 Hz, ramps in 5%, tapers last 20%).
// Repeat finite teaching runs with normal background between them. A single
// run at t=1..7 is lost during the viewer's 70-second history prefill.
class AbsenceOverlay {
  constructor(rng, durationSec = 6) {
    this.rng = rng
    this.runStart = 1.0
    this.durationSec = durationSec
    this.gapSec = 6
    this.runEnd   = this.runStart + durationSec
    this.events = []
    this.nextT = this.runStart
  }
  advance(t, emitEvent = null) {
    while (t >= this.runEnd + this.gapSec) {
      this.runStart = this.runEnd + this.gapSec
      this.runEnd = this.runStart + this.durationSec
      this.nextT = this.runStart
      this.events.length = 0
    }
    if (t < this.runStart || t >= this.runEnd) return
    if (t >= this.nextT) {
      const event = { t0: this.nextT }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'spike_wave',
        label: 'Spike-wave',
        detail: 'Absence discharge',
      })
      const x = (this.nextT - this.runStart) / (this.runEnd - this.runStart)
      const freq = 3.4 - 0.8 * x
      this.nextT += (1 / freq) * (0.94 + this.rng() * 0.12)
    }
    while (this.events.length && this.events[0].t0 < t - 0.4) this.events.shift()
  }
  valueFor(label, t) {
    const r = regionOf(label)
    const scale = r === 'frontal'     || r === 'central' ? 1.0
                : r === 'frontopolar' ? 0.9
                : r === 'parietal'    ? 0.7
                : r === 'occipital'   ? 0.55
                : r === 'ear'         ? 0.0 : 0.6
    if (scale <= 0) return { overlay: 0, preserve: 1 }
    let o = 0
    for (const ev of this.events) {
      const dt = t - ev.t0
      if (dt < 0 || dt > 0.38) continue
      // Run-position-based amplitude envelope
      const x = (ev.t0 - this.runStart) / (this.runEnd - this.runStart)
      const env = x < 0.05 ? x / 0.05 : x > 0.80 ? (1 - x) / 0.20 : 1
      // Spike (~50 ms negative)
      const xs = (dt - 0.04) / 0.025
      o += -180 * scale * env * Math.exp(-xs * xs * 7)
      // Slow wave (~250 ms)
      if (dt >= 0.06 && dt <= 0.32) {
        const xw = (dt - 0.06) / 0.26
        o += 80 * scale * env * Math.sin(Math.PI * xw)
      }
    }
    return { overlay: o, preserve: 1 }
  }
}

// Burst-suppression: scheduled bursts on a near-flat suppression background.
// Bursts are bilaterally synchronous; suppression attenuates background to 2% to keep the interburst floor below 10 ?V.
class BurstSuppressionOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.2
    this.events = []
    this.burstActive = false
    this.burstUntil = 0
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const burstDur = 0.5 + this.rng() * 1.2
      const event = { t0: this.nextT, durSec: burstDur, ampJ: 0.92 + this.rng() * 0.16 }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'burst',
        label: 'Burst',
        durationS: burstDur,
        detail: 'Burst-suppression burst',
      })
      this.burstUntil = this.nextT + burstDur
      this.nextT += burstDur + 2 + this.rng() * 2
    }
    this.burstActive = this.events.some(ev => t >= ev.t0 && t < ev.t0 + ev.durSec)
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.5) this.events.shift()
  }
  valueFor(label, t) {
    const r = regionOf(label)
    const w = r === 'frontal' || r === 'frontopolar' ? 1.0
            : r === 'central' ? 0.92
            : r === 'parietal' || r === 'midtemporal' || r === 'posttemporal' ? 0.82
            : r === 'occipital' ? 0.70 : 0.4

    let o = 0
    let active = null
    for (const ev of this.events) {
      const dt = t - ev.t0
      if (dt < 0 || dt > ev.durSec) continue
      active = ev
      // Burst content: 6 Hz + 14 Hz mixed bands with rise/fall envelope
      const env = dt < ev.durSec * 0.08 ? dt / (ev.durSec * 0.08)
                : dt > ev.durSec * 0.90 ? (ev.durSec - dt) / (ev.durSec * 0.10)
                : 1
      const carrier =
        90 * Math.sin(2 * Math.PI * 6  * dt) +
        45 * Math.sin(2 * Math.PI * 14 * dt + 0.6) +
        25 * Math.sin(2 * Math.PI * 20 * dt + 1.1)
      o += w * ev.ampJ * env * carrier
    }
    // When NOT in a burst, attenuate background to suppression floor
    const preserve = active ? 1.0 : 0.02
    return { overlay: o, preserve }
  }
}

// ─── Streaming engine ───────────────────────────────────────────────────────

function gaussianPulse(dt, center, width, amp) {
  const x = (dt - center) / width
  return amp * Math.exp(-x * x * 6)
}

function slowHalfSine(dt, start, durSec, amp) {
  if (dt < start || dt > start + durSec) return 0
  return amp * Math.sin(Math.PI * (dt - start) / durSec)
}

function kComplexTransient(dt, amp = 240) {
  let v = 0

  if (dt >= -0.070 && dt < 0.010) {
    const x = (dt + 0.070) / 0.080
    v += amp * 0.10 * Math.sin(Math.PI * x)
  }
  if (dt >= 0 && dt <= 0.105) {
    const x = dt / 0.105
    const sharp = x < 0.45 ? x / 0.45 : (1 - x) / 0.55
    v += -amp * 0.48 * Math.max(0, sharp)
  }
  if (dt >= 0.100 && dt <= 0.720) {
    const x = (dt - 0.100) / 0.620
    v += amp * Math.pow(Math.sin(Math.PI * x), 1.08)
  }
  if (dt >= 0.660 && dt <= 0.980) {
    const x = (dt - 0.660) / 0.320
    v += -amp * 0.16 * Math.sin(Math.PI * x)
  }

  return v
}

function sharpSlow(dt, {
  sharpAmp = -130,
  sharpCenter = 0.045,
  sharpWidth = 0.030,
  slowAmp = 65,
  slowStart = 0.10,
  slowDur = 0.28,
} = {}) {
  return gaussianPulse(dt, sharpCenter, sharpWidth, sharpAmp) +
    slowHalfSine(dt, slowStart, slowDur, slowAmp)
}

function polyspikeWave(dt, {
  amp = 120,
  count = 3,
  spacing = 0.022,
  slowAmp = 60,
} = {}) {
  let o = 0
  for (let i = 0; i < count; i++) {
    o += gaussianPulse(dt, 0.025 + i * spacing, 0.012, -amp * (1 - i * 0.12))
    o += gaussianPulse(dt, 0.038 + i * spacing, 0.014, amp * 0.36)
  }
  o += slowHalfSine(dt, 0.10, 0.18, slowAmp)
  return o
}

function hemisphereOf(label) {
  if (label.endsWith('1') || ['F7', 'T7', 'P7', 'C3', 'F3', 'P3', 'O1', 'A1'].includes(label)) return 'left'
  if (label.endsWith('2') || ['F8', 'T8', 'P8', 'C4', 'F4', 'P4', 'O2', 'A2'].includes(label)) return 'right'
  if (label.endsWith('z')) return 'midline'
  return 'midline'
}

function leftTemporalField(label) {
  const map = {
    T7: 1.00, F7: 0.82, P7: 0.76,
    F3: 0.42, C3: 0.42, P3: 0.35,
    Fp1: 0.24, O1: 0.20,
    Fz: 0.12, Cz: 0.10, Pz: 0.08,
    A1: 0.06,
  }
  return map[label] ?? 0
}

function breachField(label) {
  const map = {
    C3: 1.00, T7: 0.90,
    F3: 0.75, P3: 0.65,
    F7: 0.45, P7: 0.45,
    Cz: 0.22, Fz: 0.12, Pz: 0.12,
  }
  return map[label] ?? 0
}

function centrotemporalField(side, label) {
  const left = {
    C3: 1.00, T7: 0.95, P7: 0.55, P3: 0.45, Cz: 0.35,
    F3: -0.65, Fp1: -0.45, F7: -0.35,
  }
  const right = {
    C4: 1.00, T8: 0.95, P8: 0.55, P4: 0.45, Cz: 0.35,
    F4: -0.65, Fp2: -0.45, F8: -0.35,
  }
  return side === 'left' ? (left[label] ?? 0) : (right[label] ?? 0)
}

function posteriorPhoticField(label) {
  const map = {
    O1: 1.00, O2: 1.00,
    P3: 0.66, P4: 0.66, Pz: 0.60,
    P7: 0.38, P8: 0.38,
  }
  return map[label] ?? 0
}

function sleepSpindleField(label) {
  const map = {
    Cz: 1.00, Fz: 0.92, C3: 0.78, C4: 0.78,
    F3: 0.52, F4: 0.52, Pz: 0.50, P3: 0.36, P4: 0.36,
    T7: 0.24, T8: 0.24, F7: 0.18, F8: 0.18,
  }
  return map[label] ?? 0
}

function kComplexField(label) {
  const map = {
    Fz: 1.00, Cz: 0.92, F3: 0.78, F4: 0.78,
    Fp1: 0.62, Fp2: 0.62, C3: 0.58, C4: 0.58,
    Pz: 0.38, P3: 0.25, P4: 0.25, F7: 0.32, F8: 0.32,
  }
  return map[label] ?? 0
}

function vertexWaveField(label) {
  const map = {
    Cz: 1.00, C3: 0.76, C4: 0.76,
    Fz: 0.66, Pz: 0.54,
    F3: 0.34, F4: 0.34, P3: 0.30, P4: 0.30,
    T7: 0.14, T8: 0.14,
  }
  return map[label] ?? 0
}

function postsField(label) {
  const map = {
    O1: 1.00, O2: 1.00,
    P3: 0.44, P4: 0.44, Pz: 0.36,
    P7: 0.30, P8: 0.30,
  }
  return map[label] ?? 0
}

function smoothStep01(x) {
  const u = Math.max(0, Math.min(1, x))
  return u * u * (3 - 2 * u)
}

function vertexWaveTransient(dt, amp = 105) {
  let v = 0
  if (dt >= -0.12 && dt < -0.055) {
    const x = (dt + 0.12) / 0.065
    v += amp * 0.18 * Math.sin(Math.PI * x)
  }
  if (dt >= -0.06 && dt <= 0) {
    v += -amp * smoothStep01((dt + 0.06) / 0.06)
  } else if (dt > 0 && dt <= 0.13) {
    v += -amp * (1 - smoothStep01(dt / 0.13))
  }
  if (dt > 0.075 && dt <= 0.22) {
    const x = (dt - 0.075) / 0.145
    v += amp * 0.28 * Math.sin(Math.PI * x)
  }
  return v
}

function postsTransient(dt, amp = 58) {
  const preEnd = 0.025
  const peakAt = 0.070
  const returnAt = 0.175
  const endAt = 0.205
  if (dt < 0 || dt > endAt) return 0

  if (dt < preEnd) {
    return -amp * 0.10 * Math.sin(Math.PI * dt / preEnd)
  }
  if (dt < peakAt) {
    const x = (dt - preEnd) / (peakAt - preEnd)
    return amp * Math.pow(x, 0.78)
  }
  if (dt < returnAt) {
    const x = (dt - peakAt) / (returnAt - peakAt)
    return amp * Math.pow(1 - x, 1.18)
  }

  const x = (dt - returnAt) / (endAt - returnAt)
  return -amp * 0.065 * Math.sin(Math.PI * x)
}

function regionLagSeconds(label) {
  switch (regionOf(label)) {
    case 'frontopolar': return 0.000
    case 'frontal': return 0.025
    case 'central':
    case 'midtemporal': return 0.060
    case 'parietal': return 0.095
    case 'posttemporal': return 0.105
    case 'occipital': return 0.120
    default: return 0.070
  }
}

function multifocalField(focus, label) {
  if (label === focus) return 1
  if (regionOf(label) === 'ear') return 0

  const focusRegion = regionOf(focus)
  const labelRegion = regionOf(label)
  const focusHem = hemisphereOf(focus)
  const labelHem = hemisphereOf(label)

  if (focusHem === labelHem && focusRegion === labelRegion) return 0.55
  if (labelHem === 'midline') return 0.28
  if (focusHem === labelHem) return 0.32
  if (focusRegion === labelRegion) return 0.18
  return 0.08
}

class N2SleepGraphoelementsOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextSpindleT = 0.9 + rng() * 2.2
    this.nextKComplexT = 2.0 + rng() * 5.5
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextSpindleT) {
      const event = {
        kind: 'spindle',
        t0: this.nextSpindleT,
        durSec: 0.65 + this.rng() * 0.85,
        freq: 12.2 + this.rng() * 2.0,
        ampJ: 0.80 + this.rng() * 0.40,
        phase: this.rng() * 2 * Math.PI,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'sleep_spindle',
        label: 'Spindle',
        detail: 'N2 sleep spindle',
      })
      this.nextSpindleT += 3.4 + this.rng() * 5.2
    }

    if (t >= this.nextKComplexT) {
      const event = {
        kind: 'k_complex',
        t0: this.nextKComplexT,
        ampJ: 0.85 + this.rng() * 0.35,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'k_complex',
        label: 'K-complex',
        detail: 'N2 K-complex',
      })
      if (this.rng() < 0.65) {
        const linkedSpindleT = event.t0 + 0.58 + this.rng() * 0.20
        this.nextSpindleT = Math.min(this.nextSpindleT, linkedSpindleT)
      }
      this.nextKComplexT += 7.0 + this.rng() * 8.0
    }

    while (this.events.length) {
      const ev = this.events[0]
      const tailSec = ev.kind === 'spindle' ? ev.durSec : 1.05
      if (ev.t0 + tailSec >= t - 0.2) break
      this.events.shift()
    }
  }
  valueFor(label, t) {
    let o = 0
    let active = false
    for (const ev of this.events) {
      const dt = t - ev.t0
      if (ev.kind === 'spindle') {
        if (dt < 0 || dt > ev.durSec) continue
        const w = sleepSpindleField(label)
        if (w < 0.05) continue
        active = true
        const env = Math.sin(Math.PI * dt / ev.durSec)
        o += w * ev.ampJ * 34 * env * Math.sin(2 * Math.PI * ev.freq * dt + ev.phase)
      } else if (ev.kind === 'k_complex') {
        if (dt < -0.08 || dt > 1.02) continue
        const w = kComplexField(label)
        if (w < 0.05) continue
        active = true
        o += w * ev.ampJ * kComplexTransient(dt, 245)
      }
    }
    return { overlay: o, preserve: active ? 0.97 : 1 }
  }
}

class N1SleepGraphoelementsOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextVertexT = 0.7 + rng() * 1.4
    this.nextPostsT = 1.8 + rng() * 2.4
    this.events = []
  }

  advance(t, emitEvent = null) {
    if (t >= this.nextVertexT) {
      const event = {
        kind: 'vertex',
        t0: this.nextVertexT,
        ampJ: 0.86 + this.rng() * 0.32,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'vertex_wave',
        label: 'Vertex wave',
        detail: 'N1 vertex sharp wave',
      })
      this.nextVertexT += 2.2 + this.rng() * 3.4
    }

    if (t >= this.nextPostsT) {
      const event = {
        kind: 'posts',
        t0: this.nextPostsT,
        count: 3 + Math.floor(this.rng() * 3),
        interval: 0.20 + this.rng() * 0.045,
        ampJ: 0.82 + this.rng() * 0.30,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'posts',
        label: 'POSTS',
        detail: 'Positive occipital sharp transients of sleep',
      })
      this.nextPostsT += 5.5 + this.rng() * 6.0
    }

    while (this.events.length) {
      const ev = this.events[0]
      const tailSec = ev.kind === 'posts'
        ? (ev.count - 1) * ev.interval + 0.23
        : 0.28
      if (ev.t0 + tailSec >= t - 0.2) break
      this.events.shift()
    }
  }

  valueFor(label, t) {
    let o = 0
    let active = false
    let preserve = 1

    for (const ev of this.events) {
      if (ev.kind === 'vertex') {
        const w = vertexWaveField(label)
        if (w < 0.05) continue
        const dt = t - ev.t0
        if (dt < -0.13 || dt > 0.23) continue
        active = true
        preserve = Math.min(preserve, 0.97)
        o += w * ev.ampJ * vertexWaveTransient(dt, 104)
      } else if (ev.kind === 'posts') {
        const w = postsField(label)
        if (w < 0.05) continue
        for (let k = 0; k < ev.count; k++) {
          const dt = t - (ev.t0 + k * ev.interval)
          if (dt < 0 || dt > 0.205) continue
          active = true
          preserve = Math.min(preserve, 0.92)
          o += w * ev.ampJ * postsTransient(dt, 58)
        }
      }
    }

    return { overlay: o, preserve: active ? preserve : 1 }
  }
}

class FocalSlowingOverlay {
  constructor(rng) {
    this.phaseDelta = rng() * 2 * Math.PI
    this.phaseTheta = rng() * 2 * Math.PI
    this.phaseEnv = rng() * 2 * Math.PI
  }
  advance(/* t */) {}
  valueFor(label, t) {
    const w = leftTemporalField(label)
    if (w < 0.05) return { overlay: 0, preserve: 1 }
    const env = 0.82 + 0.18 * Math.sin(2 * Math.PI * 0.075 * t + this.phaseEnv)
    const slow = 48 * Math.sin(2 * Math.PI * 1.7 * t + this.phaseDelta) +
      22 * Math.sin(2 * Math.PI * 4.2 * t + this.phaseTheta)
    return { overlay: w * env * slow, preserve: 1 - 0.25 * w }
  }
}

class SlowSpikeWaveOverlay {
  constructor(rng) {
    this.rng = rng
    this.ibiMean = 0.52
    this.nextT = 0.35
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = { t0: this.nextT, ampJ: 0.86 + this.rng() * 0.28 }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'slow_spike_wave',
        label: 'Slow S/W',
        detail: 'Slow spike-and-wave complex',
      })
      this.nextT += this.ibiMean * (0.86 + this.rng() * 0.28)
    }
    while (this.events.length && this.events[0].t0 < t - 0.7) this.events.shift()
  }
  valueFor(label, t) {
    const w = frontocentralGradient(label)
    if (w < 0.05) return { overlay: 0, preserve: 1 }
    let o = 0
    let active = false
    for (const ev of this.events) {
      const dt = t - ev.t0
      if (dt < -0.02 || dt > 0.52) continue
      active = true
      o += w * ev.ampJ * sharpSlow(dt, {
        sharpAmp: -115,
        sharpCenter: 0.050,
        sharpWidth: 0.035,
        slowAmp: 82,
        slowStart: 0.12,
        slowDur: 0.36,
      })
    }
    return { overlay: o, preserve: active ? 0.94 : 1 }
  }
}

class PolyspikeJmeOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.8
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const durSec = 0.65 + this.rng() * 0.35
      const event = {
        t0: this.nextT,
        durSec,
        ampJ: 0.88 + this.rng() * 0.26,
        hz: 3.8 + this.rng() * 0.9,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'polyspike',
        label: 'Polyspike',
        detail: 'JME polyspike-wave run',
      })
      this.nextT += durSec + 2.6 + this.rng() * 3.4
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.3) this.events.shift()
  }
  valueFor(label, t) {
    const w = frontocentralGradient(label)
    if (w < 0.05) return { overlay: 0, preserve: 1 }
    let o = 0
    let active = false
    for (const ev of this.events) {
      const dt = t - ev.t0
      if (dt < 0 || dt > ev.durSec) continue
      active = true
      const env = Math.sin(Math.PI * dt / ev.durSec)
      const cycle = 1 / ev.hz
      const inCycle = dt % cycle
      if (inCycle <= 0.26) {
        o += w * ev.ampJ * env * polyspikeWave(inCycle, {
          amp: 145,
          count: 3 + Math.floor(ev.ampJ * 2),
          slowAmp: 55,
        })
      }
    }
    return { overlay: o, preserve: active ? 0.92 : 1 }
  }
}

class CentrotemporalSpikesOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.7
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = {
        t0: this.nextT,
        side: this.rng() > 0.48 ? 'left' : 'right',
        ampJ: 0.82 + this.rng() * 0.34,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'centrotemporal_spike',
        label: 'Rolandic spike',
        detail: `${event.side === 'left' ? 'Left' : 'Right'} centrotemporal spike`,
      })
      const u = Math.max(1e-6, this.rng())
      this.nextT += 0.55 + -1.4 * Math.log(u)
    }
    while (this.events.length && this.events[0].t0 < t - 0.45) this.events.shift()
  }
  valueFor(label, t) {
    let o = 0
    let active = false
    for (const ev of this.events) {
      const w = centrotemporalField(ev.side, label)
      if (Math.abs(w) < 0.05) continue
      const dt = t - ev.t0
      if (dt < -0.02 || dt > 0.34) continue
      active = true
      o += w * ev.ampJ * sharpSlow(dt, {
        sharpAmp: -155,
        sharpCenter: 0.040,
        sharpWidth: 0.024,
        slowAmp: 56,
        slowStart: 0.095,
        slowDur: 0.22,
      })
    }
    return { overlay: o, preserve: active ? 0.96 : 1 }
  }
}

class TemporalSharpsOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.9
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = { t0: this.nextT, ampJ: 0.82 + this.rng() * 0.30 }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'sharp_wave',
        label: 'Sharp wave',
        detail: 'Left temporal sharp wave',
      })
      const u = Math.max(1e-6, this.rng())
      this.nextT += 1.15 + -1.0 * Math.log(u)
    }
    while (this.events.length && this.events[0].t0 < t - 0.42) this.events.shift()
  }
  valueFor(label, t) {
    const w = leftTemporalField(label)
    if (w < 0.05) return { overlay: 0, preserve: 1 }
    let o = 0
    let active = false
    for (const ev of this.events) {
      const dt = t - ev.t0
      if (dt < -0.02 || dt > 0.34) continue
      active = true
      o += w * ev.ampJ * sharpSlow(dt, {
        sharpAmp: -135,
        sharpCenter: 0.042,
        sharpWidth: 0.025,
        slowAmp: 52,
        slowStart: 0.095,
        slowDur: 0.20,
      })
    }
    return { overlay: o, preserve: active ? 0.96 : 1 }
  }
}

// BIRDs: brief (> 4 Hz, 0.5 to < 10 s) potentially ictal rhythmic runs.
// This teaching example uses recurrent, sharply contoured left-temporal 6 Hz
// activity with abrupt boundaries and no simulated clinical correlate.
class BirdsOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.8
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = {
        t0: this.nextT,
        durSec: 1.4 + this.rng() * 1.5,
        hz: 5.5 + this.rng() * 1.5,
        ampJ: 0.86 + this.rng() * 0.28,
        phase: this.rng() * 2 * Math.PI,
      }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'birds',
        label: 'BIRDs',
        detail: `Left temporal ${event.hz.toFixed(1)} Hz brief rhythmic discharge`,
      })
      this.nextT += event.durSec + 3.0 + this.rng() * 3.5
    }
    while (this.events.length && this.events[0].t0 + this.events[0].durSec < t - 0.2) {
      this.events.shift()
    }
  }
  valueFor(label, t) {
    const w = leftTemporalField(label)
    if (w < 0.05) return { overlay: 0, preserve: 1 }
    let o = 0
    let active = false
    for (const ev of this.events) {
      const dt = t - ev.t0
      if (dt < 0 || dt >= ev.durSec) continue
      active = true
      const edge = Math.min(1, dt / 0.07, (ev.durSec - dt) / 0.09)
      const phase = ev.phase + 2 * Math.PI * ev.hz * dt
      const shaped = Math.sin(phase) +
        0.38 * Math.sin(2 * phase + 0.35) +
        0.12 * Math.sin(3 * phase - 0.2)
      o += 82 * w * ev.ampJ * Math.max(0, edge) * shaped
    }
    return { overlay: o, preserve: active ? 0.82 : 1 }
  }
}

class HypsarrhythmiaOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.25
    this.events = []
    this.focuses = ['Fp1', 'F3', 'C3', 'T7', 'P7', 'P3', 'O1', 'Fp2', 'F4', 'C4', 'T8', 'P8', 'P4', 'O2', 'Pz']
    this.states = {}
    for (const label of ELECTRODES_1020) {
      this.states[label] = {
        f1: 0.85 + rng() * 1.05,
        f2: 2.0 + rng() * 1.7,
        f3: 4.0 + rng() * 2.4,
        p1: rng() * 2 * Math.PI,
        p2: rng() * 2 * Math.PI,
        p3: rng() * 2 * Math.PI,
        amp: 0.75 + rng() * 0.55,
      }
    }
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const focus = this.focuses[Math.floor(this.rng() * this.focuses.length)]
      const event = { t0: this.nextT, focus, ampJ: 0.75 + this.rng() * 0.55 }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'multifocal_spike',
        label: 'Multifocal spike',
        detail: `Hypsarrhythmia focus ${focus}`,
      })
      this.nextT += 0.18 + this.rng() * 0.42
    }
    while (this.events.length && this.events[0].t0 < t - 0.45) this.events.shift()
  }
  valueFor(label, t) {
    if (regionOf(label) === 'ear') return { overlay: 0, preserve: 1 }
    const s = this.states[label]
    const env = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.07 * t + s.p3)
    let o = s.amp * env * (
      58 * Math.sin(2 * Math.PI * s.f1 * t + s.p1) +
      34 * Math.sin(2 * Math.PI * s.f2 * t + s.p2) +
      18 * Math.sin(2 * Math.PI * s.f3 * t + s.p3)
    )
    for (const ev of this.events) {
      const w = multifocalField(ev.focus, label)
      if (w < 0.05) continue
      const dt = t - ev.t0
      if (dt < -0.02 || dt > 0.34) continue
      o += w * ev.ampJ * sharpSlow(dt, {
        sharpAmp: -170,
        sharpCenter: 0.035,
        sharpWidth: 0.022,
        slowAmp: 50,
        slowStart: 0.085,
        slowDur: 0.22,
      })
    }
    return { overlay: o, preserve: 0.55 }
  }
}

class PhotoparoxysmalOverlay {
  constructor(rng) {
    this.rng = rng
    this.cycleSec = 8
    this.pprStart = 2.5
    this.pprEnd = 6.5
    this.driveStart = 0.8
    this.driveEnd = 4.2
    this.nextT = this.pprStart
    this.events = []
    this.phase = rng() * 2 * Math.PI
  }
  advance(t, emitEvent = null) {
    const p = t % this.cycleSec
    if (p < this.pprStart) {
      this.nextT = Math.max(this.nextT, t + (this.pprStart - p))
    }
    if (p >= this.pprStart && p <= this.pprEnd && t >= this.nextT) {
      const event = { t0: this.nextT, ampJ: 0.90 + this.rng() * 0.25 }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'photoparoxysmal',
        label: 'PPR',
        detail: 'Photoparoxysmal spike-wave',
      })
      this.nextT += (1 / (4.1 + this.rng() * 0.8)) * (0.92 + this.rng() * 0.16)
    }
    while (this.events.length && this.events[0].t0 < t - 0.38) this.events.shift()
  }
  valueFor(label, t) {
    const p = t % this.cycleSec
    let o = 0
    const posterior = posteriorPhoticField(label)
    if (p >= this.driveStart && p <= this.driveEnd && posterior > 0) {
      const rise = Math.min(1, (p - this.driveStart) / 0.35)
      const fall = Math.min(1, (this.driveEnd - p) / 0.35)
      const gate = Math.max(0, Math.min(rise, fall))
      o += posterior * 28 * gate * Math.sin(2 * Math.PI * 16 * t + this.phase)
    }
    const w = Math.max(frontocentralGradient(label), posterior * 0.82)
    if (w >= 0.05) {
      for (const ev of this.events) {
        const dt = t - ev.t0
        if (dt < -0.02 || dt > 0.34) continue
        o += w * ev.ampJ * polyspikeWave(dt, { amp: 115, count: 2, slowAmp: 72 })
      }
    }
    return { overlay: o, preserve: o ? 0.94 : 1 }
  }
}

class TriphasicWavesOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.6
    this.events = []
  }
  advance(t, emitEvent = null) {
    if (t >= this.nextT) {
      const event = { t0: this.nextT, ampJ: 0.82 + this.rng() * 0.32 }
      this.events.push(event)
      emitEvent?.({
        t: event.t0,
        type: 'triphasic_wave',
        label: 'Triphasic',
        detail: 'Triphasic wave',
      })
      this.nextT += 0.72 + this.rng() * 0.42
    }
    while (this.events.length && this.events[0].t0 < t - 0.75) this.events.shift()
  }
  valueFor(label, t) {
    const w = bifrontalGradient(label)
    if (w < 0.05) return { overlay: 0, preserve: 1 }
    let o = 0
    let active = false
    for (const ev of this.events) {
      const dt = t - (ev.t0 + regionLagSeconds(label))
      if (dt < -0.04 || dt > 0.46) continue
      active = true
      o += w * ev.ampJ * (
        gaussianPulse(dt, 0.035, 0.030, -44) +
        gaussianPulse(dt, 0.120, 0.055, 136) +
        gaussianPulse(dt, 0.260, 0.080, -66)
      )
    }
    return { overlay: o, preserve: active ? 0.95 : 1 }
  }
}

class BreachRhythmOverlay {
  constructor(rng) {
    this.phaseA = rng() * 2 * Math.PI
    this.phaseB = rng() * 2 * Math.PI
    this.phaseEnv = rng() * 2 * Math.PI
  }
  advance(/* t */) {}
  valueFor(label, t) {
    const w = breachField(label)
    if (w < 0.05) return { overlay: 0, preserve: 1 }
    const env = 0.72 + 0.28 * Math.sin(2 * Math.PI * 0.18 * t + this.phaseEnv)
    const alphaRaw = Math.sin(2 * Math.PI * 10.8 * t + this.phaseA)
    const alpha = Math.sign(alphaRaw) * Math.pow(Math.abs(alphaRaw), 0.55)
    const beta = 14 * Math.sin(2 * Math.PI * 18.5 * t + this.phaseB) +
      9 * Math.sin(2 * Math.PI * 23.0 * t + this.phaseB * 0.7)
    return { overlay: w * env * (30 * alpha + beta), preserve: 1 }
  }
}

export class StreamingEEG {
  constructor({ sampleRate = SAMPLE_RATE, seed = Date.now(), noiseScale = 1 } = {}) {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new RangeError('sampleRate must be positive and finite')
    this.sampleRate = sampleRate
    this.sampleIndex = 0
    this.clock = 0
    this.rng = makeRng(seed | 0)
    this.noiseScale = Math.max(0, Number.isFinite(noiseScale) ? noiseScale : 1)
    this.channels = {}
    for (const elec of ELECTRODES_1020) {
      this.channels[elec] = new Channel(elec, this.rng)
    }
    this.electrodes = Object.keys(this.channels)
    // Global rhythm driver phases — all channels share these via mixing
    this.pdrPhase   = this.rng() * 2 * Math.PI    // posterior alpha (10 Hz)
    this.betaPhase  = this.rng() * 2 * Math.PI    // shared beta carrier
    this.thetaPhase = this.rng() * 2 * Math.PI    // shared theta carrier
    this.deltaPhase = this.rng() * 2 * Math.PI    // shared delta carrier
    this.mainsPhase = this.rng() * 2 * Math.PI    // shared 50 Hz line noise
    this.muLeftPhase = this.rng() * 2 * Math.PI
    this.muRightPhase = this.rng() * 2 * Math.PI
    // Global stochastic envelope for the shared posterior-driver alpha.
    // Mean is centred at 1.0 (floor+ceil = 2.0), and the swing produces a
    // ~2.6× peak-to-trough ratio matching the irregular wax/wane of real
    // alpha. `drive` saturates the tanh aggressively so the envelope spends
    // time at the floor or ceiling rather than hovering near the mean —
    // that's what gives the irregular "now bright / now quiet" character.
    this.pdrEnvelope = new SlowEnvelope(this.rng, { floor: 0.55, ceil: 1.45, drive: 4.0 })
    this.mode = 'normal_awake'
    this.eyesOpen = false
    this.overlays = []
    this.eventLog = []
    this.emitEvent = event => this.recordEvent(event)
  }

  setMode(mode) { this.mode = mode }
  setEyesOpen(eyesOpen) { this.eyesOpen = !!eyesOpen }
  setNoiseScale(noiseScale) {
    this.noiseScale = Math.max(0, Number.isFinite(noiseScale) ? noiseScale : 1)
  }

  addOverlay(overlay) { this.overlays.push(overlay) }
  removeOverlay(overlay) {
    const i = this.overlays.indexOf(overlay)
    if (i >= 0) this.overlays.splice(i, 1)
  }
  clearOverlays() { this.overlays = [] }
  startSeizure(kind, settings = {}) {
    if (!['focal', 'generalized'].includes(kind) || this.getActiveSeizure()) return false
    if (this.overlays.some(overlay => ['FocalStatusOverlay', 'GeneralizedStatusOverlay'].includes(overlay.constructor.name))) return false
    const overlay = new OneShotSeizureOverlay(kind, this.clock, this.rng, settings)
    this.addOverlay(overlay)
    this.recordEvent({ t: this.clock, type: `simulated_${kind}_seizure`, label: kind === 'focal' ? 'Focal seizure' : 'Generalized seizure', durationS: overlay.duration, detail: kind === 'focal' ? `${describeFocalPlan(overlay.focalOptions)}${overlay.focalOptions.spread === 'none' ? '' : `; spread begins after ${overlay.focalOptions.spreadDelay}s over ${overlay.focalOptions.spreadDuration}s`}` : 'Generalized evolving rhythm: 6 to 4 to 2.5 Hz' })
    return true
  }
  getActiveSeizure() {
    const overlay = this.overlays.find(item => item.isManualSeizure && !item.isFinished(this.clock))
    return overlay ? { kind: overlay.kind, startTime: overlay.startTime, endTime: overlay.endTime, duration: overlay.duration, focalOptions: overlay.focalOptions } : null
  }
  stopSeizure() {
    const active = this.getActiveSeizure()
    this.overlays = this.overlays.filter(overlay => !overlay.isManualSeizure)
    if (!active) return false
    const event = this.eventLog.find(event => event.type === `simulated_${active.kind}_seizure` && event.t === active.startTime)
    if (event) event.durationS = Math.max(0, this.clock - active.startTime)
    this.recordEvent({ t: this.clock, type: 'seizure_stopped', label: 'Seizure simulation stopped', detail: 'Returned to the selected background' })
    return true
  }

  hasOverlay(predicate) { return this.overlays.some(predicate) }
  recordEvent(event) {
    const normalized = {
      id: `${event.type ?? 'event'}-${Math.round((event.t ?? this.clock) * 1000)}-${this.eventLog.length}`,
      t: event.t ?? this.clock,
      type: event.type ?? 'event',
      label: event.label ?? 'Event',
      detail: event.detail ?? '',
      durationS: event.durationS ?? null,
    }
    this.eventLog.push(normalized)
    const cutoff = this.clock - 120
    while (this.eventLog.length > 200 || (this.eventLog.length && this.eventLog[0].t < cutoff)) {
      this.eventLog.shift()
    }
  }
  getEventsSince(timeS = 0) {
    return this.eventLog.filter(event => event.t >= timeS)
  }

  /**
   * Advance the engine by `durationSec` and return per-channel sample arrays.
   * Each call is contiguous in time — there is no buffer wrap.
   */
  fillWindow(durationSec, target = null) {
    if (!Number.isFinite(durationSec) || durationSec < 0) throw new RangeError('durationSec must be nonnegative and finite')
    const fs = this.sampleRate
    const N = Math.round(durationSec * fs)
    const out = target ?? {}
    const elecs = this.electrodes
    const channelStates = new Array(elecs.length)
    const outputBuffers = new Array(elecs.length)
    for (let ch = 0; ch < elecs.length; ch++) {
      const e = elecs[ch]
      if (!out[e] || out[e].length !== N) out[e] = new Float32Array(N)
      const channel = this.channels[e]
      channel.prepare(this.mode, this.eyesOpen)
      channelStates[ch] = channel
      outputBuffers[ch] = out[e]
    }

    // Carrier frequencies for the shared drivers
    const pdrHz   = this.mode === 'fast_alpha_variant' ? 16.8 : 10
    const betaHz  = 20
    const thetaHz = 5.5
    const deltaHz = 2.0
    const mainsHz = 50

    const opts = {
      mode: this.mode,
      eyesOpen: this.eyesOpen,
      pdrPhase: this.pdrPhase,
      pdrEnvelope: 1,
      betaSharedSin: 0,
      thetaSharedSin: 0,
      deltaSharedSin: 0,
      mainsPhase: this.mainsPhase,
      muLeftPhase: this.muLeftPhase,
      muRightPhase: this.muRightPhase,
      sampleRate: fs,
      noiseScale: this.noiseScale,
    }

    for (let i = 0; i < N; i++) {
      const t = (this.sampleIndex + i) / fs

      // Advance shared driver phases
      this.pdrPhase   += 2 * Math.PI * pdrHz   / fs
      this.betaPhase  += 2 * Math.PI * betaHz  / fs
      this.thetaPhase += 2 * Math.PI * thetaHz / fs
      this.deltaPhase += 2 * Math.PI * deltaHz / fs
      this.mainsPhase += 2 * Math.PI * mainsHz / fs
      this.muLeftPhase += 2 * Math.PI * 9.8 / fs
      this.muRightPhase += 2 * Math.PI * 10.1 / fs

      // Advance global alpha envelope (one step per timestep — shared
      // across all channels so O1 and O2 wax/wane together)
      this.pdrEnvelope.step()
      const pdrEnv = this.pdrEnvelope.value()

      // Let overlays update their schedules for this timestep
      for (const o of this.overlays) o.advance(t, this.emitEvent)

      opts.pdrPhase = this.pdrPhase
      opts.pdrEnvelope = pdrEnv
      opts.betaSharedSin = Math.sin(this.betaPhase)
      opts.thetaSharedSin = Math.sin(this.thetaPhase)
      opts.deltaSharedSin = Math.sin(this.deltaPhase)
      opts.mainsPhase = this.mainsPhase
      opts.muLeftPhase = this.muLeftPhase
      opts.muRightPhase = this.muRightPhase

      for (let ch = 0; ch < elecs.length; ch++) {
        const e = elecs[ch]
        let y = channelStates[ch].sample(t, opts)
        // Apply overlays in order; each can attenuate the running signal
        // (preserve < 1) before adding its own overlay component.
        for (const o of this.overlays) {
          const r = o.valueFor(e, t)
          if (!r) continue
          if (r.preserve !== 1) y *= r.preserve
          if (r.overlay)        y += r.overlay
        }
        outputBuffers[ch][i] = y
      }
    }

    this.sampleIndex += N
    this.clock = this.sampleIndex / fs
    this.overlays = this.overlays.filter(overlay => !overlay.isManualSeizure || !overlay.isFinished(this.clock))
    return out
  }

  /** Reset clock to 0 (keeps all per-channel state and overlay schedules). */
  rewind() {
    this.sampleIndex = 0
    this.clock = 0
    this.eventLog = []
    for (const o of this.overlays) {
      // Best-effort — overlays carry their own schedules; create new ones to
      // restart cleanly.
      if (typeof o.reset === 'function') o.reset()
    }
  }
}

// ─── Factory helpers ────────────────────────────────────────────────────────

const awakePatterns = new Set([
  'normal_awake', 'fast_alpha_variant', 'mu_rhythm', 'central_midline_theta', 'lambda_waves', 'absence', 'temporal_sharps', 'polyspike_jme',
  'photoparoxysmal', 'centrotemporal_spikes', 'breach_rhythm', 'posterior_slow_waves_youth',
])

// Change future samples without replacing channel state, history, or seizures.
export function configureEngineControls(engine, pattern, {
  eyesClosed = true, blinksEnabled = true, blinkRate = 18,
  noiseLevel = 0.25, activationProcedure = 'none',
} = {}) {
  const eyesOpen = !eyesClosed
  engine.setEyesOpen(eyesOpen)
  engine.setNoiseScale(0.2 + Math.max(0, noiseLevel) * 3.2)
  const rate = Number.isFinite(blinkRate) ? Math.max(0, blinkRate) : 18
  const ocular = eyesOpen && awakePatterns.has(pattern)
  function toggleOverlay(Type, enabled, create) {
    const existing = engine.overlays.find(overlay => overlay instanceof Type)
    if (!enabled) {
      if (existing) engine.removeOverlay(existing)
      return null
    }
    if (existing) return existing
    const overlay = create()
    // Overlay constructors use times relative to a new recording. Schedule
    // newly enabled artifacts from the current clock, avoiding old events.
    if (Number.isFinite(overlay.nextT)) overlay.nextT += engine.clock
    if (Number.isFinite(overlay.nextEventT)) overlay.nextEventT += engine.clock
    engine.addOverlay(overlay)
    return overlay
  }
  const blink = toggleOverlay(BlinkOverlay, ocular && blinksEnabled && rate > 0,
    () => new BlinkOverlay(engine.rng, rate))
  if (blink && blink.meanIbi !== 60 / rate) {
    blink.nextT = engine.clock + Math.max(0.25,
      (blink.nextT - engine.clock) * (60 / rate) / blink.meanIbi)
    blink.meanIbi = 60 / rate
  }
  toggleOverlay(SaccadeOverlay, ocular, () => new SaccadeOverlay(engine.rng))
  for (const overlay of engine.overlays) {
    if (overlay instanceof LambdaWavesOverlay) {
      if (eyesOpen && !overlay.enabled) overlay.nextT = engine.clock + 0.55
      overlay.enabled = eyesOpen
    }
    if (overlay instanceof PosteriorSlowWavesYouthOverlay)
      overlay.reactivityScale = eyesOpen ? 0.08 : 1
  }
  const activation = engine.overlays.find(overlay => overlay instanceof ActivationProcedureOverlay)
  if (activation && activation.kind !== activationProcedure) engine.removeOverlay(activation)
  toggleOverlay(ActivationProcedureOverlay,
    activationProcedure !== 'none' && isActivationProcedureAllowed(activationProcedure, pattern),
    () => new ActivationProcedureOverlay(activationProcedure, engine.rng))
}

/**
 * Create a streaming engine pre-configured for a named pattern, optionally
 * with eyes-open state for awake variants. Pathologic patterns are realised
 * as overlays on a sensible base mode (e.g. encephalopathy → diffuse_slowing
 * base; gpds → diffuse_slowing base + GpdsOverlay).
 */
export function createEngineForPattern(pattern, options = {}) {
  const {
    eyesClosed = true,
    blinksEnabled = true,
    blinkRate = 18,
    noiseLevel = 0.25,
    seed = (Date.now() & 0xffffffff),
    activationProcedure = 'none',
  } = options
  const engine = new StreamingEEG({ seed })
  engine.setEyesOpen(!eyesClosed)
  engine.setNoiseScale(0.2 + Math.max(0, noiseLevel) * 3.2)

  const eyesOpen = !eyesClosed
  const isEci = pattern === 'electrocerebral_silence'
  const ambientHr = 60 + Math.round(engine.rng() * 12)

  // Always-on artifacts
  if (!isEci) {
    engine.addOverlay(new CardiacOverlay(engine.rng, ambientHr))
  }
  const effectiveBlinkRate = Number.isFinite(blinkRate) ? Math.max(0, blinkRate) : 18
  if (blinksEnabled && effectiveBlinkRate > 0 && eyesOpen && awakePatterns.has(pattern)) {
    engine.addOverlay(new BlinkOverlay(engine.rng, effectiveBlinkRate))
  }
  if (eyesOpen && awakePatterns.has(pattern)) {
    engine.addOverlay(new SaccadeOverlay(engine.rng))
  }

  // Map pattern → base mode + optional overlays
  if (Object.hasOwn(ADDITIONAL_PATTERN_CONFIG, pattern)) {
    engine.setMode(ADDITIONAL_PATTERN_CONFIG[pattern].mode)
    engine.addOverlay(createAdditionalOverlay(pattern, engine.rng))
  } else switch (pattern) {
    case 'normal_awake':         engine.setMode('normal_awake'); break
    case 'fast_alpha_variant':   engine.setMode('fast_alpha_variant'); break
    case 'mu_rhythm':
      engine.setMode('mu_rhythm')
      engine.addOverlay(new MuRhythmEventOverlay(engine.rng))
      break
    case 'central_midline_theta':
      engine.setMode('normal_awake')
      engine.addOverlay(new CentralMidlineThetaOverlay(engine.rng))
      break
    case 'lambda_waves':
      engine.setMode('normal_awake')
      engine.addOverlay(new LambdaWavesOverlay(engine.rng, eyesOpen))
      break
    case 'rmtd':
      engine.setMode('rmtd')
      engine.addOverlay(new RhythmicMidtemporalThetaOverlay(engine.rng))
      break
    case 'wicket_rhythm':
      engine.setMode('wicket_rhythm')
      engine.addOverlay(new WicketRhythmOverlay(engine.rng))
      break
    case 'sreda':
      engine.setMode('normal_drowsy')
      engine.addOverlay(new SredaOverlay(engine.rng))
      break
    case 'small_sharp_spikes':
      engine.setMode('normal_drowsy')
      engine.addOverlay(new SmallSharpSpikesOverlay(engine.rng))
      break
    case 'phantom_spike_wave':
      engine.setMode('normal_drowsy')
      engine.addOverlay(new PhantomSpikeWaveOverlay(engine.rng))
      break
    case 'positive_spikes_14_6':
      engine.setMode('normal_drowsy')
      engine.addOverlay(new PositiveSpikes146Overlay(engine.rng))
      break
    case 'posterior_slow_waves_youth':
      engine.setMode('normal_awake')
      engine.addOverlay(new PosteriorSlowWavesYouthOverlay(engine.rng, eyesOpen))
      break
    case 'normal_drowsy':
      engine.setMode('normal_drowsy')
      engine.addOverlay(new SlowRovingEyeMovementOverlay(engine.rng))
      engine.addOverlay(new N1SleepGraphoelementsOverlay(engine.rng))
      engine.addOverlay(new SmallSharpSpikesOverlay(engine.rng))
      break
    case 'normal_sleep':
      engine.setMode('normal_sleep')
      engine.addOverlay(new N2SleepGraphoelementsOverlay(engine.rng))
      engine.addOverlay(new SmallSharpSpikesOverlay(engine.rng))
      break
    case 'normal_rem':
      engine.setMode('normal_rem')
      engine.addOverlay(new RapidEyeMovementOverlay(engine.rng))
      break
    case 'slow_wave_sleep':      engine.setMode('slow_wave_sleep'); break
    case 'diffuse_slowing':      engine.setMode('diffuse_slowing'); break
    case 'alpha_coma':           engine.setMode('alpha_coma'); break
    case 'focal_slowing':
      engine.setMode('normal_awake')
      engine.addOverlay(new FocalSlowingOverlay(engine.rng))
      break
    case 'firda':
      engine.setMode('diffuse_slowing')
      engine.addOverlay(new FirdaOverlay(engine.rng))
      break
    case 'gpds':
      engine.setMode('diffuse_slowing')
      engine.addOverlay(new GpdsOverlay(engine.rng))
      break
    case 'lpds':
      engine.setMode('diffuse_slowing')
      engine.addOverlay(new LpdsOverlay(engine.rng))
      break
    case 'absence':
      engine.setMode('normal_awake')
      engine.addOverlay(new AbsenceOverlay(engine.rng))
      break
    case 'slow_spike_wave':
      engine.setMode('diffuse_slowing')
      engine.addOverlay(new SlowSpikeWaveOverlay(engine.rng))
      break
    case 'polyspike_jme':
      engine.setMode('normal_awake')
      engine.addOverlay(new PolyspikeJmeOverlay(engine.rng))
      break
    case 'centrotemporal_spikes':
      engine.setMode('normal_drowsy')
      engine.addOverlay(new CentrotemporalSpikesOverlay(engine.rng))
      break
    case 'temporal_sharps':
      engine.setMode('normal_drowsy')
      engine.addOverlay(new TemporalSharpsOverlay(engine.rng))
      break
    case 'birds':
      engine.setMode('normal_drowsy')
      engine.addOverlay(new BirdsOverlay(engine.rng))
      break
    case 'hypsarrhythmia':
      engine.setMode('normal_sleep')
      engine.addOverlay(new HypsarrhythmiaOverlay(engine.rng))
      break
    case 'photoparoxysmal':
      engine.setMode('normal_awake')
      engine.addOverlay(new PhotoparoxysmalOverlay(engine.rng))
      break
    case 'triphasic_waves':
      engine.setMode('diffuse_slowing')
      engine.addOverlay(new TriphasicWavesOverlay(engine.rng))
      break
    case 'breach_rhythm':
      engine.setMode('normal_awake')
      engine.addOverlay(new BreachRhythmOverlay(engine.rng))
      break
    case 'burst_suppression':
      engine.setMode('slow_wave_sleep')          // overlay attenuates the interburst background
      engine.addOverlay(new BurstSuppressionOverlay(engine.rng))
      break
    case 'electrocerebral_silence':
      engine.setMode('electrocerebral_inactivity')
      break
    default:
      engine.setMode('normal_awake')
  }

  if (activationProcedure !== 'none' && isActivationProcedureAllowed(activationProcedure, pattern)) {
    engine.addOverlay(new ActivationProcedureOverlay(activationProcedure, engine.rng))
  }

  return engine
}

// Re-export the overlay classes so callers can compose their own pathology
// combinations beyond the patterns above.
export {
  CardiacOverlay,
  BlinkOverlay,
  SaccadeOverlay,
  LambdaWavesOverlay,
  CentralMidlineThetaOverlay,
  PosteriorSlowWavesYouthOverlay,
  RhythmicMidtemporalThetaOverlay,
  WicketRhythmOverlay,
  SlowRovingEyeMovementOverlay,
  FirdaOverlay,
  GpdsOverlay,
  LpdsOverlay,
  AbsenceOverlay,
  BurstSuppressionOverlay,
  N1SleepGraphoelementsOverlay,
  N2SleepGraphoelementsOverlay,
  FocalSlowingOverlay,
  SlowSpikeWaveOverlay,
  PolyspikeJmeOverlay,
  CentrotemporalSpikesOverlay,
  TemporalSharpsOverlay,
  BirdsOverlay,
  HypsarrhythmiaOverlay,
  PhotoparoxysmalOverlay,
  TriphasicWavesOverlay,
  BreachRhythmOverlay,
}
