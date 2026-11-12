import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computePSD, computeSpectrogram, fft } from '../src/engine/fft'
import { MONTAGES } from '../src/engine/montages'
import { scalpChannelRMS } from '../src/engine/scalpAmplitude'
import { useSpectrogramWorker, disposeSpectrogramWorker } from '../src/hooks/useSpectrogramWorker'
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts'
import ScalpTopoMap from '../src/components/eeg/ScalpTopoMap'
import ErrorBoundary from '../src/components/ui/ErrorBoundary'
import { QUIZ_QUESTIONS } from '../src/engine/quiz'
import { ARTIFACT_CATALOGUE } from '../src/engine/artifacts'
import { computePropagationWeights, generatePropagationEEG } from '../src/engine/propagation'
import { applyMontage } from '../src/engine/montages'

afterEach(() => {
  cleanup()
  disposeSpectrogramWorker()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('spectral input validation', () => {
  it.each([0, 3, -1, 1.5])(
    'rejects invalid FFT size %s instead of producing invalid bins',
    (nfft) => {
      expect(() => computePSD(new Float32Array(8), 256, { nfft })).toThrow(RangeError)
    },
  )
  it('rejects invalid sample rates, mismatched FFT arrays, and zero STFT hops', () => {
    expect(() => computePSD(new Float32Array(8), 0)).toThrow(RangeError)
    expect(() => fft(new Float64Array(8), new Float64Array(7))).toThrow(RangeError)
    expect(() => computeSpectrogram(new Float32Array(512), 256, { hopSize: 0 })).toThrow(RangeError)
  })
  it('returns no invented spectrum for empty or incomplete data and handles a single sample', () => {
    expect(computePSD(new Float32Array()).freqs).toHaveLength(0)
    expect(computeSpectrogram(new Float32Array(8)).matrix).toHaveLength(0)
    expect([...computePSD(Float32Array.of(2), 256, { dbScale: false }).psd]).toEqual([4 / 256])
  })
})

class SpectralWorker {
  static instances = []
  requests = []
  terminate = vi.fn()
  constructor() {
    SpectralWorker.instances.push(this)
  }
  postMessage(request) {
    this.requests.push(request)
  }
  reply(index, result) {
    this.onmessage?.({ data: { id: this.requests[index].id, result } })
  }
}
const signal = Float32Array.from({ length: 512 }, (_, i) => Math.sin((2 * Math.PI * 10 * i) / 256))

describe('spectrogram request lifecycle', () => {
  beforeEach(() => {
    SpectralWorker.instances = []
    vi.stubGlobal('Worker', SpectralWorker)
  })
  it('does not restore a stale result after the signal is cleared', async () => {
    const { result, rerender } = renderHook(({ input }) => useSpectrogramWorker(input), {
      initialProps: { input: signal },
    })
    const worker = SpectralWorker.instances[0]
    rerender({ input: null })
    await act(async () => worker.reply(0, { stale: true }))
    expect(result.current).toBeNull()
  })
  it('ignores out-of-order responses for an earlier channel', async () => {
    const { result, rerender } = renderHook(({ input }) => useSpectrogramWorker(input), {
      initialProps: { input: signal },
    })
    const worker = SpectralWorker.instances[0]
    rerender({ input: signal.slice() })
    await act(async () => worker.reply(1, { channel: 'new' }))
    await act(async () => worker.reply(0, { channel: 'old' }))
    expect(result.current).toEqual({ channel: 'new' })
  })
  it('recovers from a worker runtime error with the same spectral calculation', async () => {
    const { result } = renderHook(() => useSpectrogramWorker(signal))
    const worker = SpectralWorker.instances[0]
    await act(async () => worker.onerror({ preventDefault() {} }))
    await waitFor(() => expect(result.current?.matrix.length).toBeGreaterThan(0))
    expect(result.current).toEqual(computeSpectrogram(signal))
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('also works when workers cannot be created', async () => {
    vi.stubGlobal('Worker', undefined)
    const { result } = renderHook(() => useSpectrogramWorker(signal))
    await waitFor(() => expect(result.current?.matrix.length).toBeGreaterThan(0))
  })
})

describe('reference-aware scalp amplitude map', () => {
  const reference = MONTAGES.average_reference.channels
  const channels = () => [
    { label: reference[0].label, data: Float32Array.of(3, -3) },
    {
      label: reference[1].label,
      data: Float32Array.of(4, -4),
      filteredData: Float32Array.of(2, -2),
    },
  ]
  it('rejects bipolar channel amplitudes as electrode measurements and uses filtered referential data', () => {
    expect(
      scalpChannelRMS([{ label: 'Fp1–F7', data: Float32Array.of(100) }], 'longitudinal_bipolar'),
    ).toBeNull()
    expect(scalpChannelRMS(channels(), 'average_reference')).toEqual({
      [reference[0].pos]: 3,
      [reference[1].pos]: 2,
    })
    render(<ScalpTopoMap channels={channels()} montageId="longitudinal_bipolar" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/Choose a common-reference montage/)).toBeInTheDocument()
  })
  it('scales the heatmap with the head outline at high DPR and refreshes reused sample buffers', () => {
    const context = new Proxy(
      { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) },
      {
        get(object, property) {
          return (object[property] ??= vi.fn())
        },
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
    context.createLinearGradient = () => ({ addColorStop() {} })
    vi.stubGlobal('devicePixelRatio', 2)
    const data = channels()
    const { rerender } = render(
      <ScalpTopoMap channels={data} montageId="average_reference" size={64} revision={0} />,
    )
    expect(screen.getByRole('img')).toHaveAttribute('width', '128')
    expect(context.drawImage).toHaveBeenLastCalledWith(expect.any(HTMLCanvasElement), 0, 0, 64, 64)
    data[0].data.fill(8)
    rerender(<ScalpTopoMap channels={data} montageId="average_reference" size={64} revision={1} />)
    expect(context.drawImage).toHaveBeenCalledTimes(2)
  })
})

describe('keyboard and static-host recovery', () => {
  it('preserves browser shortcuts and editable/interactive controls', () => {
    const handler = vi.fn()
    function Probe() {
      useKeyboardShortcuts({ f: handler })
      return (
        <>
          <div contentEditable suppressContentEditableWarning>
            <span>Editable</span>
          </div>
          <button>Native button</button>
        </>
      )
    }
    render(<Probe />)
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'f', metaKey: true })
    fireEvent.keyDown(screen.getByText('Editable'), { key: 'f' })
    fireEvent.keyDown(screen.getByRole('button'), { key: 'f' })
    expect(handler).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'f' })
    expect(handler).toHaveBeenCalledOnce()
  })
  it('keeps error recovery inside a deployed subdirectory', () => {
    vi.stubEnv('BASE_URL', '/eeg-platform/')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken() {
      throw new Error('test')
    }
    const expectedError = (event) => {
      if (event.error?.message === 'test') event.preventDefault()
    }
    window.addEventListener('error', expectedError)
    try {
      render(
        <ErrorBoundary>
          <Broken />
        </ErrorBoundary>,
      )
    } finally {
      window.removeEventListener('error', expectedError)
    }
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute(
      'href',
      '/eeg-platform/#/',
    )
  })
})

