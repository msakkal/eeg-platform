import { useState, useEffect, useRef, useCallback } from 'react'
import { SAMPLE_RATE, makeTimeAxis } from '@/engine/signalGenerator'
import { createEngineForPattern }    from '@/engine/streaming'
import { applyMontage } from '@/engine/montages'

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
 *   - amplitude: number   - currently informational (engine self-calibrates)
 *   - noiseLevel: number  - currently informational
 *   - sweepSpeed: number  - samples advanced per ~33 ms frame (×30 ≈ samples/s)
 *   - isPlaying: bool
 *   - pendingSpike / pendingArtifact: optional injection flags
 *   - onClearPending: callback after handling a pending injection
 *   - eyesClosed, blinksEnabled, blinkRate: awake-state modifiers
 *   - windowSecs: how many seconds the on-screen window represents (default 10)
 */
export function useEEGSignal({
  montageId,
  pattern,
  // amplitude, noiseLevel are accepted for API stability but unused —
  // the streaming engine uses fixed clinically-calibrated amplitudes.
  amplitude,        // eslint-disable-line no-unused-vars
  noiseLevel,       // eslint-disable-line no-unused-vars
  sweepSpeed,
  isPlaying,
  pendingSpike,
  pendingArtifact,
  onClearPending,
  eyesClosed    = true,
  blinksEnabled = true,
  blinkRate     = 18, // eslint-disable-line no-unused-vars
  windowSecs    = 10,
}) {
  const [derivedChannels, setDerivedChannels] = useState([])
  const [timeAxis,        setTimeAxis]        = useState([])
  const [isReady,         setIsReady]         = useState(false)

  // Streaming engine + per-channel ring buffer holding the visible window
  const engineRef     = useRef(null)
  const ringRef       = useRef(null)
  const animFrameRef  = useRef(null)
  const cursorSecRef  = useRef(0)

  // ── Build / rebuild engine when pattern or eye-state changes ────────────
  useEffect(() => {
    setIsReady(false)
    const engine = createEngineForPattern(pattern, {
      eyesClosed,
      blinksEnabled,
    })
    engineRef.current = engine

    // Pre-fill the ring buffer with one full visible window so the user
    // sees a populated trace immediately on switching pattern.
    const N = Math.round(windowSecs * SAMPLE_RATE)
    const initial = engine.fillWindow(windowSecs)
    const labels = Object.keys(initial)
    const ring = {
      channels: {},
      writeIdx: 0,     // points at oldest sample (= where next write goes)
      length:   N,
      labels,
    }
    for (const label of labels) {
      ring.channels[label] = new Float32Array(N)
      ring.channels[label].set(initial[label])
    }
    ringRef.current = ring
    cursorSecRef.current = windowSecs
    setIsReady(true)
  }, [pattern, eyesClosed, blinksEnabled, windowSecs])

  // ── Pending transient injection (spike / muscle artifact) ───────────────
  // For the streaming engine these are stamped into the ring buffer at the
  // newest sample position. A more elegant approach would be a one-shot
  // overlay scheduled into the engine; that is a future refinement.
  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return
    if (!pendingSpike && !pendingArtifact) return

    if (pendingSpike) {
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
  }, [pendingSpike, pendingArtifact, onClearPending])

  // ── Animation loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return

    function frame() {
      if (!isPlaying) {
        animFrameRef.current = requestAnimationFrame(frame)
        return
      }

      const ring = ringRef.current
      const engine = engineRef.current
      if (!ring || !engine) {
        animFrameRef.current = requestAnimationFrame(frame)
        return
      }

      // Advance engine by `step` samples per frame (≈ 33 ms at 60fps).
      const step = Math.max(1, Math.round(sweepSpeed / 30))
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
      // for the montage transform.
      const windowRaw = {}
      const N = ring.length
      const start = ring.writeIdx
      for (const label of ring.labels) {
        const buf = ring.channels[label]
        const win = new Float32Array(N)
        for (let i = 0; i < N; i++) {
          win[i] = buf[(start + i) % N]
        }
        windowRaw[label] = win
      }

      const derived = applyMontage(windowRaw, montageId)
      setDerivedChannels(derived)
      setTimeAxis(makeTimeAxis(N, SAMPLE_RATE))

      animFrameRef.current = requestAnimationFrame(frame)
    }

    animFrameRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isReady, isPlaying, montageId, sweepSpeed])

  return {
    channels: derivedChannels,
    timeAxis,
    isReady,
    windowStart: cursorSecRef.current - windowSecs,
  }
}
