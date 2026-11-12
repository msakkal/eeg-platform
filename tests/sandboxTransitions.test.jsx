import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '../src/i18n/i18n'
import SandboxPage from '../src/pages/SandboxPage'
import { useEEGStore } from '../src/store/eegStore'

const signal = vi.hoisted(() => ({ frame: null }))
vi.mock('../src/hooks/useEEGSignal', () => ({ useEEGSignal: () => signal.frame }))
vi.mock('../src/components/eeg/EEGViewer', () => ({
  default: ({ isVisible = true, onAnnotate }) => (
    <div data-testid="trace-viewer" data-visible={isVisible} data-markable={Boolean(onAnnotate)} />
  ),
}))
vi.mock('../src/components/eeg/SpectrumViewer', () => ({ default: () => <div>Spectrum</div> }))
vi.mock('../src/components/eeg/SpectrogramViewer', () => ({
  default: () => <div>Spectrogram</div>,
}))
vi.mock('../src/components/eeg/ScalpTopoMap', () => ({ default: () => <div>Scalp map</div> }))

beforeEach(() => {
  useEEGStore.setState({ pattern: 'normal_awake', isPlaying: false })
  signal.frame = {
    channels: [{ label: 'Fp1–F7', data: new Float32Array(512) }],
    timeAxis: [0, 2],
    isReady: true,
    isUpdating: false,
    events: [],
    windowStart: 10,
    sampleOffset: 0,
    activeSeizure: null,
    startSeizure: vi.fn(),
    stopSeizure: vi.fn(),
  }
})
afterEach(cleanup)

describe('nonblank sandbox transitions', () => {
  it('keeps the same trace viewer mounted across tabs and disables hidden drawing', () => {
    render(
      <MemoryRouter>
        <SandboxPage />
      </MemoryRouter>,
    )
    const viewer = screen.getByTestId('trace-viewer')
    fireEvent.click(screen.getByRole('button', { name: 'analysis', exact: true }))
    expect(viewer).not.toBeVisible()
    expect(viewer).toHaveAttribute('data-visible', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'traces', exact: true }))
    expect(screen.getByTestId('trace-viewer')).toBe(viewer)
    expect(viewer).toBeVisible()
    expect(viewer).toHaveAttribute('data-visible', 'true')
  })

  it('keeps the trace visible during a pattern update and prevents marking retained data', () => {
    const view = render(
      <MemoryRouter>
        <SandboxPage />
      </MemoryRouter>,
    )
    const viewer = screen.getByTestId('trace-viewer')
    fireEvent.click(screen.getByRole('button', { name: 'Mark', exact: true }))
    expect(viewer).toHaveAttribute('data-markable', 'true')
    signal.frame = { ...signal.frame, isUpdating: true }
    act(() => useEEGStore.getState().setPattern('normal_sleep'))
    expect(screen.getByTestId('trace-viewer')).toBe(viewer)
    expect(viewer).toBeVisible()
    expect(viewer).toHaveAttribute('data-markable', 'false')
    expect(screen.getByText(/Previous frame remains visible/)).toBeVisible()
    signal.frame = { ...signal.frame, isUpdating: false }
    view.rerender(
      <MemoryRouter>
        <SandboxPage />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('trace-viewer')).toBe(viewer)
    expect(viewer).toHaveAttribute('data-markable', 'true')
  })
})
