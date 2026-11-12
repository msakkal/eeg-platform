import { ADDITIONAL_PATTERN_CONFIG } from '../src/engine/additionalPatterns.js'
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
import { applyFilterChain, getCachedFilterSOS } from '../src/engine/filters.js'
import { SANDBOX_PATTERN_IDS } from '../src/engine/patterns.js'
import { generateDemoTrace, WAVEFORM_PATTERNS } from '../src/engine/waveforms.js'

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
  }, 10000)

  it('renders BIRDs as a brief focal temporal rhythmic run', () => {
    const eeg = generateMultiChannelEEG({
      duration: 4,
      pattern: 'birds',
      eyesClosed: true,
      noiseLevel: 0.05,
      seed: 2026,
    })
    const start = Math.round(0.9 * eeg.sampleRate)
    const end = Math.round(2.8 * eeg.sampleRate)
    const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length)
    const temporalRms = rms(Array.from(eeg.channels.T7.slice(start, end)))
    const occipitalRms = rms(Array.from(eeg.channels.O2.slice(start, end)))

    expect(temporalRms).toBeGreaterThan(occipitalRms * 1.35)
    expect(WAVEFORM_PATTERNS.birds.duration).toContain('< 10 s')
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

  it('renders N1 with attenuated posterior alpha and roving lateral eye movements', () => {
    const common = {
      duration: 12,
      amplitude: 50,
      noiseLevel: 0.05,
      blinksEnabled: false,
      seed: 404,
    }
    const awake = generateMultiChannelEEG({
      ...common,
      pattern: 'normal_awake',
      eyesClosed: true,
    })
    const drowsy = generateMultiChannelEEG({
      ...common,
      pattern: 'normal_drowsy',
      eyesClosed: true,
    })

    const alphaPower = signal => {
      const { freqs, psd } = computePSD(signal, SAMPLE_RATE, { dbScale: false })
      return bandPower(freqs, psd, EEG_BANDS.alpha.min, EEG_BANDS.alpha.max)
    }
    const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length)
    const f7 = drowsy.channels.F7
    const f8 = drowsy.channels.F8
    const lateralDiff = Float32Array.from(f8, (value, index) => value - f7[index])
    const lateralSum = Float32Array.from(f8, (value, index) => value + f7[index])

    expect(alphaPower(drowsy.channels.O1)).toBeLessThan(alphaPower(awake.channels.O1) * 0.25)
    expect(rms(lateralDiff)).toBeGreaterThan(rms(lateralSum) * 1.25)
  })

  it('renders buffered N2 K-complexes as frontocentral negative-positive complexes', () => {
    const eeg = generateMultiChannelEEG({
      duration: 10,
      pattern: 'normal_sleep',
      noiseLevel: 0,
      seed: 808,
    })
    const trace = eeg.channels.Fz
    let max = -Infinity
    let maxIdx = 0

    for (let i = 0; i < trace.length; i++) {
      if (trace[i] > max) {
        max = trace[i]
        maxIdx = i
      }
    }

    let min = Infinity
    let minIdx = 0
    const searchStart = Math.max(0, maxIdx - Math.round(0.55 * SAMPLE_RATE))
    for (let i = searchStart; i < maxIdx; i++) {
      if (trace[i] < min) {
        min = trace[i]
        minIdx = i
      }
    }

    const peakLagSec = (maxIdx - minIdx) / SAMPLE_RATE
    expect(min).toBeLessThan(-70)
    expect(max).toBeGreaterThan(180)
    expect(max).toBeGreaterThan(Math.abs(min) * 1.8)
    expect(peakLagSec).toBeGreaterThan(0.22)
    expect(peakLagSec).toBeLessThan(0.55)
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

  it('renders beta as low-amplitude fast activity', () => {
    const trace = generateDemoTrace('beta', SAMPLE_RATE)
    const { freqs, psd } = computePSD(trace, SAMPLE_RATE, { dbScale: false })
    let peakFreq = 0
    let peakPower = -Infinity
    let min = Infinity
    let max = -Infinity

    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] < 8 || freqs[i] > 35) continue
      if (psd[i] > peakPower) {
        peakPower = psd[i]
        peakFreq = freqs[i]
      }
    }

    for (const value of trace) {
      min = Math.min(min, value)
      max = Math.max(max, value)
    }

    expect(peakFreq).toBeGreaterThanOrEqual(13)
    expect(peakFreq).toBeLessThanOrEqual(30)
    expect(max - min).toBeLessThan(22)
  })

  it('renders vertex sharp waves as brief surface-negative sleep transients', () => {
    const trace = generateDemoTrace('vertex_sharp_wave', SAMPLE_RATE, { seed: 123 })
    const eventSec = 1.18
    let min = Infinity
    let minIdx = 0
    let preMax = -Infinity
    let postMax = -Infinity

    for (let i = Math.round((eventSec - 0.08) * SAMPLE_RATE); i < Math.round((eventSec + 0.10) * SAMPLE_RATE); i++) {
      if (trace[i] < min) {
        min = trace[i]
        minIdx = i
      }
    }
    for (let i = Math.round((eventSec - 0.10) * SAMPLE_RATE); i < Math.round((eventSec - 0.035) * SAMPLE_RATE); i++) {
      preMax = Math.max(preMax, trace[i])
    }
    for (let i = Math.round((eventSec + 0.045) * SAMPLE_RATE); i < Math.round((eventSec + 0.17) * SAMPLE_RATE); i++) {
      postMax = Math.max(postMax, trace[i])
    }

    const halfAmplitude = min * 0.5
    let left = minIdx
    let right = minIdx
    while (left > 0 && trace[left] <= halfAmplitude) left--
    while (right < trace.length && trace[right] <= halfAmplitude) right++
    const halfWidthSec = (right - left - 1) / SAMPLE_RATE

    expect(min).toBeLessThan(-90)
    expect(Math.abs(minIdx / SAMPLE_RATE - eventSec)).toBeLessThan(0.02)
    expect(halfWidthSec).toBeGreaterThan(0.04)
    expect(halfWidthSec).toBeLessThan(0.08)
    expect(preMax).toBeGreaterThan(12)
    expect(postMax).toBeGreaterThan(20)
    expect(postMax).toBeLessThan(Math.abs(min) * 0.35)
  })

  it('renders K-complexes as a high-voltage sharp negative followed by a slower positive component', () => {
    const trace = generateDemoTrace('k_complex', SAMPLE_RATE, { seed: 123 })
    const eventSec = 0.82
    let min = Infinity
    let minIdx = 0
    let max = -Infinity
    let maxIdx = 0

    for (let i = Math.round((eventSec - 0.05) * SAMPLE_RATE); i < Math.round((eventSec + 0.16) * SAMPLE_RATE); i++) {
      if (trace[i] < min) {
        min = trace[i]
        minIdx = i
      }
    }
    for (let i = Math.round((eventSec + 0.12) * SAMPLE_RATE); i < Math.round((eventSec + 0.80) * SAMPLE_RATE); i++) {
      if (trace[i] > max) {
        max = trace[i]
        maxIdx = i
      }
    }

    const negativeHalfAmplitude = min * 0.5
    let negativeLeft = minIdx
    let negativeRight = minIdx
    while (negativeLeft > 0 && trace[negativeLeft] <= negativeHalfAmplitude) negativeLeft--
    while (negativeRight < trace.length && trace[negativeRight] <= negativeHalfAmplitude) negativeRight++
    const negativeHalfWidthSec = (negativeRight - negativeLeft - 1) / SAMPLE_RATE

    const positiveHalfAmplitude = max * 0.5
    let positiveLeft = maxIdx
    let positiveRight = maxIdx
    while (positiveLeft > 0 && trace[positiveLeft] >= positiveHalfAmplitude) positiveLeft--
    while (positiveRight < trace.length && trace[positiveRight] >= positiveHalfAmplitude) positiveRight++
    const positiveHalfWidthSec = (positiveRight - positiveLeft - 1) / SAMPLE_RATE
    const peakLagSec = (maxIdx - minIdx) / SAMPLE_RATE

    expect(min).toBeLessThan(-155)
    expect(max).toBeGreaterThan(115)
    expect(Math.abs(min)).toBeGreaterThan(max * 1.12)
    expect(negativeHalfWidthSec).toBeGreaterThan(0.04)
    expect(negativeHalfWidthSec).toBeLessThan(0.09)
    expect(peakLagSec).toBeGreaterThan(0.25)
    expect(peakLagSec).toBeLessThan(0.55)
    expect(positiveHalfWidthSec).toBeGreaterThan(negativeHalfWidthSec * 4)
    expect(positiveHalfWidthSec).toBeLessThan(0.50)
  })

  it('renders mu as a reactive central alpha rhythm rather than generic alpha', () => {
    const trace = generateDemoTrace('mu', SAMPLE_RATE, { seed: 10 })
    const { freqs, psd } = computePSD(trace, SAMPLE_RATE, { dbScale: false })
    let peakFreq = 0
    let peakPower = -Infinity

    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] < 7 || freqs[i] > 14) continue
      if (psd[i] > peakPower) {
        peakPower = psd[i]
        peakFreq = freqs[i]
      }
    }

    const rms = (startSec, endSec) => {
      let sum = 0
      let count = 0
      for (let i = Math.round(startSec * SAMPLE_RATE); i < Math.round(endSec * SAMPLE_RATE); i++) {
        sum += trace[i] * trace[i]
        count++
      }
      return Math.sqrt(sum / count)
    }

    let min = Infinity
    let max = -Infinity
    for (let i = Math.round(0.25 * SAMPLE_RATE); i < Math.round(1.0 * SAMPLE_RATE); i++) {
      min = Math.min(min, trace[i])
      max = Math.max(max, trace[i])
    }

    expect(peakFreq).toBeGreaterThanOrEqual(8)
    expect(peakFreq).toBeLessThanOrEqual(13)
    expect(rms(1.25, 1.75)).toBeLessThan(rms(0.25, 1.0) * 0.55)
    expect(Math.abs(min)).toBeGreaterThan(max * 1.35)
  })

  it('renders lambda waves as irregular positive sharps on an eyes-open background', () => {
    const trace = generateDemoTrace('lambda_waves', SAMPLE_RATE, { seed: 714 })
    const onsets = [0.38, 0.72, 1.27, 1.54, 2.12, 2.58]
    const peaks = onsets.map(onset => {
      let peak = -Infinity
      const start = Math.round(onset * SAMPLE_RATE)
      const end = Math.min(trace.length, start + Math.round(0.18 * SAMPLE_RATE))
      for (let i = start; i < end; i++) peak = Math.max(peak, trace[i])
      return peak
    })

    expect(Math.min(...peaks)).toBeGreaterThan(28)
    expect(Math.max(...peaks) - Math.min(...peaks)).toBeGreaterThan(3)
    expect(WAVEFORM_PATTERNS.lambda_waves.pathological).toBe(false)
    expect(WAVEFORM_PATTERNS.lambda_waves.location).toContain('O1/O2')
  })

})

