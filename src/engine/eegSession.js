import { SAMPLE_RATE, ELECTRODES_1020 } from './signalGenerator.js'
import { createEngineForPattern, configureEngineControls } from './streaming.js'
import { applyMontage, MONTAGES } from './montages.js'
import { applyFilterChain } from './filters.js'

export const FILTER_PREROLL_SECONDS = 10
export const filterKey = (config) =>
  `${config?.hp ?? null}|${config?.lp ?? null}|${config?.notch ?? null}`
const hasFilters = (config) => Boolean(config?.hp || config?.lp || config?.notch)

function addRingToLinear(out, source, readIdx, ringLength) {
  let outIdx = 0
  let sourceIdx = readIdx
  while (outIdx < out.length) {
    const span = Math.min(out.length - outIdx, ringLength - sourceIdx)
    for (let i = 0; i < span; i++) out[outIdx + i] += source[sourceIdx + i]
    outIdx += span
    sourceIdx = 0
  }
}

function writeRingDifference(
  out,
  positive,
  negative,
  readIdx,
  ringLength,
  negativeIsLinear = false,
) {
  let outIdx = 0
  let sourceIdx = readIdx
  while (outIdx < out.length) {
    const span = Math.min(out.length - outIdx, ringLength - sourceIdx)
    if (negativeIsLinear) {
      for (let i = 0; i < span; i++) {
        out[outIdx + i] = positive[sourceIdx + i] - negative[outIdx + i]
      }
    } else if (negative) {
      for (let i = 0; i < span; i++) {
        out[outIdx + i] = positive[sourceIdx + i] - negative[sourceIdx + i]
      }
    } else {
      out.set(positive.subarray(sourceIdx, sourceIdx + span), outIdx)
    }
    outIdx += span
    sourceIdx = 0
  }
}

function writeRingAverage(out, first, second, readIdx, ringLength) {
  let outIdx = 0
  let sourceIdx = readIdx
  while (outIdx < out.length) {
    const span = Math.min(out.length - outIdx, ringLength - sourceIdx)
    for (let i = 0; i < span; i++) {
      out[outIdx + i] = (first[sourceIdx + i] + second[sourceIdx + i]) * 0.5
    }
    outIdx += span
    sourceIdx = 0
  }
}

export class EEGSignalSession {
  constructor(options, { deferred = false } = {}) {
    this.options = { windowSecs: 10, maxWindowSecs: 60, ...options }
    this.engine = createEngineForPattern(this.options.pattern, this.options)
    const visibleCapacity = Math.max(1, Math.round(this.options.maxWindowSecs * SAMPLE_RATE))
    const historyLength = FILTER_PREROLL_SECONDS * SAMPLE_RATE
    const length = visibleCapacity + historyLength
    const initial = deferred
      ? Object.fromEntries(ELECTRODES_1020.map((label) => [label, new Float32Array(length)]))
      : this.engine.fillWindow(length / SAMPLE_RATE)
    this.ring = {
      channels: initial,
      labels: Object.keys(initial),
      length,
      historyLength,
      writeIdx: 0,
    }
    this.filledSamples = deferred ? 0 : length
    this.cursor = this.filledSamples / SAMPLE_RATE
    this.sampleRemainder = 0
    this.incomingPool = new Map()
    this.filterWorkspaces = []
    this.derivedBuffers = null
    this.configure(this.options)
  }

  initializeChunk(sampleCount = SAMPLE_RATE) {
    const count = Math.min(sampleCount, this.ring.length - this.filledSamples)
    if (count <= 0) return
    const incoming = this.engine.fillWindow(
      count / SAMPLE_RATE,
      this.incomingPool.get(count) ?? null,
    )
    this.incomingPool.set(count, incoming)
    for (const label of this.ring.labels)
      this.ring.channels[label].set(incoming[label], this.filledSamples)
    this.filledSamples += count
    this.ring.writeIdx = this.filledSamples % this.ring.length
    this.cursor = this.filledSamples / SAMPLE_RATE
  }

