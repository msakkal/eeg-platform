import { describe, expect, it } from 'vitest'
import { EEGSignalSession } from '../src/engine/eegSession'
import { AbsenceOverlay } from '../src/engine/streaming'

describe('absence teaching recording', () => {
  it('shows spike-wave in the initialized viewer and subsequent playback windows', () => {
    const session = new EEGSignalSession({
      pattern: 'absence', montageId: 'referential_ears',
      windowSecs: 10, maxWindowSecs: 60, seed: 42,
      noiseLevel: 0.15, blinksEnabled: false,
      filterConfig: { hp: 0.5, lp: 70, notch: 50 },
    })
    for (const elapsed of [0, 12, 12]) {
      session.advance(elapsed)
      for (const windowSecs of [10, 30, 60]) {
        session.configure({ windowSecs, montageId: 'referential_ears' })
        const frame = session.frame()
        const spikes = frame.events.filter(event => event.type === 'spike_wave')
        expect(spikes.length).toBeGreaterThan(8)
        expect(spikes.every(event => event.t >= frame.windowStart)).toBe(true)
        const frontal = frame.channels.find(channel => channel.label.startsWith('F3'))
        const data = frontal.filteredData
        expect(Math.max(...data) - Math.min(...data)).toBeGreaterThan(150)
        session.configure({ montageId: 'longitudinal_bipolar' })
        const bipolar = session.frame()
        const excursion = bipolar.channels.map(({ filteredData }) =>
          Math.max(...filteredData) - Math.min(...filteredData))
        expect(Math.max(...excursion)).toBeGreaterThan(70)
      }
    }
  })

  it('repeats finite bilateral approximately 3 Hz runs with quiet intervals', () => {
    const overlay = new AbsenceOverlay(() => 0.5)
    const events = []
    const values = new Map()
    for (let sample = 0; sample < 26 * 256; sample++) {
      const t = sample / 256
      overlay.advance(t, event => events.push(event))
      const left = overlay.valueFor('F3', t).overlay
      expect(overlay.valueFor('F4', t).overlay).toBe(left)
      values.set(sample, left)
    }
    for (const start of [1, 13, 25]) {
      const run = events.filter(event => event.t >= start && event.t < start + 6)
      expect(run.length).toBeGreaterThan(2)
      for (let i = 1; i < run.length; i++) {
        const frequency = 1 / (run[i].t - run[i - 1].t)
        expect(frequency).toBeGreaterThanOrEqual(2.5)
        expect(frequency).toBeLessThanOrEqual(4)
      }
    }
    for (const t of [3, 15]) {
      const data = [...values].filter(([sample]) => sample >= t * 256 && sample < (t + 1) * 256).map(([, value]) => value)
      expect(Math.min(...data)).toBeLessThan(-150)
      expect(Math.max(...data)).toBeGreaterThan(70)
    }
    for (const t of [8, 9, 10, 11, 12, 20, 21, 22, 23, 24])
      expect(values.get(t * 256)).toBe(0)
  })
})
