import { describe, expect, it } from 'vitest'
import { StreamingEEG, createEngineForPattern } from '../src/engine/streaming.js'
import {
  generateMultiChannelEEG, injectSpike, injectSharpWave, injectSpikeAndWave,
  injectPolyspike, injectTriphasicWave, injectEyeBlink, injectLateralEyeMovement,
} from '../src/engine/signalGenerator.js'
import { generateDemoTrace } from '../src/engine/waveforms.js'
import { applyMontage } from '../src/engine/montages.js'

function support(signal) {
  const first = signal.findIndex(value => value !== 0)
  let last = signal.length - 1
  while (last >= 0 && signal[last] === 0) last--
  return { first, last }
}

function powerAt(signal, sampleRate, frequency, start = 0.55, end = 1.5) {
  let real = 0, imaginary = 0
  for (let i = Math.round(start * sampleRate); i < Math.round(end * sampleRate); i++) {
    const phase = 2 * Math.PI * frequency * i / sampleRate
    real += signal[i] * Math.cos(phase)
    imaginary += signal[i] * Math.sin(phase)
  }
  return real * real + imaginary * imaginary
}

describe('physical transient timing', () => {
  it.each([256, 512, 1000])('honors baseline-to-baseline duration at %i Hz', sampleRate => {
    for (const [inject, duration] of [[injectSpike, 0.06], [injectSharpWave, 0.12]]) {
      const signal = new Float32Array(sampleRate * 2)
      inject(signal, sampleRate, { sampleRate, amplitude: 100 })
      const { first, last } = support(signal)
      // Include the zero samples at both boundaries of the transient.
      expect((last - first + 2) / sampleRate).toBeCloseTo(Math.round(duration * sampleRate) / sampleRate, 10)
      expect(signal[sampleRate]).toBe(-100)
      expect(sampleRate - first).toBeLessThan(last - sampleRate)
    }
  })

  it.each([
    [injectPolyspike, {}], [injectTriphasicWave, {}],
    [injectEyeBlink, {}], [injectLateralEyeMovement, {}],
  ])('preserves physical event extent when doubling sampling rate (%s)', (inject, options) => {
    const extents = [256, 512].map(sampleRate => {
      const signal = new Float32Array(sampleRate * 2)
      inject(signal, sampleRate, { ...options, sampleRate })
      const { first, last } = support(signal)
      return [(first - sampleRate) / sampleRate, (last - sampleRate) / sampleRate]
    })
    for (let boundary = 0; boundary < 2; boundary++) {
      expect(Math.abs(extents[0][boundary] - extents[1][boundary])).toBeLessThanOrEqual(2 / 256)
    }
  })

  it.each([256, 512])('uses the requested spike-wave period at %i Hz', sampleRate => {
    for (const frequency of [2, 3, 4]) {
      const signal = new Float32Array(sampleRate * 2)
      injectSpikeAndWave(signal, sampleRate, { sampleRate, frequency })
      const { last } = support(signal)
      expect((last - sampleRate + 1) / sampleRate).toBeCloseTo(Math.round(sampleRate / frequency) / sampleRate, 10)
    }
  })

  it.each([256, 512])('keeps the demo spindle near 13 Hz at %i samples/sec', sampleRate => {
    const signal = generateDemoTrace('sleep_spindle', sampleRate, { seed: 42 })
    expect(powerAt(signal, sampleRate, 13)).toBeGreaterThan(4 * powerAt(signal, sampleRate, 26))
  })
})

describe('sample clock', () => {
  it.each([256, 500])('advances by emitted samples and preserves chunk continuity at %i Hz', sampleRate => {
    const split = new StreamingEEG({ sampleRate, seed: 42 })
    const whole = new StreamingEEG({ sampleRate, seed: 42 })
    const count = Math.round(0.01 * sampleRate)
    const chunks = Array.from({ length: 100 }, () => split.fillWindow(0.01))
    const expected = whole.fillWindow(100 * count / sampleRate)
    expect(split.clock).toBe(100 * count / sampleRate)
    for (const label of Object.keys(expected)) {
      expect(Float32Array.from(chunks.flatMap(chunk => Array.from(chunk[label])))).toEqual(expected[label])
    }
    const clock = split.clock
    split.fillWindow(0.1 / sampleRate)
    expect(split.clock).toBe(clock)
    split.rewind()
    expect(split.clock).toBe(0)
    split.fillWindow(1 / sampleRate)
    expect(split.clock).toBe(1 / sampleRate)
  })

  it('rejects invalid clock parameters', () => {
    for (const sampleRate of [0, -1, NaN, Infinity]) {
      expect(() => new StreamingEEG({ sampleRate })).toThrow(RangeError)
    }
    const engine = new StreamingEEG({ seed: 42 })
    for (const duration of [-1, NaN, Infinity]) expect(() => engine.fillWindow(duration)).toThrow(RangeError)
  })
})

describe('adult burst-suppression teaching criteria', () => {
  it.each([1, 42, 2026])('keeps interburst voltage below 10 µV in longitudinal bipolar, seed %i', seed => {
    const engine = createEngineForPattern('burst_suppression', { seed, noiseLevel: 1 })
    const raw = engine.fillWindow(30)
    const bursts = engine.eventLog.filter(event => event.type === 'burst')
    expect(bursts.length).toBeGreaterThan(3)
    for (const burst of bursts) expect(burst.durationS).toBeGreaterThanOrEqual(0.5)
    const suppression = Array.from({ length: 30 * 256 }, (_, i) =>
      !bursts.some(event => i / 256 >= event.t && i / 256 < event.t + event.durationS))
    const fraction = suppression.filter(Boolean).length / suppression.length
    expect(fraction).toBeGreaterThanOrEqual(0.5)
    expect(fraction).toBeLessThan(0.99)
    for (const { data } of applyMontage(raw, 'longitudinal_bipolar')) {
      let min = Infinity, max = -Infinity
      for (let i = 0; i < data.length; i++) {
        if (!suppression[i]) { min = Infinity; max = -Infinity; continue }
        min = Math.min(min, data[i])
        max = Math.max(max, data[i])
        expect(max - min).toBeLessThan(10)
      }
    }
  })

  it.each([256, 512])('also keeps the buffered suppression floor low at %i Hz', sampleRate => {
    const { channels } = generateMultiChannelEEG({ pattern: 'burst_suppression', duration: 4, sampleRate, seed: 42, noiseLevel: 1 })
    // The first burst starts at 0.2s and ends by 1.9s; the next starts after 2.7s.
    for (const { data } of applyMontage(channels, 'longitudinal_bipolar')) {
      const interval = data.slice(2 * sampleRate, Math.floor(2.65 * sampleRate))
      expect(Math.max(...interval) - Math.min(...interval)).toBeLessThan(10)
    }
  })
})
