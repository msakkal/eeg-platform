import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  window.history.replaceState({}, '', '/')
  delete window.eegProfile
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('opt-in browser profiling', () => {
  it('does not collect metrics or expose a global profiler during ordinary use', async () => {
    vi.resetModules()
    const profiler = await import('../src/engine/eegPerformance')
    profiler.recordEEGMetric('paintMs', 5)
    expect(profiler.eegProfilingEnabled).toBe(false)
    expect(profiler.eegPerformanceReport().metrics).toEqual({})
    expect(window.eegProfile).toBeUndefined()
  })

  it('bounds its history, reports browser long tasks, and can reset measurements', async () => {
    window.history.replaceState({}, '', '/?profileEEG=1')
    let onTasks
    const observe = vi.fn()
    vi.stubGlobal(
      'PerformanceObserver',
      class {
        static supportedEntryTypes = ['longtask']
        constructor(callback) {
          onTasks = callback
        }
        observe = observe
      },
    )
    vi.resetModules()
    const profiler = await import('../src/engine/eegPerformance')
    profiler.setEEGBackend('worker')
    for (let i = 0; i < 3000; i++) profiler.recordEEGMetric('paintMs', i)
    onTasks({ getEntries: () => [{ duration: 75 }] })
    const report = window.eegProfile.report()
    expect(report.backend).toBe('worker')
    expect(report.recentSampleLimit).toBe(2048)
    expect(report.metrics.paintMs.count).toBe(3000)
    expect(report.metrics.paintMs.p50Ms).toBeGreaterThan(1900)
    expect(report.metrics.paintMs.maxMs).toBe(2999)
    expect(report.metrics.longTaskMs.maxMs).toBe(75)
    expect(observe).toHaveBeenCalledWith({ entryTypes: ['longtask'] })
    window.eegProfile.reset()
    expect(window.eegProfile.report().metrics).toEqual({})
  })
})
