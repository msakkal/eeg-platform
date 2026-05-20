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
 * view. The older buffered `signalGenerator.js` remains in place for the
 * Propagation interactive demo and the small `generateDemoTrace` calls
 * used by the Waveforms / Findings / Quiz / Artifacts catalogues — those
 * are "render-once-and-display" callers that don't need streaming.
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
} from './electrodes.js'

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
  constructor(rng, { floor = 0.35, ceil = 1.0, drive = 0.30, seed = 0 } = {}) {
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

function modeAmps(mode, region, posterior, eyesOpen) {
  switch (mode) {
    case 'normal_awake':
    case 'awake':
      // Alpha amplitudes are PEAK µV. Posterior-dominant alpha is normally
      // ~20-60 µV pp (peak ~10-30); the slow envelope can lift waxing bursts
      // a little higher. Occipital peak 30 → ~60 µV pp average PDR.
      return {
        A: region === 'occipital' ? (eyesOpen ? 4  : 30)
         : region === 'parietal'  ? (eyesOpen ? 3  : 16)
         : region === 'central'   ? 6
         : region === 'frontal'   ? 4
         : 5,
        B: region === 'frontal' ? 10 : region === 'central' ? 8 : region === 'temporal' ? 7 : 5,
        T: region === 'midtemporal' || region === 'posttemporal' ? 4.5 : posterior ? 3.5 : 3.0,
        D: posterior ? 2.4 : 2.0,
        noiseGain: eyesOpen ? 0.78 : 0.68,
      }
    case 'normal_drowsy':
    case 'drowsy':
      return {
        A: posterior ? (eyesOpen ? 1.6 : 11.5) : 2.4,
        B: region === 'frontal' ? 2.8 : 2.2,
        T: region === 'midtemporal' || region === 'posttemporal' ? 24
         : region === 'central'   ? 20
         : region === 'parietal'  ? 16
         : region === 'frontal'   ? 14.5 : 12.8,
        D: region === 'frontal' ? 7.2 : region === 'central' ? 6.0 : 5.0,
        noiseGain: 0.68,
      }
    case 'normal_sleep':
    case 'n2':
      return {
        A: posterior ? 1.2 : 0.9,
        B: region === 'frontal' ? 3.0 : region === 'central' ? 2.6 : 2.2,
        T: region === 'central' ? 14.0
         : region === 'midtemporal' || region === 'posttemporal' ? 12.4 : 10.5,
        D: region === 'frontal' ? 11.0 : region === 'central' ? 9.0 : region === 'parietal' ? 7.2 : 6.2,
        noiseGain: 0.62,
      }
    case 'slow_wave_sleep':
    case 'sws':
      return {
        A: 0.5, B: 0.7, T: 1.6,
        D: region === 'frontal' ? 60
         : region === 'central' ? 50
         : region === 'parietal' ? 38
         : region === 'midtemporal' || region === 'posttemporal' ? 31 : 26,
        noiseGain: 0.42,
      }
    case 'diffuse_slowing':
      return {
        A: posterior ? 3.5 : 1.8,
        B: 3,
        T: region === 'frontal' || region === 'frontopolar' ? 28 : 22,
        D: region === 'frontal' || region === 'frontopolar' ? 22 : 14,
        noiseGain: 0.55,
      }
    case 'alpha_coma':
      // Frontal-max non-reactive alpha — handled by alphaGradient remapping
      // in the engine sample() rather than here.
      return {
        A: 0,   // disabled — see alpha-coma override
        B: 1.5, T: 2, D: 2,
        noiseGain: 0.36,
      }
    default:
      return { A: 6, B: 5, T: 5, D: 3, noiseGain: 0.78 }
  }
}

// Alpha source mixing weight (how much of the channel's alpha comes from the
// shared posterior driver vs the channel's local oscillator). Posterior sites
// are dominated by the global driver → high coherence. Anterior sites mix
// mostly their local oscillator → lower coherence.
function alphaMixFor(mode, region, posterior, eyesOpen) {
  if (mode === 'normal_awake' || mode === 'awake') {
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
    this.phMu    = rng() * 2 * Math.PI
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
    this.muOffset      = (rng() - 0.5) * 0.6      // ±0.3 Hz detune
    this.fmMu          = rng() * 2 * Math.PI
    this.muEnvPhase    = rng() * 2 * Math.PI
    // Frontotemporal EMG (muscle) haze — one-pole high-pass state.
    this.emgHP   = 0
    this.emgPrev = 0
    this.rng = rng
  }

  sample(t, opts) {
    const { mode, eyesOpen, pdrPhase, pdrEnvelope, betaSharedPhase, thetaSharedPhase, deltaSharedPhase, mainsPhase, sampleRate } = opts
    const { region, posterior, name } = this
    // Advance and read the per-channel local alpha envelope so it tracks
    // its own slow stochastic process (called once per channel per sample).
    this.localAlphaEnv.step()
    const { A, B, T, D, noiseGain } = modeAmps(mode, region, posterior, eyesOpen)

    // Base center frequencies + persistent offset + slow FM drift
    const alphaCarrier = (mode === 'normal_awake' || mode === 'awake' ? 10 : 9.2)
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
    const fA = Math.max(7.5, Math.min(12.5, alphaCarrier))
    const fB = Math.max(13,  Math.min(30,   betaCarrier))
    const fT = Math.max(3.5, Math.min(7.0,  thetaCarrier))
    const fD = Math.max(0.5, Math.min(3.2,  deltaCarrier))
    this.phAlpha += 2 * Math.PI * fA / sampleRate
    this.phBeta  += 2 * Math.PI * fB / sampleRate
    this.phTheta += 2 * Math.PI * fT / sampleRate
    this.phDelta += 2 * Math.PI * fD / sampleRate

    // Mix shared posterior alpha driver with local oscillator
    const aMix       = alphaMixFor(mode, region, posterior, eyesOpen)
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
    const otherMix   = betaThetaDeltaMix(region)
    const betaTerm   = otherMix * Math.sin(betaSharedPhase)  + (1 - otherMix) * Math.sin(this.phBeta)
    const thetaTerm  = otherMix * Math.sin(thetaSharedPhase) + (1 - otherMix) * Math.sin(this.phTheta)
    const deltaTerm  = otherMix * Math.sin(deltaSharedPhase) + (1 - otherMix) * Math.sin(this.phDelta)

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
    y += noiseGain * 4 * pink

    // Slow baseline drift (0.05–0.30 Hz), bigger at temporal/posterior
    const isPostOrTemp = region === 'midtemporal' || region === 'posttemporal' ||
                        region === 'parietal'    || region === 'occipital'
    const driftAmp = isPostOrTemp ? 7 : 3.5
    y += driftAmp * (
      0.7 * Math.sin(2 * Math.PI * this.driftF1 * t + this.driftPh1) +
      0.4 * Math.sin(2 * Math.PI * this.driftF2 * t + this.driftPh2)
    )

    // Mu rhythm — arched (comb-shaped) central rhythm over the rolandic
    // strip. Present in relaxed wakefulness regardless of eye state; the
    // negative peaks are sharp and the positive peaks rounded. It fades out
    // in drowsy/sleep states (no central muscle/rolandic idling there).
    if (mode === 'normal_awake' || mode === 'awake') {
      const muAmp = name === 'C3' || name === 'C4' ? 9.5
                  : name === 'Cz'                  ? 5.5
                  : region === 'central'           ? 6.0
                  : region === 'frontal'           ? 2.2
                  : 0
      if (muAmp > 0) {
        const fMu = 9.8 + this.muOffset +
                    0.15 * Math.sin(2 * Math.PI * 0.06 * t + this.fmMu)
        this.phMu += 2 * Math.PI * fMu / sampleRate
        const raw    = Math.sin(this.phMu)
        const arched = raw > 0 ? raw : raw * 0.32        // flatten the troughs
        const muEnv  = Math.max(0.2,
          0.55 + 0.45 * Math.sin(2 * Math.PI * 0.13 * t + this.muEnvPhase))
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
      y += emgGain * this.emgHP
    }

    // Mains line-noise interference (50 Hz) — small. The viewer's notch
    // filter (default 50 Hz) removes it, so the filter visibly does work.
    y += this.mainsAmp * Math.sin(mainsPhase + this.mainsPhaseOff)

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
  advance(t) {
    if (t >= this.nextT) {
      this.events.push({
        t0: this.nextT,
        peak: 180 + this.rng() * 80,
        riseMs: 55 + this.rng() * 30,
        fallMs: 180 + this.rng() * 90,
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
  advance(t) {
    if (t >= this.nextT) {
      this.events.push({
        t0: this.nextT,
        peak: 60 + this.rng() * 40,
        durSec: 0.28 + this.rng() * 0.14,
        direction: this.rng() > 0.5 ? +1 : -1,
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
  advance(t) {
    if (t >= this.nextT) {
      this.events.push({ t0: this.nextT, ampJ: 0.85 + this.rng() * 0.30 })
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
  advance(t) {
    if (t >= this.nextT) {
      this.events.push({ t0: this.nextT, ampJ: 0.85 + this.rng() * 0.30 })
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
class AbsenceOverlay {
  constructor(rng, durationSec = 6) {
    this.rng = rng
    this.runStart = 1.0
    this.runEnd   = this.runStart + durationSec
    this.events = []
    this.nextT = this.runStart
  }
  advance(t) {
    if (t < this.runStart || t >= this.runEnd) return
    if (t >= this.nextT) {
      this.events.push({ t0: this.nextT })
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
// Bursts are bilaterally synchronous; suppression attenuates background to ~15%.
class BurstSuppressionOverlay {
  constructor(rng) {
    this.rng = rng
    this.nextT = 0.2
    this.events = []
    this.burstActive = false
    this.burstUntil = 0
  }
  advance(t) {
    if (t >= this.nextT) {
      const burstDur = 0.5 + this.rng() * 1.2
      this.events.push({ t0: this.nextT, durSec: burstDur, ampJ: 0.92 + this.rng() * 0.16 })
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
    const preserve = active ? 1.0 : 0.10
    return { overlay: o, preserve }
  }
}

// ─── Streaming engine ───────────────────────────────────────────────────────

export class StreamingEEG {
  constructor({ sampleRate = SAMPLE_RATE, seed = Date.now() } = {}) {
    this.sampleRate = sampleRate
    this.clock = 0
    this.rng = makeRng(seed | 0)
    this.channels = {}
    for (const elec of ELECTRODES_1020) {
      this.channels[elec] = new Channel(elec, this.rng)
    }
    // Global rhythm driver phases — all channels share these via mixing
    this.pdrPhase   = this.rng() * 2 * Math.PI    // posterior alpha (10 Hz)
    this.betaPhase  = this.rng() * 2 * Math.PI    // shared beta carrier
    this.thetaPhase = this.rng() * 2 * Math.PI    // shared theta carrier
    this.deltaPhase = this.rng() * 2 * Math.PI    // shared delta carrier
    this.mainsPhase = this.rng() * 2 * Math.PI    // shared 50 Hz line noise
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
  }

  setMode(mode) { this.mode = mode }
  setEyesOpen(eyesOpen) { this.eyesOpen = !!eyesOpen }

  addOverlay(overlay) { this.overlays.push(overlay) }
  removeOverlay(overlay) {
    const i = this.overlays.indexOf(overlay)
    if (i >= 0) this.overlays.splice(i, 1)
  }
  clearOverlays() { this.overlays = [] }
  hasOverlay(predicate) { return this.overlays.some(predicate) }

  /**
   * Advance the engine by `durationSec` and return per-channel sample arrays.
   * Each call is contiguous in time — there is no buffer wrap.
   */
  fillWindow(durationSec) {
    const fs = this.sampleRate
    const N = Math.round(durationSec * fs)
    const out = {}
    const elecs = Object.keys(this.channels)
    for (const e of elecs) out[e] = new Float32Array(N)

    // Carrier frequencies for the shared drivers
    const pdrHz   = 10
    const betaHz  = 20
    const thetaHz = 5.5
    const deltaHz = 2.0
    const mainsHz = 50

    for (let i = 0; i < N; i++) {
      const t = this.clock + i / fs

      // Advance shared driver phases
      this.pdrPhase   += 2 * Math.PI * pdrHz   / fs
      this.betaPhase  += 2 * Math.PI * betaHz  / fs
      this.thetaPhase += 2 * Math.PI * thetaHz / fs
      this.deltaPhase += 2 * Math.PI * deltaHz / fs
      this.mainsPhase += 2 * Math.PI * mainsHz / fs

      // Advance global alpha envelope (one step per timestep — shared
      // across all channels so O1 and O2 wax/wane together)
      this.pdrEnvelope.step()
      const pdrEnv = this.pdrEnvelope.value()

      // Let overlays update their schedules for this timestep
      for (const o of this.overlays) o.advance(t)

      const opts = {
        mode: this.mode,
        eyesOpen: this.eyesOpen,
        pdrPhase: this.pdrPhase,
        pdrEnvelope: pdrEnv,
        betaSharedPhase:  this.betaPhase,
        thetaSharedPhase: this.thetaPhase,
        deltaSharedPhase: this.deltaPhase,
        mainsPhase:       this.mainsPhase,
        sampleRate: fs,
      }

      for (const e of elecs) {
        let y = this.channels[e].sample(t, opts)
        // Apply overlays in order; each can attenuate the running signal
        // (preserve < 1) before adding its own overlay component.
        for (const o of this.overlays) {
          const r = o.valueFor(e, t)
          if (!r) continue
          if (r.preserve !== 1) y *= r.preserve
          if (r.overlay)        y += r.overlay
        }
        out[e][i] = y
      }
    }

    this.clock += durationSec
    return out
  }

  /** Reset clock to 0 (keeps all per-channel state and overlay schedules). */
  rewind() {
    this.clock = 0
    for (const o of this.overlays) {
      // Best-effort — overlays carry their own schedules; create new ones to
      // restart cleanly.
      if (typeof o.reset === 'function') o.reset()
    }
  }
}

// ─── Factory helpers ────────────────────────────────────────────────────────

/**
 * Create a streaming engine pre-configured for a named pattern, optionally
 * with eyes-open state for awake variants. Pathologic patterns are realised
 * as overlays on a sensible base mode (e.g. encephalopathy → diffuse_slowing
 * base; gpds → diffuse_slowing base + GpdsOverlay).
 */
export function createEngineForPattern(pattern, options = {}) {
  const { eyesClosed = true, blinksEnabled = true, seed = (Date.now() & 0xffffffff) } = options
  const engine = new StreamingEEG({ seed })
  engine.setEyesOpen(!eyesClosed)

  const eyesOpen = !eyesClosed
  const awakePatterns = new Set([
    'normal_awake', 'absence', 'temporal_sharps', 'polyspike_jme',
    'photoparoxysmal', 'centrotemporal_spikes', 'breach_rhythm',
  ])
  const ambientHr = 60 + Math.round(engine.rng() * 12)

  // Always-on artifacts
  engine.addOverlay(new CardiacOverlay(engine.rng, ambientHr))
  if (blinksEnabled && eyesOpen && awakePatterns.has(pattern)) {
    engine.addOverlay(new BlinkOverlay(engine.rng))
  }
  if (eyesOpen && awakePatterns.has(pattern)) {
    engine.addOverlay(new SaccadeOverlay(engine.rng))
  }

  // Map pattern → base mode + optional overlays
  switch (pattern) {
    case 'normal_awake':         engine.setMode('normal_awake'); break
    case 'normal_drowsy':        engine.setMode('normal_drowsy'); break
    case 'normal_sleep':         engine.setMode('normal_sleep'); break
    case 'slow_wave_sleep':      engine.setMode('slow_wave_sleep'); break
    case 'diffuse_slowing':      engine.setMode('diffuse_slowing'); break
    case 'alpha_coma':           engine.setMode('alpha_coma'); break
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
    case 'burst_suppression':
      engine.setMode('slow_wave_sleep')          // very low-amp base
      engine.addOverlay(new BurstSuppressionOverlay(engine.rng))
      break
    default:
      engine.setMode('normal_awake')
  }

  return engine
}

// Re-export the overlay classes so callers can compose their own pathology
// combinations beyond the patterns above.
export {
  CardiacOverlay,
  BlinkOverlay,
  SaccadeOverlay,
  FirdaOverlay,
  GpdsOverlay,
  LpdsOverlay,
  AbsenceOverlay,
  BurstSuppressionOverlay,
}
