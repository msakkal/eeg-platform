import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SAMPLE_RATE,
  ELECTRODES_1020,
  generateMultiChannelEEG,
  makeTimeAxis,
} from '../src/engine/signalGenerator.js'
import { computePSD } from '../src/engine/fft.js'

test('generateMultiChannelEEG returns a complete fixed-length channel set', () => {
  const duration = 2
  const eeg = generateMultiChannelEEG({
    duration,
    pattern: 'normal_awake',
    amplitude: 50,
    noiseLevel: 0.1,
  })

  assert.equal(eeg.sampleRate, SAMPLE_RATE)
  assert.equal(eeg.duration, duration)
  assert.equal(eeg.nSamples, duration * SAMPLE_RATE)
  assert.deepEqual(Object.keys(eeg.channels), ELECTRODES_1020)

  for (const label of ELECTRODES_1020) {
    assert.equal(eeg.channels[label].length, eeg.nSamples, label)
  }
})

test('makeTimeAxis maps sample indices to seconds', () => {
  assert.deepEqual(makeTimeAxis(4, 2), [0, 0.5, 1, 1.5])
})

test('computePSD detects the dominant frequency of a clean sine wave', () => {
  const sampleRate = 256
  const freq = 10
  const signal = Float32Array.from({ length: sampleRate * 2 }, (_, i) =>
    Math.sin((2 * Math.PI * freq * i) / sampleRate)
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

  assert.equal(freqs[peakIndex], freq)
})
