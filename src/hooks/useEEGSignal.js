import { useState, useEffect, useRef, useCallback } from 'react'
import { SAMPLE_RATE, makeTimeAxis } from '@/engine/signalGenerator'
import { createEngineForPattern }    from '@/engine/streaming'
import { applyMontage, MONTAGES } from '@/engine/montages'

const FILTER_PREROLL_SECONDS = 10
const DEFAULT_MAX_WINDOW_SECONDS = 60

/**
 * useEEGSignal
 * Drives a live streaming EEG display from `streaming.js`. Each animation
 * frame advances the engine clock by `stepSec` seconds, appends the new
 * samples to a per-channel ring buffer holding the visible window, applies
 * the active montage transform, and pushes the result to React state.
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
  isPlaying,
  pendingSpike,
  pendingArtifact,
  onClearPending,
  eyesClosed    = true,
  blinksEnabled = true,
  blinkRate     = 18, // eslint-disable-line no-unused-vars
  windowSecs    = 10,
  maxWindowSecs = DEFAULT_MAX_WINDOW_SECONDS,
}) {
  const [derivedChannels, setDerivedChannels] = useState([])
  const [timeAxis,        setTimeAxis]        = useState([])
  const [isReady,         setIsReady]         = useState(false)
  const [events,          setEvents]          = useState([])

  // Streaming engine + per-channel ring buffer holding the visible window
  const engineRef     = useRef(null)
  const ringRef       = useRef(null)
  const derivedBuffersRef = useRef(null)
  const animFrameRef  = useRef(null)
  const cursorSecRef  = useRef(0)
  const lastFrameMsRef = useRef(0)
  const sampleRemainderRef = useRef(0)

  // Refs for values that change during playback without restarting loop
  const montageIdRef   = useRef(montageId)
  const isPlayingRef   = useRef(isPlaying)
  montageIdRef.current  = montageId
  isPlayingRef.current  = isPlaying

  const publishEvents = useCallback((visibleSecs) => {
    const engine = engineRef.current
    if (!engine?.getEventsSince) return
    const start = Math.max(0, cursorSecRef.current - visibleSecs)
    setEvents(engine.getEventsSince(start))
  }, [])

  const materialiseMontage = useCallback((rawChannels, montageIdValue, readIdx, outputLength = null, visibleStartIndex = 0) => {
    const montage = MONTAGES[montageIdValue]
    if (!montage) return applyMontage(rawChannels, montageIdValue, readIdx)

    const firstLabel = Object.keys(rawChannels).filter(label => !['A1', 'A2'].includes(label))[0]
    const ringLength = rawChannels[firstLabel]?.length ?? 0
    const length = outputLength ?? ringLength
    const cacheKey = `${montageIdValue}:${length}:${visibleStartIndex}`
    let cache = derivedBuffersRef.current

    if (!cache || cache.key !== cacheKey) {
      cache = {
        key: cacheKey,
        channels: montage.channels.map(({ label }) => ({
          label,
          data: new Float32Array(length),
          visibleStartIndex,
        })),
        avgRef: new Float32Array(length),
        earRef: new Float32Array(length),
      }
      derivedBuffersRef.current = cache
    }

    const needsAverage = montage.channels.some(ch => ch.neg === 'average')
    const needsEars = montage.channels.some(ch => ch.neg === 'ears')

    if (needsAverage) {
      const labels = Object.keys(rawChannels).filter(label => !['A1', 'A2'].includes(label))
      for (let i = 0; i < length; i++) {
        const ringIdx = (readIdx + i) % ringLength
        let sum = 0
        for (let j = 0; j < labels.length; j++) {
          const buf = rawChannels[labels[j]]
          sum += buf[ringIdx]
        }
        cache.avgRef[i] = sum / labels.length
      }
    }

    if (needsEars) {
      const a1 = rawChannels.A1
      const a2 = rawChannels.A2
      for (let i = 0; i < length; i++) {
        const ringIdx = (readIdx + i) % ringLength
        cache.earRef[i] = ((a1?.[ringIdx] ?? 0) + (a2?.[ringIdx] ?? 0)) / 2
      }
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

      for (let i = 0; i < length; i++) {
        const ringIdx = (readIdx + i) % ringLength
        out[i] = posBuf[ringIdx] - (negBuf ? negBuf[neg === 'average' || neg === 'ears' ? i : ringIdx] : 0)
      }
    }

    return cache.channels.map(({ label, data, visibleStartIndex }) => ({ label, data, visibleStartIndex }))
  }, [])

    // ── Build / rebuild engine when pattern or eye-state changes ────────────
  useEffect(() => {
    setIsReady(false)
    const engine = createEngineForPattern(pattern, {
      eyesClosed,
      blinksEnabled,
      noiseLevel,
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

    // Publish the initial window immediately so the trace is visible the
    // instant the panel mounts — without waiting for the first animation
    // frame (and so a paused viewer still shows a populated trace).
    // Use writeIdx=0 since the buffer was just filled linearly.
    const outputLength = historyN + visibleN
    const readIdx = (ring.writeIdx + ring.length - outputLength) % ring.length
    setDerivedChannels(materialiseMontage(ring.channels, montageIdRef.current, readIdx, outputLength, historyN))
    setTimeAxis(makeTimeAxis(visibleN, SAMPLE_RATE))
    publishEvents(windowSecs)
    setIsReady(true)
  }, [pattern, eyesClosed, blinksEnabled, noiseLevel, maxWindowSecs, materialiseMontage, publishEvents])

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
    const outputLength = ring.historyLength + visibleN
    const readIdx = (ring.writeIdx + ring.length - outputLength) % ring.length
    setDerivedChannels(materialiseMontage(ring.channels, montageId, readIdx, outputLength, ring.historyLength))
    setTimeAxis(makeTimeAxis(visibleN, SAMPLE_RATE))
    publishEvents(visibleSecs)
  }, [montageId, windowSecs, isReady, materialiseMontage, publishEvents])

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
    publishEvents(windowSecs)
  }, [pendingSpike, pendingArtifact, onClearPending, publishEvents, windowSecs])

  // ── Animation loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return

    function frame(now = performance.now()) {
      if (!isPlayingRef.current) {
        lastFrameMsRef.current = now
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
      const incoming = engine.fillWindow(stepSec)
      cursorSecRef.current += stepSec

      // Append incoming samples into the ring buffer.
      for (const label of ring.labels) {
        const src = incoming[label]
        const buf = ring.channels[label]
        if (!src || !buf) continue
        for (let i = 0; i < src.length; i++) {
          buf[(ring.writeIdx + i) % ring.length] = src[i]
        }
      }
      ring.writeIdx = (ring.writeIdx + step) % ring.length

      // Materialise the visible window chronologically (oldest → newest)
      // via direct ring-buffer montage — avoids a full-window copy per channel.
      const outputLength = ring.historyLength + ring.visibleLength
      const readIdx = (ring.writeIdx + ring.length - outputLength) % ring.length
      const derived = materialiseMontage(ring.channels, montageIdRef.current, readIdx, outputLength, ring.historyLength)
      setDerivedChannels(derived)
      publishEvents(ring.visibleLength / SAMPLE_RATE)

      animFrameRef.current = requestAnimationFrame(frame)
    }

    animFrameRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isReady, materialiseMontage])

  return {
    channels: derivedChannels,
    timeAxis,
    isReady,
    events,
    windowStart: cursorSecRef.current - windowSecs,
  }
}