describe('createEngineForPattern', () => {
  const expected = {
    ...Object.fromEntries(Object.entries(ADDITIONAL_PATTERN_CONFIG).map(([id, config]) => [id, { mode: config.mode, overlays: [config.overlay] }])),
    normal_awake: { mode: 'normal_awake', overlays: [] },
    fast_alpha_variant: { mode: 'fast_alpha_variant', overlays: [] },
    mu_rhythm: { mode: 'mu_rhythm', overlays: ['MuRhythmEventOverlay'] },
    central_midline_theta: { mode: 'normal_awake', overlays: ['CentralMidlineThetaOverlay'] },
    lambda_waves: { mode: 'normal_awake', overlays: ['LambdaWavesOverlay'] },
    rmtd: { mode: 'rmtd', overlays: ['RhythmicMidtemporalThetaOverlay'] },
    wicket_rhythm: { mode: 'wicket_rhythm', overlays: ['WicketRhythmOverlay'] },
    sreda: { mode: 'normal_drowsy', overlays: ['SredaOverlay'] },
    small_sharp_spikes: { mode: 'normal_drowsy', overlays: ['SmallSharpSpikesOverlay'] },
    phantom_spike_wave: { mode: 'normal_drowsy', overlays: ['PhantomSpikeWaveOverlay'] },
    positive_spikes_14_6: { mode: 'normal_drowsy', overlays: ['PositiveSpikes146Overlay'] },
    posterior_slow_waves_youth: { mode: 'normal_awake', overlays: ['PosteriorSlowWavesYouthOverlay'] },
    normal_drowsy: { mode: 'normal_drowsy', overlays: ['SlowRovingEyeMovementOverlay', 'N1SleepGraphoelementsOverlay', 'SmallSharpSpikesOverlay'] },
    normal_sleep: { mode: 'normal_sleep', overlays: ['N2SleepGraphoelementsOverlay', 'SmallSharpSpikesOverlay'] },
    normal_rem: { mode: 'normal_rem', overlays: ['RapidEyeMovementOverlay'] },
    slow_wave_sleep: { mode: 'slow_wave_sleep', overlays: [] },
    absence: { mode: 'normal_awake', overlays: ['AbsenceOverlay'] },
    slow_spike_wave: { mode: 'diffuse_slowing', overlays: ['SlowSpikeWaveOverlay'] },
    polyspike_jme: { mode: 'normal_awake', overlays: ['PolyspikeJmeOverlay'] },
    centrotemporal_spikes: { mode: 'normal_drowsy', overlays: ['CentrotemporalSpikesOverlay'] },
    temporal_sharps: { mode: 'normal_drowsy', overlays: ['TemporalSharpsOverlay'] },
    birds: { mode: 'normal_drowsy', overlays: ['BirdsOverlay'] },
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

  it('adds N1 vertex waves and POSTS to the drowsy sandbox simulation', () => {
    const engine = createEngineForPattern('normal_drowsy', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0.1,
      seed: 2026,
    })
    engine.fillWindow(10)

    const eventTypes = new Set(engine.getEventsSince(0).map(event => event.type))
    expect(eventTypes.has('vertex_wave')).toBe(true)
    expect(eventTypes.has('posts')).toBe(true)
    expect(eventTypes.has('small_sharp_spike')).toBe(true)
  })

  it('adds BETS to the N2 sandbox simulation', () => {
    const engine = createEngineForPattern('normal_sleep', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0.1,
      seed: 2027,
    })
    engine.fillWindow(10)

    const bets = engine.getEventsSince(0).filter(event => event.type === 'small_sharp_spike')
    expect(bets.length).toBeGreaterThanOrEqual(4)
    expect(bets.every(event => event.detail.includes('low-amplitude temporal sleep transient'))).toBe(true)
  })

  it('renders sandbox POSTS as clearly positive occipital sharp transients', () => {
    const engine = createEngineForPattern('normal_drowsy', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 2026,
    })
    const window = engine.fillWindow(10)
    const event = engine.getEventsSince(0).find(({ type }) => type === 'posts')
    expect(event).toBeTruthy()

    const start = Math.round(event.t * SAMPLE_RATE)
    const end = Math.min(window.O1.length, start + Math.round(0.21 * SAMPLE_RATE))
    let occipitalPeak = -Infinity
    let parietalPeak = -Infinity
    for (let i = start; i < end; i++) {
      occipitalPeak = Math.max(occipitalPeak, window.O1[i])
      parietalPeak = Math.max(parietalPeak, window.Pz[i])
    }

    expect(occipitalPeak).toBeGreaterThan(40)
    expect(occipitalPeak).toBeGreaterThan(parietalPeak * 1.35)
  })

  it('renders REM as low-voltage mixed activity with rapid conjugate eye movements', () => {
    const engine = createEngineForPattern('normal_rem', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 707,
    })
    const window = engine.fillWindow(10)
    const events = engine.getEventsSince(0)
    const remEvent = events.find(({ type }) => type === 'rapid_eye_movement')
    expect(remEvent).toBeTruthy()
    expect(['Left gaze', 'Right gaze']).toContain(remEvent.label)
    expect(events.some(({ type }) => type === 'sleep_spindle' || type === 'k_complex')).toBe(false)

    const start = Math.round(remEvent.t * SAMPLE_RATE)
    const end = Math.min(window.F7.length, start + Math.round(0.30 * SAMPLE_RATE))
    let lateralDifference = 0
    let lateralSum = 0
    for (let i = start; i < end; i++) {
      lateralDifference = Math.max(lateralDifference, Math.abs(window.F8[i] - window.F7[i]))
      lateralSum = Math.max(lateralSum, Math.abs(window.F8[i] + window.F7[i]))
    }
    expect(lateralDifference).toBeGreaterThan(70)
    expect(lateralDifference).toBeGreaterThan(lateralSum * 1.4)
  })

  it('adds selectable activation procedures and records their events', () => {
    for (const procedure of ['hyperventilation', 'photic_stimulation', 'photomyogenic_response']) {
      const engine = createEngineForPattern('normal_awake', {
        eyesClosed: true,
        blinksEnabled: false,
        noiseLevel: 0,
        activationProcedure: procedure,
        seed: 818,
      })
      engine.fillWindow(7)
      expect(engine.overlays.map(overlay => overlay.constructor.name)).toContain('ActivationProcedureOverlay')
      expect(engine.getEventsSince(0).some(({ type }) => type === procedure)).toBe(true)
    }
  })

  it('renders the fast alpha variant as a reactive posterior 16–18 Hz rhythm', () => {
    const closed = createEngineForPattern('fast_alpha_variant', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 606,
    }).fillWindow(8)
    const open = createEngineForPattern('fast_alpha_variant', {
      eyesClosed: false,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 606,
    }).fillWindow(8)
    const closedPsd = computePSD(closed.O1, SAMPLE_RATE, { dbScale: false })
    const openPsd = computePSD(open.O1, SAMPLE_RATE, { dbScale: false })
    let peakFrequency = 0
    let peakPower = -Infinity
    for (let i = 0; i < closedPsd.freqs.length; i++) {
      if (closedPsd.freqs[i] < 13 || closedPsd.freqs[i] > 21) continue
      if (closedPsd.psd[i] > peakPower) {
        peakPower = closedPsd.psd[i]
        peakFrequency = closedPsd.freqs[i]
      }
    }
    expect(peakFrequency).toBeGreaterThanOrEqual(16)
    expect(peakFrequency).toBeLessThanOrEqual(18)
    expect(bandPower(openPsd.freqs, openPsd.psd, 14, 20)).toBeLessThan(
      bandPower(closedPsd.freqs, closedPsd.psd, 14, 20) * 0.35,
    )
  })

  it('renders sandbox mu as a broad-cycle central 8–10 Hz rhythm', () => {
    const window = createEngineForPattern('mu_rhythm', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 505,
    }).fillWindow(8)
    const central = computePSD(window.C3, SAMPLE_RATE, { dbScale: false })
    const posterior = computePSD(window.O1, SAMPLE_RATE, { dbScale: false })
    const centralPower = bandPower(central.freqs, central.psd, 8, 13)
    const posteriorPower = bandPower(posterior.freqs, posterior.psd, 8, 13)

    let peakFrequency = 0
    let peakPower = -Infinity
    for (let i = 0; i < central.freqs.length; i++) {
      if (central.freqs[i] < 8 || central.freqs[i] > 13) continue
      if (central.psd[i] > peakPower) {
        peakPower = central.psd[i]
        peakFrequency = central.freqs[i]
      }
    }
    expect(peakFrequency).toBeGreaterThanOrEqual(8)
    expect(peakFrequency).toBeLessThanOrEqual(10)
    expect(centralPower).toBeGreaterThan(posteriorPower * 2)

    let min = Infinity
    let max = -Infinity
    for (let i = SAMPLE_RATE; i < window.C3.length - SAMPLE_RATE; i++) {
      min = Math.min(min, window.C3[i])
      max = Math.max(max, window.C3[i])
    }
    expect(min).toBeLessThan(-25)
    expect(Math.abs(min)).toBeGreaterThan(max * 1.2)

    let dot = 0
    let leftEnergy = 0
    let rightEnergy = 0
    for (let i = 0; i < window.C3.length; i++) {
      const f3c3 = window.F3[i] - window.C3[i]
      const c3p3 = window.C3[i] - window.P3[i]
      dot += f3c3 * c3p3
      leftEnergy += f3c3 * f3c3
      rightEnergy += c3p3 * c3p3
    }
    expect(dot / Math.sqrt(leftEnergy * rightEnergy)).toBeLessThan(-0.65)

    expect(createEngineForPattern('mu_rhythm', { seed: 505 })
      .fillWindow(6)).toBeTruthy()

    const eventEngine = createEngineForPattern('mu_rhythm', { seed: 505 })
    eventEngine.fillWindow(6)
    expect(eventEngine.getEventsSince(0).some(({ type }) => type === 'mu_rhythm')).toBe(true)
  })

  it('renders lambda waves as eyes-open positive occipital sharp transients', () => {
    const engine = createEngineForPattern('lambda_waves', {
      eyesClosed: false,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 414,
    })
    const window = engine.fillWindow(8)
    const event = engine.getEventsSince(0).find(({ type }) => type === 'lambda_wave')
    expect(event).toBeTruthy()
    expect(event.durationS).toBeGreaterThanOrEqual(0.105)
    expect(event.durationS).toBeLessThanOrEqual(0.175)

    const start = Math.round(event.t * SAMPLE_RATE)
    const end = Math.min(window.O1.length, Math.round((event.t + event.durationS) * SAMPLE_RATE))
    let occipitalPeak = -Infinity
    let centralPeak = -Infinity
    let dominantSide = null
    for (let i = start; i < end; i++) {
      const o1 = window.O1[i]
      const o2 = window.O2[i]
      if (Math.max(o1, o2) > occipitalPeak) {
        occipitalPeak = Math.max(o1, o2)
        dominantSide = o1 > o2 ? 'O1' : 'O2'
      }
      centralPeak = Math.max(centralPeak, window.Cz[i])
    }

    expect(occipitalPeak).toBeGreaterThan(25)
    expect(occipitalPeak).toBeGreaterThan(centralPeak * 1.8)
    expect(['O1', 'O2']).toContain(dominantSide)

    const lambdaEvents = engine.getEventsSince(0).filter(({ type }) => type === 'lambda_wave')
    expect(lambdaEvents.length).toBeGreaterThan(1)
    for (const lambdaEvent of lambdaEvents) {
      expect(lambdaEvent.durationS).toBeGreaterThanOrEqual(0.105)
      expect(lambdaEvent.durationS).toBeLessThanOrEqual(0.175)
    }
  })

  it('suppresses lambda waves when the eyes are closed', () => {
    const engine = createEngineForPattern('lambda_waves', {
      eyesClosed: true,
      blinksEnabled: false,
      seed: 414,
    })
    engine.fillWindow(8)
    expect(engine.getEventsSince(0).some(({ type }) => type === 'lambda_wave')).toBe(false)
  })

  it('renders RMTD as a non-evolving 5–7 Hz mid-temporal run', () => {
    const engine = createEngineForPattern('rmtd', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 626,
    })
    const window = engine.fillWindow(9)
    const event = engine.getEventsSince(0).find(({ type }) => type === 'rmtd')
    expect(event).toBeTruthy()
    expect(event.durationS).toBeGreaterThanOrEqual(2)
    expect(event.durationS).toBeLessThanOrEqual(4)

    const temporalPsd = ['T7', 'T8'].map(label => computePSD(window[label], SAMPLE_RATE, { dbScale: false }))
    const posteriorTemporalPsd = ['P7', 'P8'].map(label => computePSD(window[label], SAMPLE_RATE, { dbScale: false }))
    const centralPsd = computePSD(window.Cz, SAMPLE_RATE, { dbScale: false })
    const temporalPower = Math.max(...temporalPsd.map(({ freqs, psd }) => bandPower(freqs, psd, 5, 7.2)))
    const posteriorTemporalPower = Math.max(...posteriorTemporalPsd.map(
      ({ freqs, psd }) => bandPower(freqs, psd, 5, 7.2),
    ))
    const centralPower = bandPower(centralPsd.freqs, centralPsd.psd, 5, 7.2)
    expect(temporalPower).toBeGreaterThan(centralPower * 1.45)
    expect(temporalPower).toBeGreaterThan(posteriorTemporalPower * 1.65)

    let dominantPeak = 0
    let dominantPeakPower = -Infinity
    const dominant = temporalPsd.sort((a, b) =>
      bandPower(b.freqs, b.psd, 5, 7.2) - bandPower(a.freqs, a.psd, 5, 7.2))[0]
    for (let i = 0; i < dominant.freqs.length; i++) {
      if (dominant.freqs[i] < 5 || dominant.freqs[i] > 7.2) continue
      if (dominant.psd[i] > dominantPeakPower) {
        dominantPeakPower = dominant.psd[i]
        dominantPeak = dominant.freqs[i]
      }
    }
    expect(dominantPeak).toBeGreaterThanOrEqual(5)
    expect(dominantPeak).toBeLessThanOrEqual(7.2)

    const posterior = computePSD(window.O1, SAMPLE_RATE, { dbScale: false })
    let posteriorPeak = 0
    let posteriorPeakPower = -Infinity
    for (let i = 0; i < posterior.freqs.length; i++) {
      if (posterior.freqs[i] < 7.5 || posterior.freqs[i] > 12) continue
      if (posterior.psd[i] > posteriorPeakPower) {
        posteriorPeakPower = posterior.psd[i]
        posteriorPeak = posterior.freqs[i]
      }
    }
    expect(posteriorPeak).toBeGreaterThanOrEqual(8)
    expect(posteriorPeak).toBeLessThanOrEqual(11)
  })

  it('renders central midline theta as a Cz-maximal 4–7 Hz run', () => {
    const engine = createEngineForPattern('central_midline_theta', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 727,
    })
    const window = engine.fillWindow(9)
    const event = engine.getEventsSince(0).find(({ type }) => type === 'central_midline_theta')
    expect(event).toBeTruthy()
    expect(event.durationS).toBeGreaterThanOrEqual(3.2)
    expect(event.durationS).toBeLessThanOrEqual(5.5)

    const powerAt = label => {
      const { freqs, psd } = computePSD(window[label], SAMPLE_RATE, { dbScale: false })
      return bandPower(freqs, psd, 4, 7.2)
    }
    const czPower = powerAt('Cz')
    const adjacentPower = Math.max(powerAt('Fz'), powerAt('Pz'))
    const lateralPower = Math.max(powerAt('T7'), powerAt('T8'), powerAt('C3'), powerAt('C4'))
    expect(czPower).toBeGreaterThan(adjacentPower * 1.35)
    expect(czPower).toBeGreaterThan(lateralPower * 3)

    const demo = generateDemoTrace('central_midline_theta')
    expect(demo).toHaveLength(3 * SAMPLE_RATE)
    expect(WAVEFORM_PATTERNS.central_midline_theta.location).toContain('Cz')
    expect(WAVEFORM_PATTERNS.central_midline_theta.pathological).toBe(false)
  })

  it('renders wicket rhythm as a benign arciform temporal run', () => {
    const engine = createEngineForPattern('wicket_rhythm', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 737,
    })
    const window = engine.fillWindow(9)
    const event = engine.getEventsSince(0).find(({ type }) => type === 'wicket_rhythm')
    expect(event).toBeTruthy()
    expect(event.durationS).toBeGreaterThanOrEqual(1.25)
    expect(event.durationS).toBeLessThanOrEqual(3.05)

    const temporalPower = Math.max(...['T7', 'T8'].map(label => {
      const { freqs, psd } = computePSD(window[label], SAMPLE_RATE, { dbScale: false })
      return bandPower(freqs, psd, 6, 11)
    }))
    const central = computePSD(window.Cz, SAMPLE_RATE, { dbScale: false })
    expect(temporalPower).toBeGreaterThan(bandPower(central.freqs, central.psd, 6, 11) * 1.5)
    expect(WAVEFORM_PATTERNS.wicket_rhythm.pathological).toBe(false)
  })

  it('renders SREDA as a benign bilateral posterior temporoparietal theta run', () => {
    const engine = createEngineForPattern('sreda', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 848,
    })
    const window = engine.fillWindow(10)
    const event = engine.getEventsSince(0).find(({ type }) => type === 'sreda')
    expect(event).toBeTruthy()
    expect(event.durationS).toBeGreaterThanOrEqual(7.5)
    expect(event.durationS).toBeLessThanOrEqual(11.5)

    const posteriorTemporalPower = Math.max(...['P7', 'P8', 'T7', 'T8'].map(label => {
      const { freqs, psd } = computePSD(window[label], SAMPLE_RATE, { dbScale: false })
      return bandPower(freqs, psd, 5, 7.2)
    }))
    const frontal = computePSD(window.Fz, SAMPLE_RATE, { dbScale: false })
    expect(posteriorTemporalPower).toBeGreaterThan(bandPower(frontal.freqs, frontal.psd, 5, 7.2) * 2)
    expect(WAVEFORM_PATTERNS.sreda.pathological).toBe(false)
    expect(WAVEFORM_PATTERNS.sreda.location).toContain('posterior temporal')
  })

  it('renders BETS as sparse low-amplitude temporal transients on a preserved drowsy background', () => {
    const engine = createEngineForPattern('small_sharp_spikes', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 959,
    })
    const window = engine.fillWindow(8)
    const events = engine.getEventsSince(0).filter(({ type }) => type === 'small_sharp_spike')
    expect(events.length).toBeGreaterThanOrEqual(4)

    const first = events[0]
    const temporalLabel = first.detail.startsWith('Left') ? 'T7' : 'T8'
    const start = Math.max(0, Math.round((first.t - 0.025) * SAMPLE_RATE))
    const end = Math.min(window[temporalLabel].length, Math.round((first.t + 0.105) * SAMPLE_RATE))
    const eventPeak = Math.max(...Array.from(window[temporalLabel].slice(start, end), Math.abs))
    expect(eventPeak).toBeGreaterThan(15)
    expect(eventPeak).toBeLessThan(100)
    expect(WAVEFORM_PATTERNS.small_sharp_spikes.pathological).toBe(false)
    expect(WAVEFORM_PATTERNS.small_sharp_spikes.duration).toContain('< 50 ms')
  })

  it('renders phantom spike-wave as brief low-amplitude posterior 6 Hz bursts', () => {
    const engine = createEngineForPattern('phantom_spike_wave', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 1060,
    })
    const window = engine.fillWindow(10)
    const events = engine.getEventsSince(0).filter(({ type }) => type === 'phantom_spike_wave')
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events.every(event => event.durationS >= 1 && event.durationS <= 2)).toBe(true)

    const occipital = computePSD(window.O1, SAMPLE_RATE, { dbScale: false })
    const frontal = computePSD(window.Fz, SAMPLE_RATE, { dbScale: false })
    expect(bandPower(occipital.freqs, occipital.psd, 5, 7.2))
      .toBeGreaterThan(bandPower(frontal.freqs, frontal.psd, 5, 7.2) * 1.4)

    // Guard visibility in the default longitudinal bipolar P3–O1 channel as
    // well as in the automatically selected average-reference view.
    const first = events[0]
    const start = Math.round(first.t * SAMPLE_RATE)
    const end = Math.round((first.t + first.durationS) * SAMPLE_RATE)
    const bipolar = Array.from(window.P3.slice(start, end), (value, index) =>
      value - window.O1[start + index])
    expect(Math.max(...bipolar) - Math.min(...bipolar)).toBeGreaterThan(35)
    expect(WAVEFORM_PATTERNS.phantom_spike_wave.pathological).toBe(false)
    expect(WAVEFORM_PATTERNS.phantom_spike_wave.freq).toContain('5–7 Hz')
  })

  it('does not apply activation procedures to incompatible sleep patterns', () => {
    const engine = createEngineForPattern('normal_sleep', {
      activationProcedure: 'hyperventilation',
      seed: 919,
    })
    expect(engine.overlays.map(overlay => overlay.constructor.name)).not.toContain('ActivationProcedureOverlay')
  })

  it('suppresses N1 posterior dominant rhythm while adding slow horizontal eye movements', () => {
    const common = {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0.05,
      seed: 515,
    }
    const awake = createEngineForPattern('normal_awake', common)
    const drowsy = createEngineForPattern('normal_drowsy', common)
    const awakeWindow = awake.fillWindow(12)
    const drowsyWindow = drowsy.fillWindow(12)

    const alphaPower = signal => {
      const { freqs, psd } = computePSD(signal, SAMPLE_RATE, { dbScale: false })
      return bandPower(freqs, psd, EEG_BANDS.alpha.min, EEG_BANDS.alpha.max)
    }
    const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length)
    const lateralDiff = Float32Array.from(drowsyWindow.F8, (value, index) => value - drowsyWindow.F7[index])
    const lateralSum = Float32Array.from(drowsyWindow.F8, (value, index) => value + drowsyWindow.F7[index])

    expect(alphaPower(drowsyWindow.O1)).toBeLessThan(alphaPower(awakeWindow.O1) * 0.25)
    expect(rms(lateralDiff)).toBeGreaterThan(rms(lateralSum) * 1.25)
  })

  it('renders streaming N2 K-complexes with a sharp negative and broad positive component', () => {
    const engine = createEngineForPattern('normal_sleep', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 909,
    })
    const window = engine.fillWindow(12)
    const event = engine.getEventsSince(0).find(({ type }) => type === 'k_complex')
    expect(event).toBeTruthy()

    const trace = window.Fz
    const eventSec = event.t
    let min = Infinity
    let minIdx = 0
    let max = -Infinity
    let maxIdx = 0

    for (let i = Math.round((eventSec - 0.05) * SAMPLE_RATE); i < Math.round((eventSec + 0.16) * SAMPLE_RATE); i++) {
      if (trace[i] < min) {
        min = trace[i]
        minIdx = i
      }
    }
    for (let i = Math.round((eventSec + 0.12) * SAMPLE_RATE); i < Math.round((eventSec + 0.80) * SAMPLE_RATE); i++) {
      if (trace[i] > max) {
        max = trace[i]
        maxIdx = i
      }
    }

    const peakLagSec = (maxIdx - minIdx) / SAMPLE_RATE
    expect(min).toBeLessThan(-80)
    expect(max).toBeGreaterThan(180)
    expect(max).toBeGreaterThan(Math.abs(min) * 1.5)
    expect(peakLagSec).toBeGreaterThan(0.22)
    expect(peakLagSec).toBeLessThan(0.55)
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

describe('filter validation', () => {
  const signal = Float32Array.from({ length: 512 }, (_, i) =>
    Math.sin((2 * Math.PI * 10 * i) / SAMPLE_RATE),
  )

  it('reuses caller-provided filter buffers without changing the result', () => {
    const config = { hp: 0.5, lp: 70, notch: 50 }
    const expected = applyFilterChain(signal, SAMPLE_RATE, config)
    const workspace = {}
    const first = applyFilterChain(signal, SAMPLE_RATE, config, workspace)
    const firstBufferA = workspace.bufA
    const second = applyFilterChain(signal, SAMPLE_RATE, config, workspace)

    expect(workspace.bufA).toBe(firstBufferA)
    expect(second).toBe(first)
    expect(Array.from(second)).toEqual(Array.from(expected))
  })

  it('can reuse caller-provided streaming output buffers', () => {
    const engine = createEngineForPattern('normal_awake', { seed: 1234 })
    const target = engine.fillWindow(4 / SAMPLE_RATE)
    const fp1Buffer = target.Fp1
    const reused = engine.fillWindow(4 / SAMPLE_RATE, target)

    expect(reused).toBe(target)
    expect(reused.Fp1).toBe(fp1Buffer)
    expect(reused.Fp1).toHaveLength(4)
    expect(Array.from(reused.Fp1).every(Number.isFinite)).toBe(true)
  })

  it('fails safely when a cutoff reaches or exceeds Nyquist', () => {
    for (const config of [{ lp: 128 }, { hp: 200 }, { notch: 128 }]) {
      const filtered = applyFilterChain(signal, SAMPLE_RATE, config)
      expect(filtered).toBe(signal)
      expect(Array.from(filtered).every(Number.isFinite)).toBe(true)
    }
  }, 10000)

  it('renders 14 and 6 Hz positive spikes as brief posterior-temporal drowsy bursts', () => {
    const engine = createEngineForPattern('positive_spikes_14_6', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 146,
    })
    const window = engine.fillWindow(10)
    const events = engine.getEventsSince(0).filter(({ type }) => type === 'positive_spikes_14_6')

    expect(events.length).toBeGreaterThanOrEqual(4)
    expect(events.some(({ detail }) => detail.includes('14.'))).toBe(true)
    expect(events.some(({ detail }) => detail.includes('6.'))).toBe(true)
    expect(events.every(({ durationS }) => durationS >= 0.5 && durationS <= 1)).toBe(true)

    const posteriorTemporal = computePSD(window.T7, SAMPLE_RATE, { dbScale: false })
    const frontal = computePSD(window.Fz, SAMPLE_RATE, { dbScale: false })
    expect(bandPower(posteriorTemporal.freqs, posteriorTemporal.psd, 5.5, 6.7) +
      bandPower(posteriorTemporal.freqs, posteriorTemporal.psd, 13.2, 14.8))
      .toBeGreaterThan(
        bandPower(frontal.freqs, frontal.psd, 5.5, 6.7) +
        bandPower(frontal.freqs, frontal.psd, 13.2, 14.8),
      )
    expect(WAVEFORM_PATTERNS.positive_spikes_14_6.pathological).toBe(false)
    expect(WAVEFORM_PATTERNS.positive_spikes_14_6.location).toContain('Posterior temporal')
  })

  it('renders posterior slow waves of youth as benign bilateral occipital delta with preserved alpha', () => {
    const engine = createEngineForPattern('posterior_slow_waves_youth', {
      eyesClosed: true,
      blinksEnabled: false,
      noiseLevel: 0,
      seed: 202608,
    })
    const window = engine.fillWindow(10)
    const events = engine.getEventsSince(0).filter(({ type }) => type === 'posterior_slow_waves_youth')

    expect(events.length).toBeGreaterThanOrEqual(3)
    expect(events.every(({ durationS }) => durationS >= 0.78 && durationS <= 1.5)).toBe(true)

    const occipital = computePSD(window.O1, SAMPLE_RATE, { dbScale: false })
    const frontal = computePSD(window.Fz, SAMPLE_RATE, { dbScale: false })
    expect(bandPower(occipital.freqs, occipital.psd, 2, 4))
      .toBeGreaterThan(bandPower(frontal.freqs, frontal.psd, 2, 4) * 5)
    expect(bandPower(occipital.freqs, occipital.psd, 8, 13)).toBeGreaterThan(0)
    const rightOccipital = computePSD(window.O2, SAMPLE_RATE, { dbScale: false })
    const leftDelta = bandPower(occipital.freqs, occipital.psd, 2, 4)
    const rightDelta = bandPower(rightOccipital.freqs, rightOccipital.psd, 2, 4)
    expect(rightDelta / leftDelta).toBeGreaterThan(0.6)
    expect(rightDelta / leftDelta).toBeLessThan(1.4)
    expect(WAVEFORM_PATTERNS.posterior_slow_waves_youth.pathological).toBe(false)
    expect(WAVEFORM_PATTERNS.posterior_slow_waves_youth.location).toContain('O1/O2')
  })

  it('attenuates posterior slow waves of youth with eye opening', () => {
    const options = { blinksEnabled: false, noiseLevel: 0, seed: 202608 }
    const closed = createEngineForPattern('posterior_slow_waves_youth', { ...options, eyesClosed: true }).fillWindow(10)
    const open = createEngineForPattern('posterior_slow_waves_youth', { ...options, eyesClosed: false }).fillWindow(10)
    const closedPsd = computePSD(closed.O1, SAMPLE_RATE, { dbScale: false })
    const openPsd = computePSD(open.O1, SAMPLE_RATE, { dbScale: false })
    expect(bandPower(closedPsd.freqs, closedPsd.psd, 2, 4))
      .toBeGreaterThan(bandPower(openPsd.freqs, openPsd.psd, 2, 4) * 3)
  })

  it('fails safely when the high-pass cutoff is not below the low-pass cutoff', () => {
    expect(applyFilterChain(signal, SAMPLE_RATE, { hp: 70, lp: 35 })).toBe(signal)
  })

  it('does not design a section from an invalid cutoff', () => {
    expect(getCachedFilterSOS('lp', 200, SAMPLE_RATE)).toEqual([])
  })
})

