/**
 * FFT & Power Spectral Density Engine
 * Implements Cooley-Tukey radix-2 FFT in pure JavaScript.
 * No external dependencies.
 */

// ─── Cooley-Tukey FFT ─────────────────────────────────────────────────────────

/**
 * In-place radix-2 Cooley-Tukey FFT.
 * Input arrays must have length that is a power of 2.
 * @param {Float64Array} re  - real part (modified in place)
 * @param {Float64Array} im  - imaginary part (modified in place)
 */
export function fft(re, im) {
  const n = re.length
  if (n <= 1) return

  // Bit-reversal permutation
  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }

  // Butterfly operations
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen  = len >> 1
    const wRe      = Math.cos(-2 * Math.PI / len)
    const wIm      = Math.sin(-2 * Math.PI / len)
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0
      for (let k = 0; k < halfLen; k++) {
        const uRe = re[i + k]
        const uIm = im[i + k]
        const vRe = re[i + k + halfLen] * curRe - im[i + k + halfLen] * curIm
        const vIm = re[i + k + halfLen] * curIm + im[i + k + halfLen] * curRe
        re[i + k]          = uRe + vRe
        im[i + k]          = uIm + vIm
        re[i + k + halfLen] = uRe - vRe
        im[i + k + halfLen] = uIm - vIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm        = curRe * wIm + curIm * wRe
        curRe        = nextRe
      }
    }
  }
}

// ─── Windowing ────────────────────────────────────────────────────────────────

/**
 * Apply a Hann window to a signal to reduce spectral leakage.
 * Returns a new Float64Array.
 */
export function hannWindow(signal) {
  const n      = signal.length
  const result = new Float64Array(n)
  if (n === 1) {
    result[0] = signal[0]
    return result
  }
  for (let i = 0; i < n; i++) {
    result[i] = signal[i] * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
  }
  return result
}

// ─── Power Spectral Density ───────────────────────────────────────────────────

/**
 * Compute one-sided Power Spectral Density via FFT.
 *
 * @param {Float32Array|Float64Array} signal  - time-domain signal
 * @param {number} sampleRate                 - Hz
 * @param {object} opts
 *   - nfft:       FFT size (power of 2, default next pow2 >= signal.length)
 *   - window:     'hann' | 'rect'
 *   - dbScale:    return dB values (default true)
 *
 * @returns {{ freqs: Float64Array, psd: Float64Array }}
 *   freqs: frequency bins (Hz)
 *   psd:   power values (µV²/Hz or dB µV²/Hz)
 */
export function computePSD(signal, sampleRate = 256, opts = {}) {
  const {
    nfft    = nextPow2(signal.length),
    window  = 'hann',
    dbScale = true,
  } = opts

  // Zero-pad or truncate to nfft
  const re = new Float64Array(nfft)
  const im = new Float64Array(nfft)
  const usedLength = Math.min(signal.length, nfft)
  for (let i = 0; i < usedLength; i++) {
    re[i] = signal[i]
  }

  // Apply window and retain its energy for density normalization. FFT zero
  // padding improves frequency sampling but must not change total power.
  let windowEnergy = usedLength
  if (window === 'hann') {
    const w = hannWindow(re.slice(0, usedLength))
    windowEnergy = 0
    for (let i = 0; i < usedLength; i++) {
      re[i] = w[i]
      const coefficient = usedLength > 1
        ? 0.5 * (1 - Math.cos((2 * Math.PI * i) / (usedLength - 1)))
        : 1
      windowEnergy += coefficient * coefficient
    }
  }

  // FFT
  fft(re, im)

  // One-sided PSD (bins 0 to nfft/2)
  const nBins = nfft / 2 + 1
  const freqs = new Float64Array(nBins)
  const psd   = new Float64Array(nBins)

  const normFactor = sampleRate * Math.max(windowEnergy, Number.EPSILON)

  for (let k = 0; k < nBins; k++) {
    freqs[k] = (k * sampleRate) / nfft
    let power = (re[k] * re[k] + im[k] * im[k]) / normFactor
    // Double non-DC, non-Nyquist bins for one-sided
    if (k > 0 && k < nfft / 2) power *= 2
    psd[k] = dbScale ? 10 * Math.log10(power + 1e-12) : power
  }

  return { freqs, psd }
}

