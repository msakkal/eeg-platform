import { computePSD, computeBandPowers, computeSpectrogram } from '@/engine/fft'

const handlers = {
  psd(args) {
    const { signal, sampleRate, opts } = args
    const result = computePSD(signal, sampleRate, opts)
    // Transfer buffers when possible; Float64Array is not transferable by
    // default but postMessage will structured-clone it.
    return { freqs: result.freqs, psd: result.psd }
  },

  bandPowers(args) {
    const { freqs, psd } = args
    return computeBandPowers(freqs, psd)
  },

  spectrogram(args) {
    const { signal, sampleRate, opts } = args
    return computeSpectrogram(signal, sampleRate, opts)
  },
}

self.onmessage = function (e) {
  const { id, type, args } = e.data
  try {
    const result = handlers[type]?.(args)
    self.postMessage({ id, result })
  } catch (err) {
    self.postMessage({ id, error: err.message })
  }
}
