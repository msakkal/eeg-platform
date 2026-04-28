import { useState, useEffect, useRef, useCallback } from 'react'
import {
  generateMultiChannelEEG,
  injectSpike,
  injectMuscleArtifact,
  makeTimeAxis,
  SAMPLE_RATE,
} from '@/engine/signalGenerator'
import { applyMontage } from '@/engine/montages'

/**
 * useEEGSignal
 * Streams a sliding window of EEG data at the given sweep speed.
 * Regenerates data when pattern/montage/settings change.
 *
 * @returns { channels, timeAxis, isReady }
 */
export function useEEGSignal({
  montageId,
  pattern,
  amplitude,
  noiseLevel,
  sweepSpeed,   // samples per frame advancement (controls visual speed)
  isPlaying,
  pendingSpike,
  pendingArtifact,
  onClearPending,
  eyesClosed    = true,
  blinksEnabled = true,
  blinkRate     = 18,
  windowSecs    = 10,
}) {
  const [derivedChannels, setDerivedChannels] = useState([])
  const [timeAxis,        setTimeAxis]        = useState([])
  const [isReady,         setIsReady]         = useState(false)

  // Ring-buffer refs (don't need to trigger renders)
  const rawRef      = useRef(null)
  const cursorRef   = useRef(0)
  const animFrameRef = useRef(null)
  const windowRef   = useRef(windowSecs * SAMPLE_RATE)

  // ── Generate / Regenerate raw data ───────────────────────────────────────
  useEffect(() => {
    setIsReady(false)
    const eeg = generateMultiChannelEEG({
      duration:   60,          // generate 60s buffer, loop it
      sampleRate: SAMPLE_RATE,
      pattern,
      noiseLevel,
      amplitude,
      eyesClosed,
      blinksEnabled,
      blinkRate,
    })
    rawRef.current  = eeg
    cursorRef.current = 0
    setIsReady(true)
  }, [pattern, noiseLevel, amplitude, eyesClosed, blinksEnabled, blinkRate])

  // ── Inject pending transients ─────────────────────────────────────────────
  useEffect(() => {
    if (!rawRef.current) return
    const { channels } = rawRef.current
    const pos = (cursorRef.current + Math.round(0.5 * SAMPLE_RATE)) % rawRef.current.nSamples

    if (pendingSpike) {
      Object.values(channels).forEach(ch => injectSpike(ch, pos, { amplitude: 200 }))
      onClearPending?.()
    }
    if (pendingArtifact) {
      // Only frontal channels for muscle artifact
      ;['Fp1','Fp2','F3','F4','F7','F8'].forEach(label => {
        if (channels[label]) injectMuscleArtifact(channels[label], pos, { duration: 0.5 })
      })
      onClearPending?.()
    }
  }, [pendingSpike, pendingArtifact])

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !rawRef.current) return

    const windowN  = windowRef.current
    const step     = Math.max(1, Math.round(sweepSpeed / 30))  // samples advanced per ~33ms frame

    function frame() {
      if (!isPlaying) { animFrameRef.current = requestAnimationFrame(frame); return }

      const { channels, nSamples } = rawRef.current
      const cursor = cursorRef.current

      // Extract window from ring buffer
      const windowRaw = {}
      const labels    = Object.keys(channels)
      labels.forEach(label => {
        const ch  = channels[label]
        const win = new Float32Array(windowN)
        for (let i = 0; i < windowN; i++) {
          win[i] = ch[(cursor + i) % nSamples]
        }
        windowRaw[label] = win
      })

      // Apply montage transform
      const derived = applyMontage(windowRaw, montageId)
      setDerivedChannels(derived)
      setTimeAxis(makeTimeAxis(windowN, SAMPLE_RATE))

      // Advance cursor
      cursorRef.current = (cursor + step) % nSamples

      animFrameRef.current = requestAnimationFrame(frame)
    }

    animFrameRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isReady, isPlaying, montageId, sweepSpeed])

  return { channels: derivedChannels, timeAxis, isReady, windowStart: cursorRef.current / SAMPLE_RATE }
}