  configure(options) {
    if (['eyesClosed', 'blinksEnabled', 'blinkRate', 'noiseLevel', 'activationProcedure']
      .some(key => Object.hasOwn(options, key) && options[key] !== this.options[key])) {
      configureEngineControls(this.engine, this.options.pattern, { ...this.options, ...options })
    }
    this.options = { ...this.options, ...options }
    this.visibleLength = Math.min(
      this.ring.length - this.ring.historyLength,
      Math.max(1, Math.round(this.options.windowSecs * SAMPLE_RATE)),
    )
  }

  advance(elapsedSec) {
    const exactStep = elapsedSec * SAMPLE_RATE + this.sampleRemainder
    let remaining = Math.floor(exactStep)
    this.sampleRemainder = exactStep - remaining
    const ring = this.ring
    // Backpressure may combine multiple display ticks. Generate all elapsed
    // samples, in bounded blocks, instead of dropping physiology or queuing
    // many obsolete full-window responses.
    while (remaining > 0) {
      const step = Math.min(remaining, SAMPLE_RATE)
      const incoming = this.engine.fillWindow(
        step / SAMPLE_RATE,
        this.incomingPool.get(step) ?? null,
      )
      this.incomingPool.set(step, incoming)
      for (const label of ring.labels) {
        const src = incoming[label]
        const buf = ring.channels[label]
        const firstSpan = Math.min(src.length, ring.length - ring.writeIdx)
        if (firstSpan === src.length) buf.set(src, ring.writeIdx)
        else {
          buf.set(src.subarray(0, firstSpan), ring.writeIdx)
          buf.set(src.subarray(firstSpan), 0)
        }
      }
      ring.writeIdx = (ring.writeIdx + step) % ring.length
      this.cursor += step / SAMPLE_RATE
      remaining -= step
    }
  }

  frame() {
    const ring = this.ring
    const config = this.options.filterConfig
    const historyLength = hasFilters(config) ? ring.historyLength : 0
    const outputLength = historyLength + this.visibleLength
    const readIdx = (ring.writeIdx + ring.length - outputLength) % ring.length
    const channels = this.materialiseMontage(
      ring.channels,
      this.options.montageId,
      readIdx,
      outputLength,
      historyLength,
    )
    channels.forEach((channel) => {
      channel.processed = true
    })
    if (hasFilters(config)) {
      const key = filterKey(config)
      channels.forEach((channel, index) => {
        const workspace = (this.filterWorkspaces[index] ??= {})
        const filtered = applyFilterChain(channel.data, SAMPLE_RATE, config, workspace)
        // Transfer only frame-owned arrays. Private biquad scratch buffers
        // remain in the worker for the next pass.
        channel.filteredData = filtered.slice(historyLength)
        channel.filterKey = key
      })
    }
    const visibleSecs = this.visibleLength / SAMPLE_RATE
    return {
      channels,
      pattern: this.options.pattern,
      visibleSamples: this.visibleLength,
      windowStart: this.cursor + this.sampleRemainder / SAMPLE_RATE - visibleSecs,
      sampleOffset: this.sampleRemainder,
      events: this.engine.getEventsSince?.(Math.max(0, this.cursor - visibleSecs)) ?? [],
      activeSeizure: this.engine.getActiveSeizure?.() ?? null,
      canStartSeizure: !['focal_status', 'generalized_status'].includes(this.options.pattern),
    }
  }

  handle(type, args = {}) {
    let accepted = true
    // Commands are anchored after all elapsed playback time captured before
    // the click, even if a preceding worker request was still in flight.
    if ((type === 'startSeizure' || type === 'stopSeizure') && args.elapsedSec > 0)
      this.advance(args.elapsedSec)
    if (type === 'tick') this.advance(args.elapsedSec)
    else if (type === 'configure') this.configure(args)
    else if (type === 'startSeizure')
      accepted = this.engine.startSeizure?.(args.kind, args.settings) ?? false
    else if (type === 'stopSeizure') this.engine.stopSeizure?.()
    else throw new Error(`Unknown EEG operation: ${type}`)
    return { ...this.frame(), accepted }
  }

