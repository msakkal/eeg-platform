import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { SAMPLE_RATE, makeTimeAxis } from '@/engine/signalGenerator'
import { createEEGProcessor } from '@/engine/eegProcessor'
import { getEEGFrame, cacheEEGFrame } from '@/engine/eegFrameCache'
import { eegProfilingEnabled, recordEEGMetric, setEEGBackend } from '@/engine/eegPerformance'

const EMPTY_FRAME = {
  channels: [],
  timeAxis: [],
  windowStart: 0,
  sampleOffset: 0,
  events: [],
  activeSeizure: null,
  isReady: false,
  isUpdating: true,
}

/** One recording, one processor, one atomic sample/timestamp snapshot. Only the
 * display clock and painting stay on the main thread when workers are available.
 */
export function useEEGSignal({
  montageId,
  pattern,
  noiseLevel,
  filterConfig = null,
  activationProcedure = 'none',
  isPlaying,
  eyesClosed = true,
  blinksEnabled = true,
  blinkRate = 18,
  windowSecs = 10,
  maxWindowSecs = 60,
  seed,
}) {
  const cacheKey = JSON.stringify([
    pattern,
    montageId,
    noiseLevel,
    activationProcedure,
    eyesClosed,
    blinksEnabled,
    blinkRate,
    windowSecs,
    maxWindowSecs,
    filterConfig?.hp ?? null,
    filterConfig?.lp ?? null,
    filterConfig?.notch ?? null,
    seed,
  ])
  const cacheKeyRef = useRef(cacheKey)
  cacheKeyRef.current = cacheKey
  const [snapshot, setSnapshot] = useState(() => {
    const cached = getEEGFrame(cacheKey)
    return cached ? { ...cached, isUpdating: true } : EMPTY_FRAME
  })
  const [error, setError] = useState(null)
  const processorRef = useRef(null)
  const queueRef = useRef(null)
  const pumpRef = useRef(null)
  const timeAxisRef = useRef([])
  const snapshotRef = useRef(snapshot)
  const pendingSeizureRef = useRef(false)
  snapshotRef.current = snapshot

  // Display and live physiology controls share the running session. Only a
  // different pattern, capacity, or explicit seed starts a new recording.
  // Depend on values so unchanged controls do not enqueue more worker work.
  const hp = filterConfig?.hp ?? null
  const lp = filterConfig?.lp ?? null
  const notch = filterConfig?.notch ?? null
  const display = useMemo(
    () => ({
      montageId,
      windowSecs,
      filterConfig: { hp, lp, notch },
      eyesClosed,
      blinksEnabled,
      blinkRate,
      noiseLevel,
      activationProcedure,
    }),
    [montageId, windowSecs, hp, lp, notch, eyesClosed, blinksEnabled, blinkRate,
      noiseLevel, activationProcedure],
  )
  const displayRef = useRef(display)
  displayRef.current = display

  useEffect(() => {
    let alive = true
    setError(null)
    const cached = getEEGFrame(cacheKeyRef.current)
    const retained = cached ?? snapshotRef.current
    const pending = { ...retained, isUpdating: true }
    snapshotRef.current = pending
    setSnapshot(pending)
    pendingSeizureRef.current = false
    const queue = {
      revision: 0,
      nextId: 0,
      inFlight: null,
      initialized: false,
      config: null,
      commands: [],
      elapsed: 0,
      tickDue: false,
      display: displayRef.current,
      frameKey: cacheKeyRef.current,
    }
    queueRef.current = queue

    function send(type, args) {
      const request = { id: ++queue.nextId, revision: queue.revision, type, args }
      queue.inFlight = {
        ...request,
        frameKey: queue.frameKey,
        sentAt: eegProfilingEnabled ? performance.now() : 0,
      }
      processorRef.current.post(request)
    }

    function pump() {
      if (!alive || !queue.initialized || queue.inFlight) return
      if (queue.config) {
        const config = queue.config
        queue.config = null
        send('configure', config)
      } else if (queue.commands.length) {
        const command = queue.commands.shift()
        send(command.type, command.args)
      } else if (queue.tickDue && queue.elapsed > 0) {
        queue.tickDue = false
        const elapsedSec = queue.elapsed
        queue.elapsed = 0
        send('tick', { elapsedSec })
      }
    }
    pumpRef.current = pump

    const processor = createEEGProcessor(
      (response) => {
        if (!alive || response.id !== queue.inFlight?.id) return
        const request = queue.inFlight
        if (!response.partial) queue.inFlight = null
        if (response.error) {
          setError(new Error(response.error))
          return
        }
        if (request.type === 'init' && !response.partial) queue.initialized = true
        if (request.type === 'startSeizure' && response.frame.accepted === false)
          pendingSeizureRef.current = false
        recordEEGMetric('signalWorkMs', response.processingMs)
        if (eegProfilingEnabled) recordEEGMetric('requestMs', performance.now() - request.sentAt)
        setEEGBackend(processor.backend)
        // Configuration changes invalidate earlier work. Neither the grid nor the
        // curves may be published from a superseded display configuration.
        if (response.revision === queue.revision && !(response.partial && cached)) {
          const frame = response.frame
          if (request.type === 'startSeizure' || frame.activeSeizure)
            pendingSeizureRef.current = false
          if (timeAxisRef.current.length !== frame.visibleSamples)
            timeAxisRef.current = makeTimeAxis(frame.visibleSamples, SAMPLE_RATE)
          const previous = snapshotRef.current
          const eventKey = (events) =>
            events.map((event) => `${event.id}:${event.durationS}`).join('|')
          const events =
            eventKey(previous.events) === eventKey(frame.events) ? previous.events : frame.events
          const activeSeizure =
            JSON.stringify(previous.activeSeizure) === JSON.stringify(frame.activeSeizure)
              ? previous.activeSeizure
              : frame.activeSeizure
          const next = {
            ...frame,
            timeAxis: timeAxisRef.current,
            events,
            activeSeizure,
            isReady: true,
            isUpdating: Boolean(response.partial),
          }
          snapshotRef.current = next
          setSnapshot(next)
          if (!response.partial) cacheEEGFrame(request.frameKey, next)
        }
        if (!response.partial) pump()
      },
      (failure) => {
        if (!alive) return
        queue.elapsed = 0
        queue.inFlight = null
        setError(failure)
      },
      !(
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('eegWorker') === '0'
      ),
    )
    processorRef.current = processor
    // A fixed seed is optional for repeatable A/B profiling. Ordinary sessions
    // retain their previous randomized behavior.
    const profilingSeed = eegProfilingEnabled
      ? new URLSearchParams(window.location.search).get('eegSeed')
      : null
    send('init', {
      pattern,
      maxWindowSecs,
      ...displayRef.current,
      seed: seed ?? (profilingSeed !== null ? Number(profilingSeed) : Date.now()),
    })
    return () => {
      alive = false
      processor.dispose()
      if (processorRef.current === processor) processorRef.current = null
      if (queueRef.current === queue) queueRef.current = null
    }
  }, [pattern, maxWindowSecs, seed])

  useEffect(() => {
    const queue = queueRef.current
    if (!queue || queue.display === display) return
    queue.display = display
    queue.frameKey = cacheKeyRef.current
    queue.revision++
    queue.config = display
    pumpRef.current?.()
  }, [display])

  useEffect(() => {
    if (!snapshot.isReady || snapshot.isUpdating || !isPlaying || error) return
    let frameId
    let lastFrame = 0
    let lastPublish = 0
    function frame(now) {
      const queue = queueRef.current
      if (!queue?.initialized) return
      const elapsed = lastFrame > 0 ? Math.min((now - lastFrame) / 1000, 0.1) : 1 / 60
      if (lastFrame > 0) recordEEGMetric('rafIntervalMs', now - lastFrame)
      lastFrame = now
      queue.elapsed += elapsed
      const interval = 1000 / (displayRef.current.windowSecs <= 15 ? 120 : 60)
      const sincePublish = now - lastPublish
      if (sincePublish >= interval - 0.75) {
        lastPublish += Math.max(1, Math.floor(sincePublish / interval)) * interval
        queue.tickDue = true
        pumpRef.current?.()
      }
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [snapshot.isReady, snapshot.isUpdating, isPlaying, error])

  useEffect(() => {
    if (!isPlaying && queueRef.current?.elapsed > 0) {
      // Finish time already accrued before pausing; do not discard samples
      // just because the previous worker reply has not arrived yet.
      queueRef.current.tickDue = true
      pumpRef.current?.()
    }
  }, [isPlaying])

  const startSeizure = useCallback((kind, settings) => {
    const current = snapshotRef.current
    const queue = queueRef.current
    if (
      !current.isReady ||
      !current.canStartSeizure ||
      current.activeSeizure ||
      pendingSeizureRef.current ||
      !['focal', 'generalized'].includes(kind) ||
      !queue?.initialized
    )
      return false
    pendingSeizureRef.current = true
    const elapsedSec = queue.elapsed
    queue.elapsed = 0
    queue.tickDue = false
    queue.commands.push({ type: 'startSeizure', args: { kind, settings, elapsedSec } })
    pumpRef.current?.()
    return true
  }, [])

  const stopSeizure = useCallback(() => {
    const queue = queueRef.current
    if (!queue?.initialized) return
    const elapsedSec = queue.elapsed
    queue.elapsed = 0
    queue.tickDue = false
    queue.commands.push({ type: 'stopSeizure', args: { elapsedSec } })
    pumpRef.current?.()
  }, [])

  // Existing page boundaries provide a visible retry if an established worker
  // fails. Never silently rewind a live recording after a runtime failure.
  if (error) throw error
  return { ...snapshot, startSeizure, stopSeizure }
}
