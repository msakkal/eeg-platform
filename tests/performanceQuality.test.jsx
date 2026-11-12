import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import EEGViewer from '../src/components/eeg/EEGViewer'
import { createTraceSamplingPlan, sampleTraceAt } from '../src/engine/traceSampling'
import { createEngineForPattern } from '../src/engine/streaming'
import { SANDBOX_PATTERN_IDS } from '../src/engine/patterns'
import { useEEGSignal } from '../src/hooks/useEEGSignal'
import waveformHashes from './fixtures/streaming-waveform-hashes.json'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Reference integration used by the renderer before geometry caching. Keep its
// arithmetic independent so regressions in footprint boundaries are detected.
function originalSample(data, index, halfFootprint) {
  if (halfFootprint < 0.5) {
    const first = Math.floor(index)
    const next = Math.min(data.length - 1, first + 1)
    return data[first] + (data[next] - data[first]) * (index - first)
  }
  const left = Math.max(-0.5, index - halfFootprint)
  const right = Math.min(data.length - 0.5, index + halfFootprint)
  let sum = 0,
    total = 0
  for (
    let i = Math.max(0, Math.floor(left + 0.5));
    i <= Math.min(data.length - 1, Math.ceil(right - 0.5));
    i++
  ) {
    const weight = Math.max(0, Math.min(right, i + 0.5) - Math.max(left, i - 0.5))
    sum += data[i] * weight
    total += weight
  }
  return total > 0 ? sum / total : data[Math.round(index)]
}

describe('signal quality after optimization', () => {
  // The burst-suppression baseline includes the intentional suppression-floor
  // correction documented in docs/signal-accuracy-audit.md. Other hashes retain
  // their original pre-optimization baseline.
  it.each(SANDBOX_PATTERN_IDS)('preserves approved reference samples for %s', (pattern) => {
    expect(Object.keys(waveformHashes)).toEqual(SANDBOX_PATTERN_IDS)
    const engine = createEngineForPattern(pattern, { seed: 20261103, eyesClosed: false })
    const hash = createHash('sha256')
    for (const duration of [2, 3, 5]) {
      for (const samples of Object.values(engine.fillWindow(duration))) {
        hash.update(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength))
      }
    }
    expect(hash.digest('hex'), pattern).toBe(waveformHashes[pattern])
  })

  it.each([
    [2560, 1200],
    [7680, 811.25],
    [15360, 640],
    [2560, 1700],
    [17, 8.125],
  ])(
    'retains exact trace sample values for length %i and width %f, including narrow transients',
    (length, width) => {
      const data = Float32Array.from(
        { length },
        (_, i) => 33 * Math.sin(i * 0.13) + 7 * Math.cos(i * 0.47),
      )
      data[0] = 500
      data[Math.floor(length / 2)] = -1000
      data[length - 1] = 300
      const plan = createTraceSamplingPlan(length, width)
      const half = ((length - 1) / (plan.columns - 1)) * 0.5
      for (let column = 1; column < plan.columns; column++) {
        expect(sampleTraceAt(data, plan, column)).toBe(
          originalSample(data, (column / (plan.columns - 1)) * (length - 1), half),
        )
      }
    },
  )
})

describe('viewer scheduling', () => {
  it('keeps one resize observer and cancels redundant redraws when a newer live frame arrives', () => {
    const queued = new Map()
    let nextId = 0
    const request = vi.fn((callback) => {
      queued.set(++nextId, callback)
      return nextId
    })
    const cancel = vi.fn((id) => queued.delete(id))
    vi.stubGlobal('requestAnimationFrame', request)
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const observe = vi.fn(),
      disconnect = vi.fn()
    let resize
    const observer = vi.fn(function (callback) {
      resize = callback
      this.observe = observe
      this.disconnect = disconnect
    })
    vi.stubGlobal('ResizeObserver', observer)
    const ctx = {
      clearRect: vi.fn(),
      setTransform() {},
      fillRect() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      quadraticCurveTo() {},
      fill() {},
      stroke() {},
      setLineDash() {},
      fillText() {},
      measureText: () => ({ width: 20 }),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(640)
    const data = Float32Array.from({ length: 2560 }, (_, i) => Math.sin(i))
    const channels = [{ label: 'F3–C3', data }]
    const timeAxis = [0, 10]
    const view = render(<EEGViewer channels={channels} timeAxis={timeAxis} />)
    const trace = screen.getByRole('img')
    fireEvent.mouseMove(trace, { clientX: 160, clientY: 20 })
    resize()
    expect(queued.size).toBe(1)
    const firstPaints = ctx.clearRect.mock.calls.length
    // A new signal frame supersedes any queued hover or resize redraw.
    data[0] = 100
    view.rerender(<EEGViewer channels={channels.slice()} timeAxis={timeAxis} />)
    expect(cancel).toHaveBeenCalled()
    expect(queued.size).toBe(0)
    expect(ctx.clearRect.mock.calls.length).toBe(firstPaints + 1)
    expect(observer).toHaveBeenCalledTimes(1)
    resize()
    expect(queued.size).toBe(1)
    const callback = [...queued.values()][0]
    queued.clear()
    callback()
    expect(ctx.clearRect.mock.calls.length).toBe(firstPaints + 2)
    view.unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})

describe('paused playback efficiency', () => {
  it('stops scheduling frames while paused and resumes without advancing through the pause', () => {
    const queued = new Map()
    let nextId = 0
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      queued.set(++nextId, callback)
      return nextId
    })
    vi.stubGlobal('cancelAnimationFrame', (id) => queued.delete(id))
    const { result, rerender, unmount } = renderHook(
      ({ isPlaying }) =>
        useEEGSignal({
          pattern: 'normal_awake',
          montageId: 'longitudinal_bipolar',
          noiseLevel: 0.1,
          isPlaying,
          windowSecs: 2,
          maxWindowSecs: 2,
          blinksEnabled: false,
        }),
      { initialProps: { isPlaying: false } },
    )
    expect(result.current.isReady).toBe(true)
    expect(queued.size).toBe(0)
    const initialStart = result.current.windowStart
    rerender({ isPlaying: true })
    expect(queued.size).toBe(1)
    function tick(now) {
      const [id, callback] = queued.entries().next().value
      queued.delete(id)
      act(() => callback(now))
    }
    tick(1000)
    tick(1020)
    const playingStart = result.current.windowStart
    expect(playingStart).toBeGreaterThan(initialStart)
    rerender({ isPlaying: false })
    expect(queued.size).toBe(0)
    rerender({ isPlaying: true })
    tick(100000)
    expect(result.current.windowStart - playingStart).toBeLessThan(0.03)
    unmount()
    expect(queued.size).toBe(0)
  })
})
