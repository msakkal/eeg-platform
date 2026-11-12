import { describe, expect, it } from 'vitest'
import { createEngineForPattern } from '../src/engine/streaming'
import {
  OneShotSeizureOverlay,
  FocalStatusOverlay,
  GeneralizedStatusOverlay,
  FOCAL_ONSET_OPTIONS,
} from '../src/engine/seizures'
import { computePSD } from '../src/engine/fft'
import { applyMontage } from '../src/engine/montages'
import { SANDBOX_PATTERN_IDS } from '../src/engine/patterns'

const FS = 256
const rms = (samples) =>
  Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
const options = { seed: 512, blinksEnabled: false, noiseLevel: 0.1 }
function trace(overlay, label, start, seconds) {
  return Float32Array.from(
    { length: seconds * FS },
    (_, i) => overlay.valueFor(label, start + i / FS).overlay,
  )
}
function crossingRate(samples, seconds) {
  let crossings = 0
  for (let i = 1; i < samples.length; i++) if (samples[i - 1] < 0 && samples[i] >= 0) crossings++
  return crossings / seconds
}

describe('manual seizure events', () => {
  it('honors a short shared duration and fits focal propagation inside the event', () => {
    for (const kind of ['focal', 'generalized']) {
      const overlay = new OneShotSeizureOverlay(kind, 0, () => 0.4, {
        duration: 10,
        onset: 'left_temporal',
        spread: 'bilateral',
        spreadDelay: 6,
        spreadDuration: 12,
      })
      expect(overlay.endTime).toBe(10)
      if (kind === 'focal') {
        expect(
          overlay.focalOptions.spreadDelay + overlay.focalOptions.spreadDuration + 2,
        ).toBeLessThanOrEqual(10)
        expect(rms(trace(overlay, 'O2', 8.5, 1))).toBeGreaterThan(20)
      }
      expect(overlay.valueFor('F7', 10).overlay).toBe(0)
    }
  })

  it.each([
    ['focal', 30],
    ['generalized', 12],
  ])('uses the selected %s duration and ends at the requested time', (kind, duration) => {
    const engine = createEngineForPattern('normal_awake', options)
    engine.startSeizure(kind, { duration })
    expect(engine.getActiveSeizure()).toMatchObject({ duration, endTime: duration })
    expect(
      engine.eventLog.find((event) => event.type === `simulated_${kind}_seizure`).durationS,
    ).toBe(duration)
    engine.fillWindow(duration - 0.5)
    expect(engine.getActiveSeizure()).not.toBeNull()
    engine.fillWindow(1)
    expect(engine.getActiveSeizure()).toBeNull()
  })

  it.each([
    ['focal', 60, [9, 6, 3]],
    ['generalized', 30, [6, 4, 2.5]],
  ])('retains all evolution stages when the %s duration changes', (kind, duration, frequencies) => {
    const overlay = new OneShotSeizureOverlay(kind, 0, () => 0.4, { duration })
    const fractions = kind === 'focal' ? [0.06, 0.31, 0.66] : [0.06, 0.35, 0.7]
    for (let stage = 0; stage < 3; stage++) {
      const { freqs, psd } = computePSD(trace(overlay, 'F7', fractions[stage] * duration, 2), FS, {
        dbScale: false,
      })
      let peak = 0
      for (let i = 1; i < freqs.length; i++)
        if (freqs[i] >= 1 && freqs[i] < 12 && psd[i] > psd[peak]) peak = i
      expect(Math.abs(freqs[peak] - frequencies[stage])).toBeLessThan(0.4)
    }
  })

  it('preserves generalized seizure activity in frontal bipolar channels through every evolution stage', () => {
    const overlay = new OneShotSeizureOverlay('generalized', 0, () => 0.4)
    for (const start of [1, 6, 12]) {
      const raw = Object.fromEntries(
        [
          'Fp1',
          'Fp2',
          'F3',
          'F4',
          'F7',
          'F8',
          'C3',
          'C4',
          'Fz',
          'Cz',
          'T7',
          'T8',
          'P3',
          'P4',
          'P7',
          'P8',
          'Pz',
          'O1',
          'O2',
          'A1',
          'A2',
        ].map((label) => [label, trace(overlay, label, start, 2)]),
      )
      const channels = applyMontage(raw, 'longitudinal_bipolar')
      for (const label of ['Fp1–F3', 'F3–C3', 'Fp2–F4', 'F4–C4', 'Fp1–F7', 'Fp2–F8', 'Fz–Cz']) {
        expect(rms(channels.find((channel) => channel.label === label).data)).toBeGreaterThan(10)
      }
      expect(rms(raw.F3)).toBeCloseTo(rms(raw.F4), 4)
      expect(rms(raw.F3)).toBeGreaterThan(3 * rms(raw.O1))
    }
  })

  it.each(FOCAL_ONSET_OPTIONS)('starts at the selected $label region', ({ value }) => {
    const overlay = new OneShotSeizureOverlay('focal', 0, () => 0.4, {
      onset: value,
      spread: 'none',
    })
    const [side, region] = value.split('_')
    const peak = { frontal: 'F3', central: 'C3', temporal: 'T7', parietal: 'P3', occipital: 'O1' }[
      region
    ]
    const right = { F3: 'F4', C3: 'C4', T7: 'T8', P3: 'P4', O1: 'O2' }[peak]
    expect(rms(trace(overlay, side === 'left' ? peak : right, 1, 3))).toBeGreaterThan(40)
    expect(rms(trace(overlay, side === 'left' ? right : peak, 1, 3))).toBe(0)
  })

  it.each(['focal', 'generalized'])(
    'makes %s evolution clearly visible in three sustained frequency stages',
    (kind) => {
      const overlay = new OneShotSeizureOverlay(kind, 0, () => 0.4)
      const samples =
        kind === 'focal'
          ? [
              [1, 9],
              [7, 6],
              [15, 3],
            ]
          : [
              [0.7, 6],
              [6, 4],
              [12, 2.5],
            ]
      for (const [start, expectedHz] of samples) {
        const { freqs, psd } = computePSD(trace(overlay, 'F7', start, 3), FS, { dbScale: false })
        let peak = 0
        for (let i = 1; i < freqs.length; i++)
          if (freqs[i] >= 1 && freqs[i] < 12 && psd[i] > psd[peak]) peak = i
        expect(Math.abs(freqs[peak] - expectedHz)).toBeLessThan(0.3)
      }
    },
  )

  it('applies the selected focal spread route without recruiting unrelated hemispheres', () => {
    const make = (spread) =>
      new OneShotSeizureOverlay('focal', 0, () => 0.4, { onset: 'right_occipital', spread })
    const local = make('none')
    expect(rms(trace(local, 'F4', 16, 2))).toBe(0)
    expect(rms(trace(local, 'O1', 16, 2))).toBe(0)
    const ipsilateral = make('ipsilateral')
    expect(rms(trace(ipsilateral, 'F4', 16, 2))).toBeGreaterThan(40)
    expect(rms(trace(ipsilateral, 'O1', 16, 2))).toBe(0)
    const opposite = make('contralateral')
    expect(rms(trace(opposite, 'O1', 1, 2))).toBe(0)
    expect(rms(trace(opposite, 'O1', 16, 2))).toBeGreaterThan(40)
    expect(rms(trace(opposite, 'F3', 16, 2))).toBe(0)
    const bilateral = make('bilateral')
    expect(rms(trace(bilateral, 'F3', 1, 2))).toBe(0)
    expect(rms(trace(bilateral, 'F3', 16, 2))).toBeGreaterThan(40)
    expect(rms(trace(bilateral, 'F4', 16, 2))).toBeGreaterThan(40)
  })

  it('respects spread timing and snapshots the chosen configuration in event metadata', () => {
    const fast = new OneShotSeizureOverlay('focal', 0, () => 0.4, {
      onset: 'left_temporal',
      spread: 'contralateral',
      spreadDelay: 2,
      spreadDuration: 4,
    })
    const slow = new OneShotSeizureOverlay('focal', 0, () => 0.4, {
      onset: 'left_temporal',
      spread: 'contralateral',
      spreadDelay: 6,
      spreadDuration: 12,
    })
    expect(rms(trace(fast, 'T8', 4, 1))).toBeGreaterThan(20)
    expect(rms(trace(slow, 'T8', 4, 1))).toBe(0)
    const engine = createEngineForPattern('normal_awake', options)
    const configuration = {
      onset: 'right_occipital',
      spread: 'bilateral',
      spreadDelay: 6,
      spreadDuration: 12,
    }
    engine.startSeizure('focal', configuration)
    configuration.onset = 'left_frontal'
    expect(engine.getActiveSeizure().focalOptions.onset).toBe('right_occipital')
    expect(
      engine.eventLog.find((event) => event.type === 'simulated_focal_seizure').detail,
    ).toContain('Right occipital; across both hemispheres; spread begins after 6s over 12s')
    engine.fillWindow(13)
    expect(
      engine.eventLog.filter((event) => event.type === 'seizure_evolution').length,
    ).toBeGreaterThanOrEqual(3)
  })

  it('removes the standalone seizure pattern while exposing both status patterns', () => {
    expect(SANDBOX_PATTERN_IDS).not.toContain('focal_seizure')
    expect(SANDBOX_PATTERN_IDS).toEqual(
      expect.arrayContaining(['focal_status', 'generalized_status']),
    )
  })

  it.each(['focal', 'generalized'])(
    'injects one %s event at the current clock without replacing the background',
    (kind) => {
      const engine = createEngineForPattern('normal_awake', options)
      engine.fillWindow(3)
      expect(engine.startSeizure(kind)).toBe(true)
      expect(engine.startSeizure(kind)).toBe(false)
      expect(engine.mode).toBe('normal_awake')
      expect(engine.getActiveSeizure()).toMatchObject({ kind, startTime: 3 })
      expect(
        engine.eventLog.filter((event) => event.type === `simulated_${kind}_seizure`),
      ).toHaveLength(1)
      const duration = kind === 'focal' ? 24 : 18
      expect(
        engine.eventLog.find((event) => event.type === `simulated_${kind}_seizure`),
      ).toMatchObject({ t: 3, durationS: duration })
      engine.fillWindow(duration + 0.25)
      expect(engine.getActiveSeizure()).toBeNull()
      expect(engine.overlays.some((overlay) => overlay.isManualSeizure)).toBe(false)
      engine.fillWindow(2)
      expect(
        engine.eventLog.filter((event) => event.type === `simulated_${kind}_seizure`),
      ).toHaveLength(1)
      expect(engine.startSeizure(kind)).toBe(true)
    },
  )

  it.each(['focal', 'generalized'])(
    'keeps a %s injection visible after bipolar montage subtraction',
    (kind) => {
      const overlay = new OneShotSeizureOverlay(kind, 0, () => 0.4)
      const raw = Object.fromEntries(
        [
          'Fp1',
          'Fp2',
          'F7',
          'F8',
          'F3',
          'F4',
          'C3',
          'C4',
          'Cz',
          'Fz',
          'T7',
          'T8',
          'P7',
          'P8',
          'P3',
          'P4',
          'Pz',
          'O1',
          'O2',
          'A1',
          'A2',
        ].map((label) => [label, trace(overlay, label, 1, 2)]),
      )
      const channels = applyMontage(raw, 'longitudinal_bipolar')
      expect(channels.filter((channel) => rms(channel.data) > 10).length).toBeGreaterThanOrEqual(
        kind === 'focal' ? 2 : 4,
      )
      if (kind === 'focal') expect(rms(raw.F7)).toBeGreaterThan(20 * rms(raw.F8))
      else expect(rms(raw.F7)).toBeCloseTo(rms(raw.F8), 4)
    },
  )

  it('preserves focal evolution and ipsilateral spread within the injected event', () => {
    const overlay = new OneShotSeizureOverlay('focal', 0, () => 0.4)
    const early = trace(overlay, 'F7', 2, 3)
    const late = trace(overlay, 'F7', 14, 3)
    expect(crossingRate(early, 3)).toBeGreaterThan(5)
    expect(crossingRate(late, 3)).toBeLessThan(4.5)
    expect(rms(trace(overlay, 'C3', 14, 3)) / rms(late)).toBeGreaterThan(
      (2 * rms(trace(overlay, 'C3', 2, 3))) / rms(early),
    )
    expect(rms(trace(overlay, 'F7', 26, 2))).toBe(0)
  })

  it('stops an injected event, records its actual duration, and allows another injection', () => {
    const engine = createEngineForPattern('normal_drowsy', options)
    expect(engine.startSeizure('focal')).toBe(true)
    engine.fillWindow(2)
    expect(engine.stopSeizure()).toBe(true)
    expect(engine.getActiveSeizure()).toBeNull()
    expect(
      engine.eventLog.find((event) => event.type === 'simulated_focal_seizure').durationS,
    ).toBe(2)
    expect(engine.mode).toBe('normal_drowsy')
    expect(engine.startSeizure('generalized')).toBe(true)
  })

  it.each(['focal_status', 'generalized_status'])(
    'does not layer transient seizures onto %s',
    (pattern) => {
      const engine = createEngineForPattern(pattern, options)
      expect(engine.startSeizure('focal')).toBe(false)
      expect(engine.startSeizure('generalized')).toBe(false)
    },
  )

  it.each([FocalStatusOverlay, GeneralizedStatusOverlay])(
    '%s stays ictal beyond ten minutes without recovery gaps',
    (Overlay) => {
      const overlay = new Overlay(() => 0.4)
      for (const start of [0, 16, 31, 59, 120, 599, 610, 720]) {
        expect(rms(trace(overlay, 'F7', start, 2))).toBeGreaterThan(20)
        expect(overlay.valueFor('F7', start).preserve).toBeLessThan(0.5)
      }
    },
  )
})
