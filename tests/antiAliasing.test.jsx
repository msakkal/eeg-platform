import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import EEGViewer from '../src/components/eeg/EEGViewer'
import { getCanvasResolution } from '../src/engine/canvasResolution'
import { createTraceSamplingPlan, sampleTraceAt } from '../src/engine/traceSampling'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function canvasContext() {
  const ctx = new Proxy(
    {
      setTransform: vi.fn(),
      quadraticCurveTo: vi.fn(),
      measureText: () => ({ width: 10 }),
    },
    { get: (target, key) => (key in target ? target[key] : () => {}) },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(640)
  return ctx
}

describe('anti-aliased canvas resolution', () => {
  it.each([
    [1, 2],
    [1.25, 2],
    [2, 2],
    [3, 3],
    [4, 3],
  ])('uses a bounded backing scale for device ratio %s', (ratio, expected) => {
    const resolution = getCanvasResolution(640, 800, ratio)
    expect(resolution.bitmapWidth).toBe(640 * expected)
    expect(resolution.bitmapHeight).toBe(800 * expected)
    expect(resolution.scaleX).toBe(expected)
    expect(resolution.sampleDensity).toBe(expected)
  })

  it('bounds memory on large canvases and maps fractional CSS dimensions exactly', () => {
    const large = getCanvasResolution(6000, 4000, 3)
    expect(large.bitmapWidth * large.bitmapHeight).toBeLessThanOrEqual(16_000_000)
    const fractional = getCanvasResolution(641.375, 803.25, 2.5)
    expect(fractional.scaleX * 641.375).toBeCloseTo(fractional.bitmapWidth, 10)
    expect(fractional.scaleY * 803.25).toBeCloseTo(fractional.bitmapHeight, 10)
    expect(fractional.sampleDensity).toBe(3)
  })

  it('raises raster resolution without changing curve coordinates or CSS height', () => {
    const ctx = canvasContext()
    vi.stubGlobal('devicePixelRatio', 1)
    const data = Float32Array.from({ length: 257 }, (_, i) => 20 * Math.sin(i * 0.1))
    data[128] = 120
    const props = { channels: [{ label: 'Fp1', data }], timeAxis: [0, 1], showCalibration: false }
    const view = render(<EEGViewer {...props} />)
    const canvas = screen.getByRole('img')
    expect(canvas.width).toBe(1280)
    expect(canvas.style.height).toBe('72px')
    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0)
    const originalPath = ctx.quadraticCurveTo.mock.calls.map((call) => [...call])
    ctx.quadraticCurveTo.mockClear()
    vi.stubGlobal('devicePixelRatio', 3)
    view.rerender(<EEGViewer {...props} channels={[...props.channels]} />)
    expect(canvas.width).toBe(1920)
    expect(canvas.style.height).toBe('72px')
    expect(ctx.quadraticCurveTo.mock.calls).toEqual(originalPath)
    expect(data[128]).toBe(120)
  })

  it('keeps hover/highlight glow in CSS units when the bitmap is supersampled', () => {
    const ctx = canvasContext()
    const blurs = []
    ctx.stroke = function () {
      if (this.strokeStyle === '#123456') blurs.push(this.shadowBlur)
    }
    vi.stubGlobal('devicePixelRatio', 3)
    render(
      <EEGViewer
        channels={[{ label: 'Fp1', data: Float32Array.from([0, 10, 0]) }]}
        timeAxis={[0, 0.5, 1]}
        highlightedChannels={['Fp1']}
        signalColor="#123456"
        theme="midnight"
        showCalibration={false}
      />,
    )
    expect(blurs).toEqual([6])
  })

  it('retains constant signals and preserves more narrow-transient detail at higher density', () => {
    const flat = new Float32Array(15360).fill(13)
    const spike = new Float32Array(15360)
    spike[7680] = 100
    const peaks = []
    for (const density of [2, 3]) {
      const plan = createTraceSamplingPlan(spike.length, 640, density)
      expect(plan.columns).toBe(640 * density)
      let peak = 0
      for (let column = 1; column < plan.columns; column++) {
        expect(sampleTraceAt(flat, plan, column)).toBeCloseTo(13, 12)
        peak = Math.max(peak, sampleTraceAt(spike, plan, column))
      }
      peaks.push(peak)
    }
    expect(peaks[1]).toBeGreaterThan(peaks[0])
  })

  it('redraws a paused canvas after density changes and releases its listeners', () => {
    canvasContext()
    vi.stubGlobal('devicePixelRatio', 1)
    let queued
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      queued = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const queries = []
    vi.stubGlobal('matchMedia', (query) => {
      const media = { query, addEventListener: vi.fn(), removeEventListener: vi.fn() }
      queries.push(media)
      return media
    })
    const view = render(
      <EEGViewer
        channels={[{ label: 'Fp1', data: Float32Array.from([0, 10, 0]) }]}
        timeAxis={[0, 0.5, 1]}
      />,
    )
    const canvas = screen.getByRole('img')
    expect(canvas.width).toBe(1280)
    const listener = queries[0].addEventListener.mock.calls[0][1]
    vi.stubGlobal('devicePixelRatio', 3)
    act(() => listener())
    expect(queries[0].removeEventListener).toHaveBeenCalledWith('change', listener)
    expect(queries[1].query).toBe('(resolution: 3dppx)')
    act(() => queued())
    expect(canvas.width).toBe(1920)
    view.unmount()
    expect(queries[1].removeEventListener).toHaveBeenCalledWith('change', listener)
  })

  it('preserves the backing bitmap while hidden and paints the latest frame when shown again', () => {
    const ctx = canvasContext()
    ctx.clearRect = vi.fn()
    const props = {
      channels: [{ label: 'Fp1', data: Float32Array.from([0, 10, 0]) }],
      timeAxis: [0, 0.5, 1],
    }
    const view = render(<EEGViewer {...props} />)
    const canvas = screen.getByRole('img')
    const width = canvas.width
    const paints = ctx.clearRect.mock.calls.length
    view.rerender(<EEGViewer {...props} isVisible={false} channels={[...props.channels]} />)
    expect(canvas.width).toBe(width)
    expect(ctx.clearRect.mock.calls.length).toBe(paints)
    view.rerender(<EEGViewer {...props} isVisible={true} channels={[...props.channels]} />)
    expect(screen.getByRole('img')).toBe(canvas)
    expect(ctx.clearRect.mock.calls.length).toBe(paints + 1)
  })

  it('maps annotation clicks using the same fractional plot width as painting', () => {
    canvasContext()
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 640.5,
      height: 72,
    })
    const onAnnotate = vi.fn()
    render(
      <EEGViewer
        channels={[{ label: 'Fp1', data: Float32Array.from([0, 10, 0]) }]}
        timeAxis={[0, 0.5, 1]}
        windowStart={20}
        onAnnotate={onAnnotate}
      />,
    )
    fireEvent.click(screen.getByRole('button'), { clientX: 72 + (640.5 - 72) / 2, clientY: 24 })
    expect(onAnnotate).toHaveBeenCalledWith(20.5, 'Fp1')
  })
})
