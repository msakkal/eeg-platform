/**
 * Epileptic Propagation Engine
 *
 * Models how an epileptic discharge spreads from a cortical source
 * to neighbouring scalp electrodes using a Gaussian spatial decay.
 *
 * The "field" concept is central to EEG interpretation:
 *   - In referential montages: amplitude gradient reflects proximity to source
 *   - In bipolar montages:     phase reversal localises the generator
 */

import { SAMPLE_RATE, createEngineForPattern } from './streaming.js'
import { MONTAGES } from './montages.js'

// ─── Electrode Positions (normalised -1..1, top-down view, nose = +y) ─────────

export const ELECTRODE_POSITIONS_2D = {
  Fp1: { x: -0.27, y:  0.85 },  Fp2: { x:  0.27, y:  0.85 },
  F7:  { x: -0.72, y:  0.51 },  F3:  { x: -0.38, y:  0.51 },
  Fz:  { x:  0.00, y:  0.51 },  F4:  { x:  0.38, y:  0.51 },
  F8:  { x:  0.72, y:  0.51 },
  T7:  { x: -0.87, y:  0.00 },  C3:  { x: -0.45, y:  0.00 },
  Cz:  { x:  0.00, y:  0.00 },  C4:  { x:  0.45, y:  0.00 },
  T8:  { x:  0.87, y:  0.00 },
  P7:  { x: -0.72, y: -0.51 },  P3:  { x: -0.38, y: -0.51 },
  Pz:  { x:  0.00, y: -0.51 },  P4:  { x:  0.38, y: -0.51 },
  P8:  { x:  0.72, y: -0.51 },
  O1:  { x: -0.27, y: -0.85 },  O2:  { x:  0.27, y: -0.85 },
}

export const SELECTABLE_ELECTRODES = Object.keys(ELECTRODE_POSITIONS_2D)

// ─── Spatial Propagation Model ────────────────────────────────────────────────

/**
 * Compute amplitude weight at each electrode given a source and spread.
 * Uses a Gaussian decay: weight = exp(-d² / 2σ²)
 *
 * @param {string} sourceElec  - electrode label of the generator
 * @param {number} sigma       - spread parameter (0.2 = focal, 0.7 = diffuse)
 * @returns {Object}           - { [electrodeLabel]: 0..1 }
 */
export function computePropagationWeights(sourceElec, sigma = 0.38) {
  const src = ELECTRODE_POSITIONS_2D[sourceElec]
  if (!src) return {}

  const weights = {}
  for (const [elec, pos] of Object.entries(ELECTRODE_POSITIONS_2D)) {
    const dx   = pos.x - src.x
    const dy   = pos.y - src.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    weights[elec] = Math.exp(-(dist * dist) / (2 * sigma * sigma))
  }
  return weights
}

// ─── EEG Data Generator ───────────────────────────────────────────────────────

/**
 * Generate a 10-second multi-channel EEG dataset with propagation-weighted
 * epileptiform discharges (spike + slow wave complexes).
 *
 * @param {Object}  weights        - from computePropagationWeights
 * @param {number}  dischargeAmp   - source amplitude in µV (default 200)
 * @returns {{ channels: { [label]: Float32Array }, nSamples, sampleRate }}
 */
export function generatePropagationEEG(weights, dischargeAmp = 200) {
  const duration      = 10
  const n             = duration * SAMPLE_RATE
  const dischargeTimes = [1.4, 3.6, 5.8, 8.2]   // seconds — fixed for pedagogy
  const engine = createEngineForPattern('normal_awake', {
    eyesClosed: true,
    blinksEnabled: true,
    noiseLevel: 0.15,
  })
  const baseline = engine.fillWindow(duration)
  const channels = {}

  for (const [elec] of Object.entries(ELECTRODE_POSITIONS_2D)) {
    const w    = weights[elec] ?? 0
    const data = new Float32Array(baseline[elec] ?? n)

    dischargeTimes.forEach(t => {
      const s0 = Math.round(t * SAMPLE_RATE)

      // ── Spike (< 70 ms, sharp, negative) ─────────────────────────────
      const spikeDur = Math.round(0.055 * SAMPLE_RATE)
      for (let i = 0; i < spikeDur; i++) {
        const idx = s0 + i
        if (idx >= n) break
        const tNorm = i / spikeDur
        // Asymmetric shape: fast rise, slower fall
        const shape = tNorm < 0.25
          ? tNorm / 0.25
          : (1 - tNorm) / 0.75
        data[idx] += -dischargeAmp * w * shape
      }

      // ── Slow wave (200–400 ms, positive) ─────────────────────────────
      const swStart = s0 + Math.round(0.065 * SAMPLE_RATE)
      const swDur   = Math.round(0.38 * SAMPLE_RATE)
      for (let i = 0; i < swDur; i++) {
        const idx = swStart + i
        if (idx >= n) break
        data[idx] += dischargeAmp * w * 0.42 * Math.sin(Math.PI * i / swDur)
      }
    })

    channels[elec] = data
  }

  channels['A1'] = new Float32Array(baseline.A1 ?? n)
  channels['A2'] = new Float32Array(baseline.A2 ?? n)

  return { channels, nSamples: n, sampleRate: SAMPLE_RATE }
}

