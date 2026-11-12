// Opt in with /?profileEEG=1#/sandbox. Metrics contain durations and counters,
// never signal samples. A bounded history prevents profiling from growing RAM.
export const eegProfilingEnabled =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('profileEEG') === '1'

const samples = new Map()
const LIMIT = 2048
let backend = 'unknown'

export function recordEEGMetric(name, duration) {
  if (!eegProfilingEnabled || !Number.isFinite(duration)) return
  let metric = samples.get(name)
  if (!metric) {
    metric = { values: new Float64Array(LIMIT), count: 0, sum: 0, max: 0 }
    samples.set(name, metric)
  }
  metric.values[metric.count % LIMIT] = duration
  metric.count++
  metric.sum += duration
  metric.max = Math.max(metric.max, duration)
}

export function setEEGBackend(value) {
  if (eegProfilingEnabled) backend = value
}

export function eegPerformanceReport() {
  const metrics = {}
  for (const [name, metric] of samples) {
    const values = Array.from(metric.values.subarray(0, Math.min(metric.count, LIMIT))).sort(
      (a, b) => a - b,
    )
    metrics[name] = {
      count: metric.count,
      meanMs: metric.sum / metric.count,
      p50Ms: values[Math.floor((values.length - 1) * 0.5)],
      p95Ms: values[Math.floor((values.length - 1) * 0.95)],
      maxMs: metric.max,
    }
  }
  return {
    backend,
    recentSampleLimit: LIMIT,
    longTasksSupported:
      typeof PerformanceObserver !== 'undefined' &&
      Boolean(PerformanceObserver.supportedEntryTypes?.includes('longtask')),
    heapUsedBytes:
      typeof performance !== 'undefined' ? (performance.memory?.usedJSHeapSize ?? null) : null,
    metrics,
  }
}

if (eegProfilingEnabled) {
  window.eegProfile = {
    report: eegPerformanceReport,
    reset: () => samples.clear(),
  }
  if (
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes?.includes('longtask')
  ) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) recordEEGMetric('longTaskMs', entry.duration)
    })
    observer.observe({ entryTypes: ['longtask'] })
    if (import.meta.hot) import.meta.hot.dispose(() => observer.disconnect())
  }
}