  materialiseMontage(
    rawChannels,
    montageIdValue,
    readIdx,
    outputLength = null,
    visibleStartIndex = 0,
  ) {
    const montage = MONTAGES[montageIdValue]
    if (!montage) return applyMontage(rawChannels, montageIdValue, readIdx)

    const ringLength = rawChannels.Fp1?.length ?? Object.values(rawChannels)[0]?.length ?? 0
    const length = outputLength ?? ringLength
    const cacheKey = `${montageIdValue}:${length}:${visibleStartIndex}`
    let cache = this.derivedBuffers

    if (!cache || cache.key !== cacheKey) {
      const scalpLabels = Object.keys(rawChannels).filter((label) => !['A1', 'A2'].includes(label))
      cache = {
        key: cacheKey,
        avgRef: new Float32Array(length),
        earRef: new Float32Array(length),
        scalpLabels,
      }
      this.derivedBuffers = cache
    }

    const needsAverage = montage.channels.some((ch) => ch.neg === 'average')
    const needsEars = montage.channels.some((ch) => ch.neg === 'ears')

    if (needsAverage) {
      cache.avgRef.fill(0)
      for (let j = 0; j < cache.scalpLabels.length; j++) {
        addRingToLinear(cache.avgRef, rawChannels[cache.scalpLabels[j]], readIdx, ringLength)
      }
      const inverseCount = 1 / cache.scalpLabels.length
      for (let i = 0; i < length; i++) cache.avgRef[i] *= inverseCount
    }

    if (needsEars) {
      const a1 = rawChannels.A1
      const a2 = rawChannels.A2
      writeRingAverage(cache.earRef, a1, a2, readIdx, ringLength)
    }

    // Published samples and their timestamps must remain one immutable frame.
    // Hover/resize redraws and React can still hold the previous frame while
    // the engine prepares the next one. Reuse only private reference scratch
    // buffers; never overwrite sample arrays that have already been published.
    const channels = montage.channels.map(({ label }) => ({
      label,
      data: new Float32Array(length),
      visibleStartIndex,
    }))

    for (let chIdx = 0; chIdx < montage.channels.length; chIdx++) {
      const { pos, neg } = montage.channels[chIdx]
      const posBuf = rawChannels[pos]
      const out = channels[chIdx].data
      let negBuf = null
      if (neg === 'average') negBuf = cache.avgRef
      else if (neg === 'ears') negBuf = cache.earRef
      else negBuf = rawChannels[neg]

      if (!posBuf) {
        out.fill(0)
        continue
      }

      writeRingDifference(
        out,
        posBuf,
        negBuf,
        readIdx,
        ringLength,
        neg === 'average' || neg === 'ears',
      )
    }

    return channels
  }
}

// Kept independent of Worker globals so the same protocol can run synchronously
// where workers are unavailable and can be exercised in deterministic tests.
export function createEEGRequestHandler() {
  let session = null
  return ({ id, revision, type, args, clientId }) => {
    const started = performance.now()
    try {
      let frame
      if (type === 'init') {
        session = new EEGSignalSession(args)
        frame = session.frame()
      } else {
        if (!session) throw new Error('EEG session has not been initialized')
        frame = session.handle(type, args)
      }
      return { id, revision, clientId, frame, processingMs: performance.now() - started }
    } catch (error) {
      return { id, revision, clientId, error: error.message }
    }
  }
}

export function frameTransferables(frame) {
  const buffers = new Set()
  for (const channel of frame.channels) {
    buffers.add(channel.data.buffer)
    if (channel.filteredData) buffers.add(channel.filteredData.buffer)
  }
  return [...buffers]
}
