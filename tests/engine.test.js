import { describe, it, expect } from 'vitest'

import {
  SAMPLE_RATE,
  ELECTRODES_1020,
  generateMultiChannelEEG,
  makeTimeAxis,
} from '../src/engine/signalGenerator.js'
import { computePSD, computeSpectrogram, bandPower, EEG_BANDS } from '../src/engine/fft.js'

describe('generateMultiChannelEEG', () => {
  it('returns a complete fixed-length channel set', () => {
    const duration = 2
    const eeg = generateMultiChannelEEG({
      duration,
      pattern: 'normal_awake',
      amplitude: 50,
      noiseLevel: 0.1,
    })

    expect(eeg.sampleRate).toBe(SAMPLE_RATE)
    expect(eeg.duration).toBe(duration)
    expect(eeg.nSamples).toBe(duration * SAMPLE_RATE)
    expect(Object.keys(eeg.channels)).toEqual(ELECTRODES_1020)

    for (const label of ELECTRODES_1020) {
      expect(eeg.channels[label]).toHaveLength(eeg.nSamples)
    }
  })

  it('produces finite values for all patterns', () => {
    const patterns = [
      'normal_awake',
      'normal_drowsy',
      'normal_sleep',
      'absence',
      'focal_slowing',
      'burst_suppression',
    ]

    for (const pattern of patterns) {
      const eeg = generateMultiChannelEEG({
        duration: 1,
        pattern,
        eyesClosed: pattern === 'normal_awake' ? true : false,
      })
      for (const label of ['F3', 'Cz', 'O1']) {
        for (const v of eeg.channels[label]) {
          expect(Number.isFinite(v)).toBe(true)
        }
      }
    }
  })

  it('eyes-open reduces alpha amplitude at occipital', () => {
    const eyesClosed = generateMultiChannelEEG({
      duration: 2,
      pattern: 'normal_awake',
      eyesClosed: true,
    })
    const eyesOpen = generateMultiChannelEEG({
      duration: 2,
      pattern: 'normal_awake',
      eyesClosed: false,
    })

    const rmsClosed = Math.sqrt(
      eyesClosed.channels.O2.reduce((s, v) => s + v * v, 0) / eyesClosed.nSamples,
    )
    const rmsOpen = Math.sqrt(
      eyesOpen.channels.O2.reduce((s, v) => s + v * v, 0) / eyesOpen.nSamples,
    )

    // Alpha attenuation when eyes open: RMS should be lower
    expect(rmsOpen).toBeLessThan(rmsClosed)
  })
})

describe('makeTimeAxis', () => {
  it('maps sample indices to seconds', () => {
    expect(makeTimeAxis(4, 2)).toEqual([0, 0.5, 1, 1.5])
  })

  it('handles single sample', () => {
    expect(makeTimeAxis(1, 256)).toEqual([0])
  })
})

describe('computePSD', () => {
  it('detects the dominant frequency of a clean sine wave', () => {
    const sampleRate = 256
    const freq = 10
    const signal = Float32Array.from({ length: sampleRate * 2 }, (_, i) =>
      Math.sin((2 * Math.PI * freq * i) / sampleRate),
    )

    const { freqs, psd } = computePSD(signal, sampleRate, {
      nfft: 512,
      window: 'rect',
      dbScale: false,
    })

    let peakIndex = 0
    for (let i = 1; i < psd.length; i++) {
      if (psd[i] > psd[peakIndex]) peakIndex = i
    }

    expect(freqs[peakIndex]).toBe(freq)
  })

  it('returns expected number of frequency bins', () => {
    const signal = new Float32Array(256)
    const { freqs, psd } = computePSD(signal, 256, { nfft: 256 })
    expect(freqs).toHaveLength(129) // nfft/2 + 1
    expect(psd).toHaveLength(129)
  })

  it('dbScale outputs lower values at non-peak frequencies', () => {
    const sr = 256
    const signal = Float32Array.from({ length: sr * 2 }, (_, i) =>
      Math.sin((2 * Math.PI * 10 * i) / sr),
    )
    const { psd } = computePSD(signal, sr, { nfft: 512, dbScale: true })

    // Most values should be negative (dB)
    const peakIdx = psd.indexOf(Math.max(...psd))
    const offPeakIdx = psd.findIndex((_, i) => i > 20 && i !== peakIdx)
    expect(psd[offPeakIdx]).toBeLessThan(psd[peakIdx])
  })
})

describe('bandPower', () => {
  it('returns non-zero power in alpha band for an alpha signal', () => {
    const sr = 256
    const signal = Float32Array.from({ length: sr * 2 }, (_, i) =>
      Math.sin((2 * Math.PI * 10 * i) / sr),
    )
    const { freqs, psd } = computePSD(signal, sr, { nfft: 512, dbScale: false })
    const bp = bandPower(freqs, psd, EEG_BANDS.alpha.min, EEG_BANDS.alpha.max)
    expect(bp).toBeGreaterThan(0)
  })

  it('returns low power in gamma band for a 10Hz signal', () => {
    const sr = 256
    const signal = Float32Array.from({ length: sr * 2 }, (_, i) =>
      Math.sin((2 * Math.PI * 10 * i) / sr),
    )
    const { freqs, psd } = computePSD(signal, sr, { nfft: 512, dbScale: false })
    const alphaPower = bandPower(freqs, psd, EEG_BANDS.alpha.min, EEG_BANDS.alpha.max)
    const gammaPower = bandPower(freqs, psd, EEG_BANDS.gamma.min, EEG_BANDS.gamma.max)
    expect(alphaPower).toBeGreaterThan(gammaPower)
  })
})

describe('computeSpectrogram', () => {
  it('returns correct structure', () => {
    const sr = 256
    const signal = Float32Array.from({ length: sr * 4 }, (_, i) =>
      Math.sin((2 * Math.PI * 10 * i) / sr),
    )
    const spec = computeSpectrogram(signal, sr, { frameSize: 256, hopSize: 128, maxFreq: 40 })

    expect(spec.timeSteps.length).toBeGreaterThan(0)
    expect(spec.freqBins.length).toBeGreaterThan(0)
    expect(spec.matrix).toHaveLength(spec.timeSteps.length)
    expect(spec.matrix[0]).toHaveLength(spec.freqBins.length)
  })
})
