// Precompute the source-sample footprints shared by every channel at a given
// sweep length and canvas width. Float64 weights retain the renderer's original
// arithmetic. Higher backing resolutions can request more columns to retain
// visible detail; raw signal samples are never modified.
export function createTraceSamplingPlan(length, plotWidth, sampleDensity = 2) {
  const columns = Math.max(2, Math.ceil(plotWidth * sampleDensity))
  const lastIndex = length - 1
  const halfFootprint = (lastIndex / Math.max(1, columns - 1)) * 0.5
  const firstIndices = new Uint32Array(columns)
  const offsets = new Uint32Array(columns + 1)
  const totals = new Float64Array(columns)
  const fractions = halfFootprint < 0.5 ? new Float64Array(columns) : null
  const weights = []

  for (let column = 1; column < columns; column++) {
    const index = (column / (columns - 1)) * lastIndex
    offsets[column] = weights.length
    if (fractions) {
      firstIndices[column] = Math.floor(index)
      fractions[column] = index - firstIndices[column]
      continue
    }
    const left = Math.max(-0.5, index - halfFootprint)
    const right = Math.min(length - 0.5, index + halfFootprint)
    const first = Math.max(0, Math.floor(left + 0.5))
    const last = Math.min(length - 1, Math.ceil(right - 0.5))
    firstIndices[column] = first
    for (let i = first; i <= last; i++) {
      const weight = Math.max(0, Math.min(right, i + 0.5) - Math.max(left, i - 0.5))
      weights.push(weight)
      totals[column] += weight
    }
  }
  offsets[columns] = weights.length
  return {
    length,
    columns,
    firstIndices,
    offsets,
    totals,
    fractions,
    weights: Float64Array.from(weights),
  }
}

export function sampleTraceAt(data, plan, column) {
  const first = plan.firstIndices[column]
  if (plan.fractions) {
    const next = Math.min(data.length - 1, first + 1)
    return data[first] + (data[next] - data[first]) * plan.fractions[column]
  }
  let sum = 0
  const start = plan.offsets[column]
  const end = plan.offsets[column + 1]
  for (let weight = start, index = first; weight < end; weight++, index++) {
    sum += data[index] * plan.weights[weight]
  }
  return plan.totals[column] > 0 ? sum / plan.totals[column] : data[first]
}
