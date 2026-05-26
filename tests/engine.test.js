import { describe, it, expect } from 'vitest'

import {
  SAMPLE_RATE,
  ELECTRODES_1020,
  generateBackground,
  generateMultiChannelEEG,
  makeTimeAxis,
} from '../src/engine/signalGenerator.js'
import { createEngineForPattern } from '../src/engine/streaming.js'
import { computePSD, computeSpectrogram, bandPower, computeBandPowers, EEG_BANDS } from '../src/engine/fft.js'
import { SANDBOX_PATTERN_IDS } from '../src/engine/patterns.js'
import { generateDemoTrace } from '../src/engine/waveforms.js'

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

  it('produces finite values for every sandbox pattern', () => {
    for (const pattern of SANDBOX_PATTERN_IDS) {
      const eeg = generateMultiChannelEEG({
        duration: 3,
        pattern,
        eyesClosed: pattern === 'normal_awake' ? true : false,
        seed: 99,
      })
      for (const label of ['F3', 'Cz', 'O1']) {
        for (const v of eeg.channels[label]) {
          expect(Number.isFinite(v)).toBe(true)
        }
      }
    }
  })

  it('is reproducible when a seed is supplied', () => {
    const options = {
      duration: 3,
      pattern: 'photoparoxysmal',
      eyesClosed: false,
      seed: 2026,
    }
    const first = generateMultiChannelEEG(options)
    const second = generateMultiChannelEEG(options)
    const third = generateMultiChannelEEG({ ...options, seed: 2027 })

    expect(Array.from(second.channels.O1)).toEqual(Array.from(first.channels.O1))
    expect(Array.from(third.channels.O1)).not.toEqual(Array.from(first.channels.O1))
  })

  it('keeps buffered electrocerebral inactivity near-flat', () => {
    const eeg = generateMultiChannelEEG({
      duration: 2,
      pattern: 'electrocerebral_silence',
      seed: 42,
    })
    let maxAbs = 0
    for (const channel of Object.values(eeg.channels)) {
      for (const value of channel) maxAbs = Math.max(maxAbs, Math.abs(value))
    }
    expect(maxAbs).toBeLessThan(5)
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

describe('generateBackground', () => {
  it('is reproducible when a seed is supplied', () => {
    const options = { freqBands: ['alpha', 'theta'], amplitude: 30, noiseLevel: 0.2, seed: 77 }
    const first = generateBackground(512, SAMPLE_RATE, options)
    const second = generateBackground(512, SAMPLE_RATE, options)
    const third = generateBackground(512, SAMPLE_RATE, { ...options, seed: 78 })

    expect(Array.from(second)).toEqual(Array.from(first))
    expect(Array.from(third)).not.toEqual(Array.from(first))
  })
})

describe('generateDemoTrace', () => {
  it('uses a stable default seed per waveform id', () => {
    const first = generateDemoTrace('triphasic_waves', SAMPLE_RATE)
    const second = generateDemoTrace('triphasic_waves', SAMPLE_RATE)

    expect(Array.from(second)).toEqual(Array.from(first))
  })

  it('is reproducible when a seed is supplied', () => {
    const first = generateDemoTrace('hypsarrhythmia', SAMPLE_RATE, { seed: 123 })
    const second = generateDemoTrace('hypsarrhythmia', SAMPLE_RATE, { seed: 123 })
    const third = generateDemoTrace('hypsarrhythmia', SAMPLE_RATE, { seed: 124 })

    expect(Array.from(second)).toEqual(Array.from(first))
    expect(Array.from(third)).not.toEqual(Array.from(first))
  })
})

describe('createEngineForPattern', () => {
  const expected = {
    normal_awake: { mode: 'normal_awake', overlays: [] },
    normal_drowsy: { mode: 'normal_drowsy', overlays: [] },
    normal_sleep: { mode: 'normal_sleep', overlays: [] },
    slow_wave_sleep: { mode: 'slow_wave_sleep', overlays: [] },
    absence: { mode: 'normal_awake', overlays: ['AbsenceOverlay'] },
    slow_spike_wave: { mode: 'diffuse_slowing', overlays: ['SlowSpikeWaveOverlay'] },
    polyspike_jme: { mode: 'normal_awake', overlays: ['PolyspikeJmeOverlay'] },
    centrotemporal_spikes: { mode: 'normal_drowsy', overlays: ['CentrotemporalSpikesOverlay'] },
    temporal_sharps: { mode: 'normal_drowsy', overlays: ['TemporalSharpsOverlay'] },
    hypsarrhythmia: { mode: 'normal_sleep', overlays: ['HypsarrhythmiaOverlay'] },
    photoparoxysmal: { mode: 'normal_awake', overlays: ['PhotoparoxysmalOverlay'] },
    gpds: { mode: 'diffuse_slowing', overlays: ['GpdsOverlay'] },
    lpds: { mode: 'diffuse_slowing', overlays: ['LpdsOverlay'] },
    triphasic_waves: { mode: 'diffuse_slowing', overlays: ['TriphasicWavesOverlay'] },
    focal_slowing: { mode: 'normal_awake', overlays: ['FocalSlowingOverlay'] },
    firda: { mode: 'diffuse_slowing', overlays: ['FirdaOverlay'] },
    diffuse_slowing: { mode: 'diffuse_slowing', overlays: [] },
    breach_rhythm: { mode: 'normal_awake', overlays: ['BreachRhythmOverlay'] },
    burst_suppression: { mode: 'slow_wave_sleep', overlays: ['BurstSuppressionOverlay'] },
    alpha_coma: { mode: 'alpha_coma', overlays: [] },
    electrocerebral_silence: { mode: 'electrocerebral_inactivity', overlays: [] },
  }

  it('maps every sandbox pattern to a distinct streaming mode or overlay', () => {
    expect(Object.keys(expected).sort()).toEqual([...SANDBOX_PATTERN_IDS].sort())

    for (const pattern of SANDBOX_PATTERN_IDS) {
      const engine = createEngineForPattern(pattern, {
        eyesClosed: true,
        blinksEnabled: false,
        seed: 1234,
      })
      const overlayNames = engine.overlays.map(o => o.constructor.name)
      const pathologyOverlays = overlayNames.filter(name => name !== 'CardiacOverlay')

      expect(engine.mode).toBe(expected[pattern].mode)
      expect(pathologyOverlays).toEqual(expected[pattern].overlays)
      if (pattern === 'electrocerebral_silence') {
        expect(overlayNames).not.toContain('CardiacOverlay')
      } else {
        expect(overlayNames).toContain('CardiacOverlay')
      }
    }
  })

  it('keeps electrocerebral inactivity near-flat without ambient cardiac artifact', () => {
    const engine = createEngineForPattern('electrocerebral_silence', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0.25,
      seed: 42,
    })
    const overlayNames = engine.overlays.map(o => o.constructor.name)
    expect(overlayNames).not.toContain('CardiacOverlay')

    const window = engine.fillWindow(2)
    let maxAbs = 0
    for (const channel of Object.values(window)) {
      for (const value of channel) maxAbs = Math.max(maxAbs, Math.abs(value))
    }
    expect(maxAbs).toBeLessThan(5)
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

  it('normalizes a 10Hz sine as alpha-dominant from linear PSD', () => {
    const sr = 256
    const signal = Float32Array.from({ length: sr * 2 }, (_, i) =>
      Math.sin((2 * Math.PI * 10 * i) / sr),
    )
    const { freqs, psd } = computePSD(signal, sr, { nfft: 512, window: 'rect', dbScale: false })
    const bands = computeBandPowers(freqs, psd)
    expect(bands.alpha).toBeGreaterThan(0.95)
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