// ─── Montage Analysis ─────────────────────────────────────────────────────────

/**
 * For each channel in the active montage, compute:
 *   - posWeight:   propagation weight at the positive lead electrode
 *   - negWeight:   propagation weight at the negative lead electrode
 *   - netWeight:   posWeight - negWeight (signed; used for colouring)
 *   - containsSrc: true if either lead is the source electrode
 *   - polarity:    +1 = source is positive lead (spike appears downward in standard EEG)
 *                  -1 = source is negative lead (spike appears upward)
 *                   0 = neither lead is the source
 *
 * @param {string}  montageId
 * @param {string}  sourceElec
 * @param {Object}  weights
 */
export function analyseMontagePropagation(montageId, sourceElec, weights) {
  const montage = MONTAGES[montageId]
  if (!montage) return []

  return montage.channels.map(({ label, pos, neg }) => {
    const posW = weights[pos] ?? 0
    const negW = weights[neg] ?? 0
    const containsSrc = (pos === sourceElec || neg === sourceElec)
    const polarity    = pos === sourceElec ? +1 : neg === sourceElec ? -1 : 0

    return {
      label,
      posElec:     pos,
      negElec:     neg,
      posWeight:   posW,
      negWeight:   negW,
      netAmplitude: Math.abs(posW - negW),   // bipolar effective amplitude
      containsSrc,
      polarity,
    }
  })
}

/**
 * Find phase reversal pairs in a bipolar montage.
 * A phase reversal occurs when two adjacent channels share the source electrode
 * — one with it as positive lead, the next with it as negative lead.
 *
 * Returns an array of { label1, label2, at: sourceElec }
 */
export function findPhaseReversals(montageId, sourceElec) {
  const montage = MONTAGES[montageId]
  if (!montage) return []
  const chs = montage.channels

  const pairs = []
  for (let i = 0; i < chs.length - 1; i++) {
    const a = chs[i]
    const b = chs[i + 1]
    // Phase reversal: a.neg === source and b.pos === source (consecutive)
    if (a.neg === sourceElec && b.pos === sourceElec) {
      pairs.push({ label1: a.label, label2: b.label, at: sourceElec, idx1: i, idx2: i + 1 })
    }
    // Or a.pos === source and b.neg === source
    if (a.pos === sourceElec && b.neg === sourceElec) {
      pairs.push({ label1: a.label, label2: b.label, at: sourceElec, idx1: i, idx2: i + 1 })
    }
  }
  return pairs
}

// ─── Colour Helpers ───────────────────────────────────────────────────────────

/**
 * Map a propagation weight (0–1) to a CSS colour.
 * Source (1.0) = bright red-orange; distant (0) = dark slate.
 */
export function weightToColor(w) {
  if (w >= 0.90) return '#FF3333'
  if (w >= 0.70) return '#FF6B35'
  if (w >= 0.50) return '#FFD166'
  if (w >= 0.30) return '#00FFB0'
  if (w >= 0.12) return '#00D4FF'
  return '#2A3A54'
}

/**
 * Return a semi-transparent fill colour for a weight value.
 */
export function weightToFill(w) {
  if (w >= 0.90) return 'rgba(255,51,51,0.22)'
  if (w >= 0.70) return 'rgba(255,107,53,0.18)'
  if (w >= 0.50) return 'rgba(255,209,102,0.15)'
  if (w >= 0.30) return 'rgba(0,255,176,0.10)'
  if (w >= 0.12) return 'rgba(0,212,255,0.08)'
  return 'rgba(30,42,64,0.5)'
}
