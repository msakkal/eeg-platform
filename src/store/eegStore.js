import { create } from 'zustand'
import { DEFAULT_MONTAGE } from '@/engine/montages'
import { DEFAULT_VIEWER_THEME, DEFAULT_SENSITIVITY } from '@/engine/viewerThemes'
import { isActivationProcedureAllowed } from '@/engine/patterns'

function resolveValue(valueOrUpdater, currentValue) {
  return typeof valueOrUpdater === 'function'
    ? valueOrUpdater(currentValue)
    : valueOrUpdater
}

export const useEEGStore = create((set, _get) => ({
  // ── EEG State ─────────────────────────────────────────────────────────────
  montageId:      DEFAULT_MONTAGE,
  pattern:        'normal_awake',
  amplitude:      50,
  sensitivity:    DEFAULT_SENSITIVITY,   // µV/mm — clinical display sensitivity
  noiseLevel:     0.25,
  sweepSpeed:     30,     // mm/s — standard EEG paper speed = real-time
  isPlaying:      true,
  pendingSpike:   false,
  pendingArtifact:false,
  activationProcedure: 'none',

  // ── Physiologic state (awake modifiers) ──────────────────────────────────
  eyesClosed:     true,     // Berger effect: alpha dominant when closed
  blinksEnabled:  true,
  blinkRate:      18,       // blinks per minute (normal 15–20)

  // ── Actions ───────────────────────────────────────────────────────────────
  setMontage:      (id)      => set({ montageId: id }),
  setPattern:      (p)       => set(s => ({
    pattern: p,
    activationProcedure: isActivationProcedureAllowed(s.activationProcedure, p) ? s.activationProcedure : 'none',
    ...(['mu_rhythm', 'central_midline_theta', 'lambda_waves', 'phantom_spike_wave', 'posterior_slow_waves_youth'].includes(p) ? { montageId: 'average_reference' } : {}),
    ...(p === 'positive_spikes_14_6' ? { montageId: 'referential_ears', eyesClosed: true } : {}),
    ...(p === 'lambda_waves' ? { eyesClosed: false } : {}),
    ...(['rmtd', 'wicket_rhythm'].includes(p) ? { montageId: 'longitudinal_bipolar', eyesClosed: true } : {}),
    ...(p === 'phantom_spike_wave' ? { eyesClosed: true } : {}),
    ...(p === 'posterior_slow_waves_youth' ? { eyesClosed: true } : {}),
    ...(p === 'normal_rem' ? { eyesClosed: true } : {}),
  })),
  setAmplitude:    (v)       => set(s => ({ amplitude: resolveValue(v, s.amplitude) })),
  setSensitivity:  (v)       => set(s => ({ sensitivity: resolveValue(v, s.sensitivity) })),
  setNoiseLevel:   (v)       => set(s => ({ noiseLevel: resolveValue(v, s.noiseLevel) })),
  setSweepSpeed:   (v)       => set(s => ({ sweepSpeed: resolveValue(v, s.sweepSpeed) })),
  togglePlay:      ()        => set(s => ({ isPlaying: !s.isPlaying })),
  triggerSpike:    ()        => set({ pendingSpike: true }),
  triggerArtifact: ()        => set({ pendingArtifact: true }),
  clearPending:    ()        => set({ pendingSpike: false, pendingArtifact: false }),
  setActivationProcedure: (procedure) => set(s => ({
    activationProcedure: isActivationProcedureAllowed(procedure, s.pattern) ? procedure : 'none',
  })),
  setEyesClosed:    (v)      => set(s => ({ eyesClosed: resolveValue(v, s.eyesClosed) })),
  toggleEyes:       ()       => set(s => ({ eyesClosed: !s.eyesClosed })),
  setBlinksEnabled: (v)      => set(s => ({ blinksEnabled: resolveValue(v, s.blinksEnabled) })),
  toggleBlinks:     ()       => set(s => ({ blinksEnabled: !s.blinksEnabled })),
  setBlinkRate:     (v)      => set(s => ({ blinkRate: resolveValue(v, s.blinkRate) })),

  // ── UI State ──────────────────────────────────────────────────────────────
  sidebarOpen: true,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

  // ── Viewer theme ──────────────────────────────────────────────────────────
  viewerTheme:    DEFAULT_VIEWER_THEME,
  setViewerTheme: (id) => set({ viewerTheme: id }),
}))
