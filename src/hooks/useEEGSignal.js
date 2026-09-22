import { useState, useEffect, useRef, useCallback } from 'react'
import { SAMPLE_RATE, makeTimeAxis } from '@/engine/signalGenerator'
import { createEngineForPattern }    from '@/engine/streaming'
import { applyMontage, MONTAGES } from '@/engine/montages'

const FILTER_PREROLL_SECONDS = 10
const DEFAULT_MAX_WINDOW_SECONDS = 60
const HIGH_REFRESH_WINDOW_SECONDS = 15
const HIGH_REFRESH_FPS = 120
const STANDARD_REFRESH_FPS = 60

function hasActiveFilterConfig(filterConfig) {
  return Boolean(filterConfig?.hp || filterConfig?.lp || filterConfig?.notch)
}

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

function writeRingDifference(out, positive, negative, readIdx, ringLength, negativeIsLinear = false) {
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

/**
 * useEEGSignal
 * Drives a live streaming EEG display from `streaming.js`. Each animation
 * frame advances the engine clock by `stepSec` seconds and appends the new
 * samples to a per-channel ring buffer holding the visible window. At a
 * display-friendly cadence it applies the active montage transform and
 * publishes the signal plus its clock position as one React snapshot.
 *
 * Returns: { channels, timeAxis, isReady, windowStart }
 *
 * @param {object} opts
 *   - montageId: string
 *   - pattern: string (see streaming.js / signalGenerator.js)
 *   - noiseLevel: number
 *   - isPlaying: bool
 *   - pendingSpike / pendingArtifact: optional injection flags
 *   - onClearPending: callback after handling a pending injection
 *   - eyesClosed, blinksEnabled, blinkRate: awake-state modifiers
 *   - windowSecs: how many seconds the on-screen window represents (default 10)
 *   - maxWindowSecs: largest visible window retained for sweep-speed changes
 */
export function useEEGSignal({
  montageId,
  pattern,
  noiseLevel,
  filterConfig = null,
  activationProcedure = 'none',
  isPlaying,
  pendingSpike,
  pendingArtifact,
  onClearPending,
  eyesClosed    = true,
  blinksEnabled = true,
  blinkRate     = 18,
  windowSecs    = 10,
  maxWindowSecs = DEFAULT_MAX_WINDOW_SECONDS,
}) {
  const [signalFrame, setSignalFrame] = useState({
    channels: [],
    timeAxis: [],
    windowStart: 0,
    sampleOffset: 0,
  })
  const [isReady,         setIsReady]         = useState(false)
  const [events,          setEvents]          = useState([])

  // Streaming engine + per-channel ring buffer holding the visible window
  const engineRef     = useRef(null)
  const ringRef       = useRef(null)
  const derivedBuffersRef = useRef(null)
  const animFrameRef  = useRef(null)
  const cursorSecRef  = useRef(0)
  const lastFrameMsRef = useRef(0)
  const lastRenderMsRef = useRef(0)
  const sampleRemainderRef = useRef(0)
  const timeAxisRef = useRef([])
  const eventsKeyRef = useRef(null)
  const eventsPollKeyRef = useRef(null)
  const incomingPoolRef = useRef(new Map())

  // Refs for values that change during playback without restarting loop
  const montageIdRef   = useRef(montageId)
  const isPlayingRef   = useRef(isPlaying)
  const filterActiveRef = useRef(hasActiveFilterConfig(filterConfig))
  montageIdRef.current  = montageId
  isPlayingRef.current  = isPlaying
  filterActiveRef.current = hasActiveFilterConfig(filterConfig)

  const publishEvents = useCallback((visibleSecs, force = false) => {
    const engine = engineRef.current
    if (!engine?.getEventsSince) return
    const pollKey = `${Math.floor(cursorSecRef.current * 10)}:${visibleSecs}`
    if (!force && eventsPollKeyRef.current === pollKey) return
    eventsPollKeyRef.current = pollKey
    const start = Math.max(0, cursorSecRef.current - visibleSecs)
    const nextEvents = engine.getEventsSince(start)
    const nextKey = nextEvents.map(event => event.id).join('|')
    if (eventsKeyRef.current === nextKey) return
    eventsKeyRef.current = nextKey
    setEvents(nextEvents)
  }, [])

  const materialiseMontage = useCallback((rawChannels, montageIdValue, readIdx, outputLength = null, visibleStartIndex = 0) => {
    const montage = MONTAGES[montageIdValue]
    if (!montage) return applyMontage(rawChannels, montageIdValue, readIdx)

    const ringLength = rawChannels.Fp1?.length ?? Object.values(rawChannels)[0]?.length ?? 0
    const length = outputLength ?? ringLength
    const cacheKey = `${montageIdValue}:${length}:${visibleStartIndex}`
    let cache = derivedBuffersRef.current

    if (!cache || cache.key !== cacheKey) {
      const scalpLabels = Object.keys(rawChannels).filter(label => !['A1', 'A2'].includes(label))
      cache = {
        key: cacheKey,
        channels: montage.channels.map(({ label }) => ({
          label,
          data: new Float32Array(length),
          visibleStartIndex,
        })),
        avgRef: new Float32Array(length),
        earRef: new Float32Array(length),
        scalpLabels,
      }
      derivedBuffersRef.current = cache
    }

    const needsAverage = montage.channels.some(ch => ch.neg === 'average')
    const needsEars = montage.channels.some(ch => ch.neg === 'ears')

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

    for (let chIdx = 0; chIdx < montage.channels.length; chIdx++) {
      const { pos, neg } = montage.channels[chIdx]
      const posBuf = rawChannels[pos]
      const out = cache.channels[chIdx].data
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
        neg === 'average' || neg === 'ears'
      )
    }

    return cache.channels.slice()
  }, [])

    // ── Build / rebuild engine when pattern or eye-state changes ────────────
  useEffect(() => {
    setIsReady(false)
    const engine = createEngineForPattern(pattern, {
      eyesClosed,
      blinksEnabled,
      blinkRate,
      noiseLevel,
      activationProcedure,
    })
    engineRef.current = engine

    // Pre-fill with hidden history plus the widest visible window. The hidden
    // pre-roll lets viewer filters settle before the first rendered sample.
    const visibleN = Math.round(windowSecs * SAMPLE_RATE)
    const maxVisibleN = Math.round(maxWindowSecs * SAMPLE_RATE)
    const historyN = Math.round(FILTER_PREROLL_SECONDS * SAMPLE_RATE)
    const N = maxVisibleN + historyN
    const initial = engine.fillWindow(maxWindowSecs + FILTER_PREROLL_SECONDS)
    const labels = Object.keys(initial)
    const ring = {
      channels: {},
      writeIdx: 0,     // points at oldest sample (= where next write goes)
      length:   N,
      historyLength: historyN,
      visibleLength: visibleN,
      labels,
    }
    for (const label of labels) {
      ring.channels[label] = new Float32Array(N)
      ring.channels[label].set(initial[label])
    }
    ringRef.current = ring
    derivedBuffersRef.current = null
    cursorSecRef.current = maxWindowSecs + FILTER_PREROLL_SECONDS
    sampleRemainderRef.current = 0
    eventsPollKeyRef.current = null
    incomingPoolRef.current.clear()

    // Publish the initial window immediately so the trace is visible the
    // instant the panel mounts — without waiting for the first animation
    // frame (and so a paused viewer still shows a populated trace).
    // Use writeIdx=0 since the buffer was just filled linearly.
    const outputHistoryN = filterActiveRef.current ? historyN : 0
    const outputLength = outputHistoryN + visibleN
    const readIdx = (ring.writeIdx + ring.length - outputLength) % ring.length
    const nextTimeAxis = makeTimeAxis(visibleN, SAMPLE_RATE)
    timeAxisRef.current = nextTimeAxis
    setSignalFrame({
      channels: materialiseMontage(ring.channels, montageIdRef.current, readIdx, outputLength, outputHistoryN),
      timeAxis: nextTimeAxis,
      windowStart: cursorSecRef.current - visibleN / SAMPLE_RATE,
      sampleOffset: 0,
    })
    publishEvents(windowSecs, true)
    setIsReady(true)
  }, [pattern, eyesClosed, blinksEnabled, blinkRate, noiseLevel, activationProcedure, maxWindowSecs, materialiseMontage, publishEvents])

  // Montage and sweep-window changes should rematerialise immediately. The
  // animation loop also does this while playing, but this keeps controls
  // responsive while paused and avoids restarting the stream.
  useEffect(() => {
    if (!isReady) return
    const ring = ringRef.current
    if (!ring) return
    const visibleN = Math.min(
      ring.length - ring.historyLength,
      Math.max(1, Math.round(windowSecs * SAMPLE_RATE))
    )
    const visibleSecs = visibleN / SAMPLE_RATE
    if (cursorSecRef.current < visibleSecs) {
      cursorSecRef.current = visibleSecs
    }
    ring.visibleLength = visibleN
    const outputHistoryN = hasActiveFilterConfig(filterConfig) ? ring.historyLength : 0
    const outputLength = outputHistoryN + visibleN
    const readIdx = (ring.writeIdx + ring.length - outputLength) % ring.length
    const nextTimeAxis = makeTimeAxis(visibleN, SAMPLE_RATE)
    timeAxisRef.current = nextTimeAxis
    setSignalFrame({
      channels: materialiseMontage(ring.channels, montageId, readIdx, outputLength, outputHistoryN),
      timeAxis: nextTimeAxis,
      windowStart: cursorSecRef.current - visibleSecs,
      sampleOffset: 0,
    })
    publishEvents(visibleSecs, true)
  }, [montageId, windowSecs, filterConfig, isReady, materialiseMontage, publishEvents])

  // ── Pending transient injection (spike / muscle artifact) ───────────────
  // For the streaming engine these are stamped into the ring buffer at the
  // newest sample position. A more elegant approach would be a one-shot
  // overlay scheduled into the engine; that is a future refinement.
  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return
    if (!pendingSpike && !pendingArtifact) return

    if (pendingSpike) {
      engineRef.current?.recordEvent?.({
        t: cursorSecRef.current,
        type: 'manual_spike',
        label: 'Spike',
        detail: 'Injected spike',
      })
      const stampPos = (ring.writeIdx + ring.length - 1) % ring.length
      const halfW = Math.round(0.03 * SAMPLE_RATE)
      const amp   = 200
      for (const label of ring.labels) {
        const buf = ring.channels[label]
        for (let i = -halfW; i <= halfW; i++) {
          const idx = ((stampPos + i) % ring.length + ring.length) % ring.length
          const x = i / halfW
          buf[idx] += -amp * Math.exp(-x * x * 6)
        }
      }
      onClearPending?.()
    }
    if (pendingArtifact) {
      engineRef.current?.recordEvent?.({
        t: cursorSecRef.current,
        type: 'manual_artifact',
        label: 'Artifact',
        detail: 'Injected muscle artifact',
      })
      const len = Math.round(0.5 * SAMPLE_RATE)
      const start = (ring.writeIdx + ring.length - len) % ring.length
      const frontals = ['Fp1','Fp2','F3','F4','F7','F8']
      for (const label of frontals) {
        const buf = ring.channels[label]
        if (!buf) continue
        for (let i = 0; i < len; i++) {
          const idx = (start + i) % ring.length
          const env = Math.sin(Math.PI * i / len)
          buf[idx] += (Math.random() - 0.5) * 160 * env
        }
      }
      onClearPending?.()
    }
    publishEvents(windowSecs, true)
  }, [pendingSpike, pendingArtifact, onClearPending, publishEvents, windowSecs])

  // ── Animation loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return

    function frame(now = performance.now()) {
      if (!isPlayingRef.current) {
        lastFrameMsRef.current = now
        lastRenderMsRef.current = now
        animFrameRef.current = requestAnimationFrame(frame)
        return
      }

      const prevFrameMs = lastFrameMsRef.current
      lastFrameMsRef.current = now

      const ring = ringRef.current
      const engine = engineRef.current
      if (!ring || !engine) {
        animFrameRef.current = requestAnimationFrame(frame)
        return
      }

      // Advance the engine in real time. Sweep speed is a display control and
      // must not change the simulated physiology or annotation clock.
      const elapsedSec = prevFrameMs > 0
        ? Math.min((now - prevFrameMs) / 1000, 0.1)
        : 1 / 60
      const exactStep = SAMPLE_RATE * elapsedSec + sampleRemainderRef.current
      const step = Math.floor(exactStep)
      sampleRemainderRef.current = exactStep - step

      if (step < 1) {
        animFrameRef.current = requestAnimationFrame(frame)
        return
      }

      const stepSec = step / SAMPLE_RATE
      const reusableIncoming = incomingPoolRef.current.get(step) ?? null
      const incoming = engine.fillWindow(stepSec, reusableIncoming)
      if (!reusableIncoming) incomingPoolRef.current.set(step, incoming)
      cursorSecRef.current += stepSec

      // Append incoming samples into the ring buffer.
      for (const label of ring.labels) {
        const src = incoming[label]
        const buf = ring.channels[label]
        if (!src || !buf) continue
        const firstSpan = Math.min(src.length, ring.length - ring.writeIdx)
        if (firstSpan === src.length) {
          buf.set(src, ring.writeIdx)
        } else {
          buf.set(src.subarray(0, firstSpan), ring.writeIdx)
          buf.set(src.subarray(firstSpan), 0)
        }
      }
      ring.writeIdx = (ring.writeIdx + step) % ring.length

      // Use the display's refresh cadence for normal windows. Long windows
      // retain a lower cap because their montage/filter pass is much larger.
      const visibleSecs = ring.visibleLength / SAMPLE_RATE
      const renderFps = visibleSecs <= HIGH_REFRESH_WINDOW_SECONDS
        ? HIGH_REFRESH_FPS
        : STANDARD_REFRESH_FPS
      const renderIntervalMs = 1000 / renderFps
      const sinceLastRenderMs = now - lastRenderMsRef.current
      if (sinceLastRenderMs < renderIntervalMs - 0.75) {
        animFrameRef.current = requestAnimationFrame(frame)
        return
      }
      lastRenderMsRef.current += Math.max(1, Math.floor(sinceLastRenderMs / renderIntervalMs)) * renderIntervalMs

      // Materialise the visible window chronologically (oldest → newest)
      // via direct ring-buffer montage — avoids a full-window copy per channel.
      const outputHistoryN = filterActiveRef.current ? ring.historyLength : 0
      const outputLength = outputHistoryN + ring.visibleLength
      const readIdx = (ring.writeIdx + ring.length - outputLength) % ring.length
      const derived = materialiseMontage(ring.channels, montageIdRef.current, readIdx, outputLength, outputHistoryN)
      setSignalFrame({
        channels: derived,
        timeAxis: timeAxisRef.current,
        windowStart: cursorSecRef.current + sampleRemainderRef.current / SAMPLE_RATE - visibleSecs,
        sampleOffset: sampleRemainderRef.current,
      })
      publishEvents(visibleSecs)

      animFrameRef.current = requestAnimationFrame(frame)
    }

    animFrameRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isReady, materialiseMontage])

  return {
    channels: signalFrame.channels,
    timeAxis: signalFrame.timeAxis,
    isReady,
    events,
    windowStart: signalFrame.windowStart,
    sampleOffset: signalFrame.sampleOffset,
  }
}
