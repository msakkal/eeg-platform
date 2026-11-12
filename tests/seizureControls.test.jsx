import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import '../src/i18n/i18n'
import SandboxControls from '../src/components/eeg/SandboxControls'
import { useEEGSignal } from '../src/hooks/useEEGSignal'
import { DEFAULT_FOCAL_SEIZURE_OPTIONS, DEFAULT_SEIZURE_DURATION } from '../src/engine/seizures'
import { useState } from 'react'

let nextFrame
beforeEach(() => {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback) => {
      nextFrame = callback
      return 1
    }),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('seizure injection controls', () => {
  it('uses one shared duration slider for both seizure buttons', () => {
    const start = vi.fn()
    function Controls() {
      const [duration, setDuration] = useState(DEFAULT_SEIZURE_DURATION)
      return (
        <SandboxControls
          pattern="normal_awake"
          seizureDuration={duration}
          onSeizureDurationChange={setDuration}
          onStartSeizure={(kind) => start(kind, duration)}
        />
      )
    }
    render(<Controls />)
    expect(screen.getByLabelText('Seizure duration')).not.toBeVisible()
    fireEvent.click(screen.getByText('Seizure settings'))
    expect(screen.getAllByRole('slider')).toHaveLength(1)
    const slider = screen.getByRole('slider', { name: 'Seizure duration' })
    fireEvent.change(slider, { target: { value: '45' } })
    expect(slider).toHaveAttribute('aria-valuetext', '45 seconds')
    fireEvent.click(screen.getByText('Seizure settings'))
    fireEvent.click(screen.getByRole('button', { name: 'Generalized' }))
    expect(start).toHaveBeenLastCalledWith('generalized', 45)
    fireEvent.click(screen.getByRole('button', { name: 'Focal' }))
    expect(start).toHaveBeenLastCalledWith('focal', 45)
  })

  it('lets the learner choose focal onset, spread, and timing before starting', () => {
    const start = vi.fn()
    function Controls() {
      const [settings, setSettings] = useState(DEFAULT_FOCAL_SEIZURE_OPTIONS)
      return (
        <SandboxControls
          pattern="normal_awake"
          focalOptions={settings}
          onFocalOptionsChange={setSettings}
          onStartSeizure={(kind) => start(kind, settings)}
        />
      )
    }
    render(<Controls />)
    expect(screen.getByLabelText('Focal onset')).not.toBeVisible()
    expect(screen.getByRole('button', { name: 'Focal' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Generalized' })).toBeVisible()
    fireEvent.click(screen.getByText('Seizure settings'))
    expect(screen.getByLabelText('Focal onset')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Focal onset'), { target: { value: 'right_occipital' } })
    fireEvent.change(screen.getByLabelText('Focal spread'), { target: { value: 'bilateral' } })
    fireEvent.change(screen.getByLabelText('Spread starts after'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Spread unfolds over'), { target: { value: '12' } })
    fireEvent.click(screen.getByText('Seizure settings'))
    expect(screen.getByLabelText('Focal onset')).not.toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Focal' }))
    expect(start).toHaveBeenCalledWith('focal', {
      onset: 'right_occipital',
      spread: 'bilateral',
      spreadDelay: 6,
      spreadDuration: 12,
    })
    expect(screen.queryByRole('button', { name: /inject/i })).not.toBeInTheDocument()
  })

  it('replaces spike/artifact actions with focal/generalized injection and a stop control', () => {
    const inject = vi.fn()
    const stop = vi.fn()
    const props = { pattern: 'normal_awake', onStartSeizure: inject, onStopSeizure: stop }
    const view = render(<SandboxControls {...props} />)
    expect(
      screen.queryByRole('button', { name: /^(inject|add).*(spike|artifact)/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Evolving focal seizure' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Focal' }))
    expect(inject).toHaveBeenLastCalledWith('focal')
    fireEvent.click(screen.getByRole('button', { name: 'Generalized' }))
    expect(inject).toHaveBeenLastCalledWith('generalized')
    view.rerender(<SandboxControls {...props} activeSeizure={{ kind: 'focal' }} />)
    expect(screen.getByRole('button', { name: 'Focal' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Stop example' }))
    expect(stop).toHaveBeenCalledOnce()
    view.rerender(<SandboxControls {...props} pattern="focal_status" />)
    expect(screen.getByRole('button', { name: 'Generalized' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Status activity continues')
  })

  it('schedules injections in the live engine, advances the trace, and exposes stop and completion', () => {
    const { result } = renderHook(() =>
      useEEGSignal({
        pattern: 'normal_awake',
        montageId: 'longitudinal_bipolar',
        noiseLevel: 0.1,
        isPlaying: true,
        windowSecs: 2,
        maxWindowSecs: 2,
        blinksEnabled: false,
      }),
    )
    expect(result.current.isReady).toBe(true)
    const initialStart = result.current.windowStart
    act(() => {
      expect(result.current.startSeizure('focal')).toBe(true)
    })
    expect(result.current.activeSeizure.kind).toBe('focal')
    expect(result.current.events.some((event) => event.type === 'simulated_focal_seizure')).toBe(
      true,
    )
    for (let i = 0; i < 25; i++) act(() => nextFrame(1000 + i * 40))
    expect(result.current.windowStart).toBeGreaterThan(initialStart)
    act(() => result.current.stopSeizure())
    expect(result.current.activeSeizure).toBeNull()
    act(() => {
      expect(result.current.startSeizure('generalized')).toBe(true)
    })
    expect(result.current.activeSeizure.kind).toBe('generalized')
    for (let i = 0; i < 200; i++) act(() => nextFrame(2100 + i * 100))
    expect(result.current.activeSeizure).toBeNull()
  })
})