describe('reviewed clinical teaching', () => {
  const question = (id) => QUIZ_QUESTIONS.find((item) => item.id === id)
  it('uses a two-spike minimum, contextual interpretation, and the correct source references', () => {
    expect(question('q_polyspike_id').explanation).toContain('two or more')
    expect(question('q_sharp_wave_id').explanation).toContain('normal variants and artifacts')
    expect(
      question('q_montage_phase_reversal').options.find(({ correct }) => correct).text,
    ).toMatch(/maximum or minimum/)
    expect(question('q_spike_duration').referenceUrl).toContain('PMC6123891')
  })
  it('retains uncertainty around activation, slowing, and prognosis', () => {
    expect(question('q_scenario_absence').explanation).toContain('15–20%')
    expect(question('q_scenario_burst').explanation).toContain('multimodal')
    expect(question('q_scenario_burst').explanation).toContain('≥72 h')
    expect(question('q_delta_frequency').explanation).not.toContain('always abnormal')
    const blink = ARTIFACT_CATALOGUE.find((entry) => entry.mechanism?.includes('cornea-positive'))
    expect(blink).toBeDefined()
    expect(blink.mechanism).not.toContain('100 mV')
  })
  it('keeps the propagation example consistent with negative-up EEG polarity', () => {
    const { channels } = generatePropagationEEG(computePropagationWeights('T7', 0.15), 2000)
    const derived = applyMontage(channels, 'longitudinal_bipolar')
    const peak = Math.round(1.4 * 256) + 4
    // Negative T7: F7-T7 is positive (down), T7-P7 negative (up).
    expect(derived.find(({ label }) => label === 'F7–T7').data[peak]).toBeGreaterThan(1000)
    expect(derived.find(({ label }) => label === 'T7–P7').data[peak]).toBeLessThan(-1000)
  })
})
