// Run with: node scripts/benchmark-eeg.mjs
// Node CPU measurements, not browser FPS. Geometry setup is excluded from the
// sampling hot-path comparison because it is shared across channels/frames.
import { performance } from 'node:perf_hooks'
import { createEngineForPattern } from '../src/engine/streaming.js'
import { createTraceSamplingPlan, sampleTraceAt } from '../src/engine/traceSampling.js'

function median(values) {
  return values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
}

function originalSample(data, index, half) {
  if (half < 0.5) {
    const first = Math.floor(index)
    const next = Math.min(data.length - 1, first + 1)
    return data[first] + (data[next] - data[first]) * (index - first)
  }
  const left = Math.max(-0.5, index - half)
  const right = Math.min(data.length - 0.5, index + half)
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

const synthesis = []
for (const pattern of ['normal_awake', 'normal_sleep', 'temporal_sharps', 'diffuse_slowing']) {
  const timings = []
  for (let iteration = 0; iteration < 7; iteration++) {
    const engine = createEngineForPattern(pattern, { seed: 42 })
    const start = performance.now()
    engine.fillWindow(70)
    if (iteration >= 2) timings.push(performance.now() - start)
  }
  synthesis.push({ pattern, '70-second prefill (ms)': +median(timings).toFixed(2) })
}
console.table(synthesis)

let checksum = 0
const sampling = []
for (const duration of [10, 30, 60]) {
  const length = duration * 256
  const data = Float32Array.from({ length }, (_, i) => 50 * Math.sin(i * 0.3))
  const plan = createTraceSamplingPlan(length, 1200)
  const half = ((length - 1) / (plan.columns - 1)) * 0.5
  function measure(sample) {
    const timings = []
    for (let iteration = 0; iteration < 7; iteration++) {
      const start = performance.now()
      for (let channel = 0; channel < 19 * 30; channel++) {
        for (let column = 1; column < plan.columns; column++) checksum += sample(column)
      }
      if (iteration >= 2) timings.push(performance.now() - start)
    }
    return median(timings)
  }
  const original = measure((column) =>
    originalSample(data, (column / (plan.columns - 1)) * (length - 1), half),
  )
  const cached = measure((column) => sampleTraceAt(data, plan, column))
  sampling.push({
    'window (s)': duration,
    'original (ms)': +original.toFixed(2),
    'cached (ms)': +cached.toFixed(2),
    speedup: `${(original / cached).toFixed(2)}×`,
  })
}
console.table(sampling)
console.log('Sampling checksum:', checksum)
