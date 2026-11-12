import { describe, expect, it } from 'vitest'
import {
  ADDITIONAL_PATTERN_CONFIG,
  createAdditionalOverlay,
} from '../src/engine/additionalPatterns'
import { createEngineForPattern } from '../src/engine/streaming'
import { generateMultiChannelEEG } from '../src/engine/signalGenerator'
import { computePSD, bandPower } from '../src/engine/fft'

const FS = 256
const rms = (values) =>
  Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length)
function overlayTrace(pattern, label, start, duration) {
  const overlay = createAdditionalOverlay(pattern, () => 0.4)
  const signal = new Float32Array(Math.round(duration * FS))
  for (let i = 0; i < signal.length; i++) {
    const t = start + i / FS
    overlay.advance(t)
    signal[i] = overlay.valueFor(label, t).overlay
  }
  return signal
}
function crossings(signal, duration) {
  let count = 0
  for (let i = 1; i < signal.length; i++) if (signal[i - 1] < 0 && signal[i] >= 0) count++
  return count / duration
}

describe('additional educational EEG simulations', () => {
  it.each(Object.keys(ADDITIONAL_PATTERN_CONFIG))(
    '%s is deterministic and continuous across streaming windows',
    (pattern) => {
      const options = { seed: 517, blinksEnabled: false, noiseLevel: 0.1 }
      const wholeEngine = createEngineForPattern(pattern, options)
      const splitEngine = createEngineForPattern(pattern, options)
      const whole = wholeEngine.fillWindow(3)
      const first = splitEngine.fillWindow(1)
      const rest = splitEngine.fillWindow(2)
      for (const label of ['F7', 'F8', 'Cz', 'O1']) {
        expect(Array.from(whole[label])).toEqual([...first[label], ...rest[label]])
        expect(Array.from(whole[label]).every(Number.isFinite)).toBe(true)
      }
      expect(wholeEngine.eventLog).toEqual(splitEngine.eventLog)
    },
  )

  it('distinguishes temporal, occipital, and lateralized rhythmic delta fields and frequencies', () => {
    expect(crossings(overlayTrace('tirda', 'F7', 1.1, 3), 3)).toBeCloseTo(2, 0)
    expect(rms(overlayTrace('tirda', 'F7', 1.1, 3))).toBeGreaterThan(30)
    expect(rms(overlayTrace('tirda', 'F8', 1.1, 3))).toBe(0)
    expect(crossings(overlayTrace('oirda', 'O1', 1.1, 3), 3)).toBeCloseTo(3, 0)
    expect(rms(overlayTrace('oirda', 'O1', 1.1, 3))).toBeGreaterThan(40)
    expect(rms(overlayTrace('oirda', 'F7', 1.1, 3))).toBe(0)
    expect(crossings(overlayTrace('lrda', 'F7', 1.1, 10), 10)).toBeCloseTo(1.5, 0)
    expect(rms(overlayTrace('lrda', 'F7', 1.1, 10))).toBeGreaterThan(
      15 * rms(overlayTrace('lrda', 'F8', 1.1, 10)),
    )
  })

  it('creates overlapping independent periodic populations with changing interhemispheric timing', () => {
    const engine = createEngineForPattern('bipds', { seed: 44, blinksEnabled: false })
    engine.fillWindow(8)
    const left = engine.eventLog
      .filter((event) => event.label === 'BIPD (left)')
      .map((event) => event.t)
    const right = engine.eventLog
      .filter((event) => event.label === 'BIPD (right)')
      .map((event) => event.t)
    expect(left.length).toBeGreaterThan(right.length)
    expect(right.length).toBeGreaterThan(3)
    const offsets = right.map((t) => Math.min(...left.map((leftT) => Math.abs(leftT - t))))
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThan(0.15)
  })

  it('makes GPFA a brief generalized fast burst rather than a slow spike-wave run', () => {
    const trace = overlayTrace('gpfa', 'Fz', 1.1, 2)
    const { freqs, psd } = computePSD(trace, FS, { dbScale: false })
    expect(bandPower(freqs, psd, 13, 30)).toBeGreaterThan(10 * bandPower(freqs, psd, 0.5, 4))
    expect(rms(overlayTrace('gpfa', 'Fz', 1.1, 2))).toBeGreaterThan(
      rms(overlayTrace('gpfa', 'O1', 1.1, 2)) * 2,
    )
    expect(rms(overlayTrace('gpfa', 'Fz', 5, 2))).toBe(0)
  })

  it('adds phase-linked fast packets to delta in extreme delta brush', () => {
    const trace = overlayTrace('extreme_delta_brush', 'Fz', 0, 4)
    const { freqs, psd } = computePSD(trace, FS, { dbScale: false })
    expect(bandPower(freqs, psd, 1, 2)).toBeGreaterThan(100)
    expect(bandPower(freqs, psd, 20, 28)).toBeGreaterThan(10)
  })

  it('keeps suppression below 10 microvolts in both generators without adding bursts', () => {
    const live = createEngineForPattern('suppressed_background', { seed: 10 }).fillWindow(4)
    const buffered = generateMultiChannelEEG({
      pattern: 'suppressed_background',
      duration: 4,
      seed: 10,
    })
    for (const channels of [live, buffered.channels]) {
      for (const signal of Object.values(channels)) {
        expect(Math.max(...signal) - Math.min(...signal)).toBeLessThan(10)
        expect(rms(signal)).toBeGreaterThan(0.5)
      }
    }
  })
})
