import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { useEEGSignal } from '../src/hooks/useEEGSignal'
import EEGViewer from '../src/components/eeg/EEGViewer'
import { makeTimeAxis } from '../src/engine/signalGenerator'
import { getViewerTheme } from '../src/engine/viewerThemes'

// An absolute-time ramp makes a mismatch between sample data and its grid
// timestamp observable without relying on stochastic waveform morphology.
vi.mock('../src/engine/streaming', async () => {
  const { ELECTRODES_1020, SAMPLE_RATE } = await import('../src/engine/signalGenerator')
  return {
    createEngineForPattern: () => {
      let index = 0
      return {
        fillWindow(duration, target = {}) {
          target ??= {}
          const length = Math.round(duration * SAMPLE_RATE)
          for (const label of ELECTRODES_1020) {
            if (target[label]?.length !== length) target[label] = new Float32Array(length)
            for (let i = 0; i < length; i++)
              target[label][i] = label === 'Fp1' ? (index + i) / SAMPLE_RATE : 0
          }
          index += length
          return target
        },
      }
    },
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function animationClock() {
  const pending = new Map()
  let nextId = 0
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    pending.set(++nextId, callback)
    return nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (id) => pending.delete(id))
  return (now) => {
    const [id, callback] = pending.entries().next().value
    pending.delete(id)
    act(() => callback(now))
  }
}

const options = {
  pattern: 'normal_awake',
  montageId: 'longitudinal_bipolar',
  isPlaying: true,
  windowSecs: 2,
  maxWindowSecs: 3,
  noiseLevel: 0,
}

describe('curve and grid synchronization', () => {
  it('retains earlier frame samples while publishing newer timestamps at irregular frame intervals', () => {
    const tick = animationClock()
    const { result } = renderHook(() => useEEGSignal(options))
    const initial = result.current
    const initialSamples = initial.channels[0].data.slice()
    for (const now of [1000, 1017.2, 1024.1, 1043.7, 1072.4, 1170.6]) {
      tick(now)
      const frame = result.current
      const firstSampleTime = frame.windowStart - frame.sampleOffset / 256
      expect(frame.channels[0].data[0]).toBeCloseTo(firstSampleTime, 10)
      expect(initial.channels[0].data).toEqual(initialSamples)
      expect(frame.channels[0].data).not.toBe(initial.channels[0].data)
    }
  })

  it('preserves fractional grid position through paused montage, filter, and sweep changes', () => {
    const tick = animationClock()
    const { result, rerender } = renderHook((props) => useEEGSignal(props), {
      initialProps: options,
    })
    tick(1000)
    tick(1021.7)
    const before = result.current
    expect(before.sampleOffset).toBeGreaterThan(0)
    rerender({ ...options, isPlaying: false, montageId: 'average_reference' })
    expect(result.current.windowStart).toBe(before.windowStart)
    expect(result.current.sampleOffset).toBe(before.sampleOffset)
    rerender({ ...options, isPlaying: false, filterConfig: { hp: 0.5, lp: 70, notch: 50 } })
    expect(result.current.windowStart).toBe(before.windowStart)
    expect(result.current.sampleOffset).toBe(before.sampleOffset)
    expect(result.current.channels[0].visibleStartIndex).toBe(2560)
    rerender({ ...options, isPlaying: false, windowSecs: 3 })
    expect(result.current.windowStart).toBeCloseTo(before.windowStart - 1, 12)
    expect(result.current.sampleOffset).toBe(before.sampleOffset)
  })

  it('places a fixed waveform peak on the same grid line as both scroll with fractional samples', () => {
    const strokes = []
    let path = []
    const ctx = {
      setTransform() {},
      clearRect() {},
      fillRect() {},
      fillText() {},
      fill() {},
      closePath() {},
      setLineDash() {},
      measureText: () => ({ width: 10 }),
      beginPath() {
        path = []
      },
      moveTo(x, y) {
        path.push(['move', x, y])
      },
      lineTo(x, y) {
        path.push(['line', x, y])
      },
      quadraticCurveTo(x, y, endX, endY) {
        path.push(['curve', x, y, endX, endY])
      },
      stroke() {
        strokes.push({ color: this.strokeStyle, path: [...path] })
      },
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(640)
    const timeAxis = makeTimeAxis(257)
    const theme = getViewerTheme('clinical')
    const view = render(<EEGViewer />)
    for (const [advance, fraction] of [
      [0, 0.6],
      [3, 0.15],
      [9, 0.9],
      [14, 0.2],
    ]) {
      strokes.length = 0
      const data = new Float32Array(257)
      data[128 - advance] = 80
      const windowStart = 20.5 + (advance + fraction) / 256
      view.rerender(
        <EEGViewer
          channels={[{ label: 'Fp1', data }]}
          timeAxis={timeAxis}
          windowStart={windowStart}
          sampleOffset={fraction}
          signalColor="#123456"
          theme="clinical"
          showCalibration={false}
        />,
      )
      const curve = strokes.find((stroke) => stroke.color === '#123456')
      const peak = curve.path.find((point) => point[0] === 'curve' && Math.abs(point[2] - 24) > 1)
      const majorGrid = strokes.find((stroke) => stroke.color === theme.gridMajor)
      const tickAt21 = majorGrid.path.find((point) => point[0] === 'move')
      expect(peak[1]).toBeCloseTo(tickAt21[1], 10)
    }
  })
})