// ─── Band Power ───────────────────────────────────────────────────────────────

export const EEG_BANDS = {
  delta: { min: 0.5, max: 4,  label: 'δ Delta',  color: '#7B5EA7' },
  theta: { min: 4,   max: 8,  label: 'θ Theta',  color: '#00D4FF' },
  alpha: { min: 8,   max: 13, label: 'α Alpha',  color: '#00FFB0' },
  beta:  { min: 13,  max: 30, label: 'β Beta',   color: '#FF6B35' },
  gamma: { min: 30,  max: 45, label: 'γ Gamma',  color: '#FFD166' },
}

/**
 * Integrate a linear PSD over a frequency band using trapezoidal integration.
 * Returns total power in that band (µV²).
 */
export function bandPower(freqs, psd, fMin, fMax) {
  if (freqs.length < 2 || psd.length !== freqs.length || fMax <= fMin) return 0
  let power = 0
  for (let i = 0; i < freqs.length - 1; i++) {
    const f0 = freqs[i]
    const f1 = freqs[i + 1]
    if (f1 <= fMin || f0 >= fMax || f1 <= f0) continue
    const left = Math.max(f0, fMin)
    const right = Math.min(f1, fMax)
    if (right <= left) continue
    const span = f1 - f0
    const pLeft = psd[i] + (psd[i + 1] - psd[i]) * ((left - f0) / span)
    const pRight = psd[i] + (psd[i + 1] - psd[i]) * ((right - f0) / span)
    power += ((pLeft + pRight) / 2) * (right - left)
  }
  return power
}

/**
 * Compute power in all standard EEG bands.
 * Returns { delta, theta, alpha, beta, gamma } (normalised 0–1 relative power)
 */
export function computeBandPowers(freqs, psd) {
  const raw = {}
  let total = 0
  for (const [key, { min, max }] of Object.entries(EEG_BANDS)) {
    raw[key] = Math.max(0, bandPower(freqs, psd, min, max))
    total += raw[key]
  }
  const normalised = {}
  for (const key of Object.keys(raw)) {
    normalised[key] = total > 0 ? raw[key] / total : 0
  }
  return normalised
}

// ─── Spectrogram ──────────────────────────────────────────────────────────────

/**
 * Compute a short-time Fourier transform (STFT) spectrogram.
 *
 * @param {Float32Array} signal
 * @param {number} sampleRate
 * @param {object} opts
 *   - frameSize:  FFT window length in samples (default 256)
 *   - hopSize:    hop length in samples (default 128)
 *   - maxFreq:    maximum frequency to include (default 40 Hz)
 *
 * @returns {{ timeSteps: number[], freqBins: number[], matrix: Float64Array[] }}
 */
export function computeSpectrogram(signal, sampleRate = 256, opts = {}) {
  const {
    frameSize = 256,
    hopSize   = 64,
    maxFreq   = 40,
  } = opts

  const nFrames   = Math.floor((signal.length - frameSize) / hopSize) + 1
  const timeSteps = []
  const matrix    = []

  for (let f = 0; f < nFrames; f++) {
    const start  = f * hopSize
    const frame  = signal.slice(start, start + frameSize)
    const { freqs, psd } = computePSD(frame, sampleRate, { nfft: frameSize, dbScale: true })

    timeSteps.push(start / sampleRate)

    // Trim to maxFreq
    const col = []
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] <= maxFreq) col.push(psd[i])
    }
    matrix.push(col)
  }

  // Frequency bins (up to maxFreq)
  const { freqs: allFreqs } = computePSD(signal.slice(0, frameSize), sampleRate, { nfft: frameSize })
  const freqBins = Array.from(allFreqs).filter(f => f <= maxFreq)

  return { timeSteps, freqBins, matrix }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextPow2(n) {
  let p = 1
  while (p < n) p <<= 1
  return p
}
