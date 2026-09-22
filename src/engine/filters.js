/**
 * Digital Filter Engine
 * Implements real-time IIR Butterworth filters:
 *   - Highpass (removes slow drift)
 *   - Lowpass (removes high-frequency noise/EMG)
 *   - Notch   (removes 50/60 Hz powerline)
 *
 * All filters use biquad (second-order section) cascades for stability.
 * Coefficients are computed once at design time and cached.
 */

// ─── Biquad Section ───────────────────────────────────────────────────────────

/**
 * Apply a sequence of biquad (SOS) sections to a signal.
 * Each section: [b0, b1, b2, a1, a2]  (a0 is normalised to 1)
 *
 * @param {Float32Array} signal
 * @param {number[][]}   sos     - array of [b0,b1,b2,a1,a2]
 * @returns {Float32Array}       - filtered signal (new array)
 */
export function applyBiquadSOS(signal, sos, workspace = null) {
  const len = signal.length
  if (!sos.length) return signal
  // Callers processing live frames can retain this workspace and avoid two
  // large typed-array allocations per channel on every repaint.
  let bufA = workspace?.bufA
  let bufB = workspace?.bufB
  if (!bufA || bufA.length !== len) bufA = new Float32Array(len)
  if (!bufB || bufB.length !== len) bufB = new Float32Array(len)
  if (workspace) {
    workspace.bufA = bufA
    workspace.bufB = bufB
  }
  let src = signal
  let dst = bufA
  for (const [b0, b1, b2, a1, a2] of sos) {
    let z1 = 0, z2 = 0
    for (let n = 0; n < len; n++) {
      const xn = src[n]
      const yn = b0 * xn + z1
      z1 = b1 * xn - a1 * yn + z2
      z2 = b2 * xn - a2 * yn
      dst[n] = yn
    }
    src = dst
    dst = src === bufA ? bufB : bufA
  }
  return src
}

// ─── Coefficient Design ───────────────────────────────────────────────────────

/**
 * Design a 2nd-order Butterworth highpass filter.
 * Returns SOS (one biquad section).
 * @param {number} fc  - cutoff freq (Hz)
 * @param {number} fs  - sample rate (Hz)
 */
export function butterHighpass(fc, fs) {
  const wc   = 2 * Math.PI * fc / fs
  const K    = Math.tan(wc / 2)
  const K2   = K * K
  const sq2  = Math.SQRT2
  const norm = 1 / (1 + sq2 * K + K2)
  const b0   =  1 * norm
  const b1   = -2 * norm
  const b2   =  1 * norm
  const a1   =  2 * (K2 - 1) * norm
  const a2   = (1 - sq2 * K + K2) * norm
  return [[b0, b1, b2, a1, a2]]
}

/**
 * Design a 2nd-order Butterworth lowpass filter.
 */
export function butterLowpass(fc, fs) {
  const wc   = 2 * Math.PI * fc / fs
  const K    = Math.tan(wc / 2)
  const K2   = K * K
  const sq2  = Math.SQRT2
  const norm = 1 / (1 + sq2 * K + K2)
  const b0   = K2 * norm
  const b1   = 2  * K2 * norm
  const b2   = K2 * norm
  const a1   = 2 * (K2 - 1) * norm
  const a2   = (1 - sq2 * K + K2) * norm
  return [[b0, b1, b2, a1, a2]]
}

/**
 * Design a 2nd-order notch filter at frequency fn.
 * Quality factor Q controls bandwidth.
 */
export function notchFilter(fn, fs, Q = 30) {
  const w0   = 2 * Math.PI * fn / fs
  const bw   = w0 / Q
  const gb2  = Math.cos(w0)
  const norm = 1 / (1 + Math.tan(bw / 2))
  const b0   = norm
  const b1   = -2 * gb2 * norm
  const b2   = norm
  const a1   = -2 * gb2 * norm
  const a2   = (2 * norm - 1)
  return [[b0, b1, b2, a1, a2]]
}

// ─── Filter Chain ─────────────────────────────────────────────────────────────

function cutoffIsInvalid(value, nyquist) {
  return value !== null && (!Number.isFinite(value) || value <= 0 || value >= nyquist)
}

/**
 * Preset filter configurations used in the UI.
 */
export const FILTER_PRESETS = {
  none:    { label: 'No filter',        hp: null,  lp: null,  notch: null },
  standard:{ label: 'Standard (0.5–70 Hz + notch)', hp: 0.5, lp: 70, notch: 50 },
  lff_hff: { label: 'HF filter only (< 70 Hz)',     hp: null, lp: 70, notch: null },
  sleep:   { label: 'Sleep (0.3–35 Hz)', hp: 0.3,  lp: 35,  notch: null },
  broad:   { label: 'Broadband (0.1–100 Hz)', hp: 0.1, lp: null, notch: null },
}

/**
 * Apply a configurable filter chain to a signal.
 *
 * @param {Float32Array} signal
 * @param {number} fs  - sample rate
 * @param {object} cfg - { hp, lp, notch, notchFreq }
 *   hp:       highpass cutoff Hz (null = skip)
 *   lp:       lowpass  cutoff Hz (null = skip)
 *   notch:    notch frequency Hz (null = skip)
 * @returns {Float32Array} filtered signal
 */
export function applyFilterChain(signal, fs = 256, cfg = {}, workspace = null) {
  const { hp = null, lp = null, notch = null } = cfg

  if (!Number.isFinite(fs) || fs <= 0) return signal
  const nyquist = fs / 2
  const hasInvalidCutoff = cutoffIsInvalid(hp, nyquist) ||
    cutoffIsInvalid(lp, nyquist) ||
    cutoffIsInvalid(notch, nyquist)
  if (hasInvalidCutoff || (hp !== null && lp !== null && hp >= lp)) return signal

  let cachedChain = _chainCache.get(cfg)
  if (!cachedChain || cachedChain.fs !== fs || cachedChain.hp !== hp || cachedChain.lp !== lp || cachedChain.notch !== notch) {
    const sections = []
    if (hp   !== null && hp   > 0)   sections.push(...getCachedFilterSOS('hp',    hp,    fs))
    if (lp   !== null && lp   > 0)   sections.push(...getCachedFilterSOS('lp',    lp,    fs))
    if (notch !== null && notch > 0) sections.push(...getCachedFilterSOS('notch', notch, fs))
    cachedChain = { fs, hp, lp, notch, sections }
    _chainCache.set(cfg, cachedChain)
  }
  const sos = cachedChain.sections

  return sos.length > 0 ? applyBiquadSOS(signal, sos, workspace) : signal
}

// ─── Coefficient Cache ────────────────────────────────────────────────────────
// Pre-compute SOS for common settings to avoid recalculating every frame.

const _cache = new Map()
const _chainCache = new WeakMap()

export function getCachedFilterSOS(type, freq, fs) {
  if (!Number.isFinite(fs) || fs <= 0 || !Number.isFinite(freq) || freq <= 0 || freq >= fs / 2) {
    return []
  }
  const key = `${type}:${freq}:${fs}`
  if (_cache.has(key)) return _cache.get(key)
  let sos
  if (type === 'hp')    sos = butterHighpass(freq, fs)
  if (type === 'lp')    sos = butterLowpass(freq, fs)
  if (type === 'notch') sos = notchFilter(freq, fs)
  _cache.set(key, sos)
  return sos
}
