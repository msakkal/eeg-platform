import { create } from 'zustand'
import { DEFAULT_MONTAGE } from '@/engine/montages'

function resolveValue(valueOrUpdater, currentValue) {
  return typeof valueOrUpdater === 'function'
    ? valueOrUpdater(currentValue)
    : valueOrUpdater
}

export const useEEGStore = create((set, get) => ({
  // ── EEG State ─────────────────────────────────────────────────────────────
  montageId:      DEFAULT_MONTAGE,
  pattern:        'normal_awake',
  amplitude:      50,
  noiseLevel:     0.25,
  sweepSpeed:     25,     // mm/s equivalent (affects how much data is shown)
  isPlaying:      true,
  pendingSpike:   false,
  pendingArtifact:false,

  // ── Physiologic state (awake modifiers) ──────────────────────────────────
  eyesClosed:     true,     // Berger effect: alpha dominant when closed
  blinksEnabled:  true,
  blinkRate:      18,       // blinks per minute (normal 15–20)

  // ── Actions ───────────────────────────────────────────────────────────────
  setMontage:      (id)      => set({ montageId: id }),
  setPattern:      (p)       => set({ pattern: p }),
  setAmplitude:    (v)       => set(s => ({ amplitude: resolveValue(v, s.amplitude) })),
  setNoiseLevel:   (v)       => set(s => ({ noiseLevel: resolveValue(v, s.noiseLevel) })),
  setSweepSpeed:   (v)       => set(s => ({ sweepSpeed: resolveValue(v, s.sweepSpeed) })),
  togglePlay:      ()        => set(s => ({ isPlaying: !s.isPlaying })),
  triggerSpike:    ()        => set({ pendingSpike: true }),
  triggerArtifact: ()        => set({ pendingArtifact: true }),
  clearPending:    ()        => set({ pendingSpike: false, pendingArtifact: false }),
  setEyesClosed:    (v)      => set(s => ({ eyesClosed: resolveValue(v, s.eyesClosed) })),
  toggleEyes:       ()       => set(s => ({ eyesClosed: !s.eyesClosed })),
  setBlinksEnabled: (v)      => set(s => ({ blinksEnabled: resolveValue(v, s.blinksEnabled) })),
  toggleBlinks:     ()       => set(s => ({ blinksEnabled: !s.blinksEnabled })),
  setBlinkRate:     (v)      => set(s => ({ blinkRate: resolveValue(v, s.blinkRate) })),

  // ── UI State ──────────────────────────────────────────────────────────────
  sidebarOpen: true,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
}))