describe('streaming blink rate', () => {
  function blinkCount(rate) {
    const engine = createEngineForPattern('normal_awake', {
      eyesClosed: false,
      blinksEnabled: true,
      blinkRate: rate,
      seed: 2026,
    })
    engine.fillWindow(30)
    return engine.getEventsSince(0).filter(event => event.type === 'blink').length
  }

  it('disables spontaneous blinks at zero blinks per minute', () => {
    expect(blinkCount(0)).toBe(0)
  })

  it('uses the configured blink rate', () => {
    expect(blinkCount(30)).toBeGreaterThan(blinkCount(6))
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

  it('preserves sine-wave power after Hann window normalization', () => {
    const sr = 256
    const signal = Float32Array.from({ length: sr * 2 }, (_, i) =>
      Math.sin((2 * Math.PI * 10 * i) / sr),
    )
    const { freqs, psd } = computePSD(signal, sr, { nfft: 512, dbScale: false })
    expect(bandPower(freqs, psd, 0, sr / 2)).toBeCloseTo(0.5, 2)
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

  it('integrates power rather than averaging bins', () => {
    const freqs = Float64Array.from([0, 1, 2, 3, 4])
    const psd = Float64Array.from([2, 2, 2, 2, 2])
    expect(bandPower(freqs, psd, 1, 4)).toBeCloseTo(6)
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
