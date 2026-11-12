import { FocalStatusOverlay, GeneralizedStatusOverlay } from './seizures.js'
import { frontocentralGradient, leftHemisphereGradient } from './electrodes.js'

// Shared by the live and buffered generators so a new selector entry never
// silently falls back to an ordinary awake trace in one of the viewers.
export const ADDITIONAL_PATTERN_CONFIG = {
  tirda: {
    mode: 'normal_drowsy',
    group: 'abnormal',
    label: 'TIRDA',
    color: '#FBBF24',
    overlay: 'TirdaOverlay',
  },
  oirda: {
    mode: 'normal_awake',
    group: 'abnormal',
    label: 'OIRDA',
    color: '#FCD34D',
    overlay: 'OirdaOverlay',
  },
  lrda: {
    mode: 'diffuse_slowing',
    group: 'periodic',
    label: 'LRDA',
    color: '#FB923C',
    overlay: 'LrdaOverlay',
  },
  bipds: {
    mode: 'diffuse_slowing',
    group: 'periodic',
    label: 'BIPDs',
    color: '#FDBA74',
    overlay: 'BipdsOverlay',
  },
  focal_status: {
    mode: 'diffuse_slowing',
    group: 'epileptiform',
    label: 'Status epilepticus (focal)',
    color: '#F43F5E',
    overlay: 'FocalStatusOverlay',
  },
  generalized_status: {
    mode: 'diffuse_slowing',
    group: 'epileptiform',
    label: 'Status epilepticus (generalized)',
    color: '#E11D48',
    overlay: 'GeneralizedStatusOverlay',
  },
  gpfa: {
    mode: 'normal_sleep',
    group: 'epileptiform',
    label: 'Generalized paroxysmal fast activity',
    color: '#FB7185',
    overlay: 'GpfaOverlay',
  },
  extreme_delta_brush: {
    mode: 'diffuse_slowing',
    group: 'periodic',
    label: 'Extreme delta brush',
    color: '#F59E0B',
    overlay: 'ExtremeDeltaBrushOverlay',
  },
  suppressed_background: {
    mode: 'diffuse_slowing',
    group: 'coma',
    label: 'Suppressed background',
    color: '#94A3B8',
    overlay: 'SuppressedBackgroundOverlay',
  },
}

const TAU = 2 * Math.PI
const temporal = (label) =>
  ({ F7: 1, T7: 0.95, P7: 0.55, Fp1: 0.3, F3: 0.35, C3: 0.25, P3: 0.15 })[label] ?? 0
const occipital = (label) =>
  ({ O1: 1, O2: 0.94, P7: 0.4, P8: 0.38, P3: 0.3, P4: 0.28, Pz: 0.25 })[label] ?? 0
const mirror = (label) =>
  ({ Fp2: 'Fp1', F4: 'F3', F8: 'F7', C4: 'C3', T8: 'T7', P4: 'P3', P8: 'P7', O2: 'O1' })[label]
const rightHemisphere = (label) => (mirror(label) ? leftHemisphereGradient(mirror(label)) : 0)
const edge = (elapsed, duration, ramp = 0.25) =>
  Math.max(0, Math.min(1, elapsed / ramp, (duration - elapsed) / ramp))

// Absolute-time schedules preserve phase and event timing across window boundaries.
class RhythmicDeltaOverlay {
  constructor(rng, { id, field, hz, amplitude, duration, period }) {
    Object.assign(this, { id, field, hz, amplitude, duration, period })
    this.phase = rng() * TAU
    this.nextEvent = 0.8
  }
  advance(t, emit) {
    while (t >= this.nextEvent) {
      emit?.({
        t: this.nextEvent,
        type: this.id,
        label: this.id.toUpperCase(),
        durationS: this.duration,
        detail: 'Non-evolving rhythmic delta run',
      })
      this.nextEvent += this.period
    }
  }
  valueFor(label, t) {
    if (t < 0.8) return { overlay: 0, preserve: 1 }
    const dt = (t - 0.8) % this.period
    if (dt >= this.duration) return { overlay: 0, preserve: 1 }
    const w = this.field(label)
    const phase = TAU * this.hz * dt + this.phase
    const gate = edge(dt, this.duration)
    return {
      overlay: this.amplitude * w * gate * (Math.sin(phase) + 0.16 * Math.sin(2 * phase + 0.4)),
      preserve: 1 - 0.45 * w * gate,
    }
  }
}
export class TirdaOverlay extends RhythmicDeltaOverlay {
  constructor(rng) {
    super(rng, { id: 'tirda', field: temporal, hz: 2, amplitude: 65, duration: 4.5, period: 10 })
  }
}
export class OirdaOverlay extends RhythmicDeltaOverlay {
  constructor(rng) {
    super(rng, { id: 'oirda', field: occipital, hz: 3, amplitude: 85, duration: 4, period: 9 })
  }
}
export class LrdaOverlay extends RhythmicDeltaOverlay {
  constructor(rng) {
    super(rng, {
      id: 'lrda',
      field: leftHemisphereGradient,
      hz: 1.5,
      amplitude: 82,
      duration: 14,
      period: 20,
    })
  }
}

export class BipdsOverlay {
  constructor(rng) {
    this.sides = [
      { next: 0.6, period: 1.05, side: 'left' },
      { next: 0.92, period: 1.47, side: 'right' },
    ]
    this.events = []
    this.rng = rng
  }
  advance(t, emit) {
    for (const side of this.sides) {
      while (t >= side.next) {
        this.events.push({ t: side.next, side: side.side })
        emit?.({
          t: side.next,
          type: 'bipd',
          label: `BIPD (${side.side})`,
          detail: 'Independent hemispheric periodic discharge',
        })
        side.next += side.period * (0.96 + this.rng() * 0.08)
      }
    }
    this.events = this.events.filter((event) => event.t > t - 0.6)
  }
  valueFor(label, t) {
    let overlay = 0
    for (const event of this.events) {
      const dt = t - event.t
      if (dt < 0 || dt > 0.45) continue
      const w = event.side === 'left' ? leftHemisphereGradient(label) : rightHemisphere(label)
      const sharp = -105 * Math.exp(-(((dt - 0.055) / 0.025) ** 2))
      const slow = dt > 0.12 && dt < 0.42 ? 56 * Math.sin((Math.PI * (dt - 0.12)) / 0.3) : 0
      overlay += w * (sharp + slow)
    }
    return { overlay, preserve: 1 }
  }
}

export class GpfaOverlay {
  constructor(rng) {
    this.phase = rng() * TAU
    this.nextEvent = 0.8
  }
  advance(t, emit) {
    while (t >= this.nextEvent) {
      emit?.({
        t: this.nextEvent,
        type: 'gpfa',
        label: 'GPFA burst',
        durationS: 3,
        detail: 'Generalized frontocentral fast activity during sleep',
      })
      this.nextEvent += 9
    }
  }
  valueFor(label, t) {
    if (t < 0.8) return { overlay: 0, preserve: 1 }
    const dt = (t - 0.8) % 9
    if (dt >= 3) return { overlay: 0, preserve: 1 }
    const w = frontocentralGradient(label)
    const gate = edge(dt, 3, 0.12)
    return {
      overlay:
        48 * w * gate * (Math.sin(TAU * 16 * dt + this.phase) + 0.3 * Math.sin(TAU * 22 * dt)),
      preserve: 1 - 0.55 * w * gate,
    }
  }
}

export class ExtremeDeltaBrushOverlay {
  constructor(rng) {
    this.phase = rng() * TAU
    this.emitted = false
  }
  advance(t, emit) {
    if (!this.emitted) {
      emit?.({
        t,
        type: 'extreme_delta_brush',
        label: 'Extreme delta brush',
        detail: 'Delta activity with nested fast activity',
      })
      this.emitted = true
    }
  }
  valueFor(label, t) {
    const w = frontocentralGradient(label)
    const phase = TAU * 1.5 * t + this.phase
    const fastEnvelope = Math.pow(Math.max(0, Math.cos(phase)), 3)
    return {
      overlay: w * (90 * Math.sin(phase) + 28 * fastEnvelope * Math.sin(TAU * 24 * t)),
      preserve: 0.35,
    }
  }
}

export class SuppressedBackgroundOverlay {
  constructor(rng) {
    this.phase = rng() * TAU
  }
  advance() {}
  valueFor(label, t) {
    const offset = [...label].reduce((sum, character) => sum + character.charCodeAt(0), 0) * 0.1
    return {
      overlay:
        1.4 * Math.sin(TAU * 3.2 * t + offset + this.phase) + 0.7 * Math.sin(TAU * 17 * t + offset),
      preserve: 0,
    }
  }
}

const OVERLAYS = {
  TirdaOverlay,
  OirdaOverlay,
  LrdaOverlay,
  BipdsOverlay,
  FocalStatusOverlay,
  GeneralizedStatusOverlay,
  GpfaOverlay,
  ExtremeDeltaBrushOverlay,
  SuppressedBackgroundOverlay,
}
export function createAdditionalOverlay(pattern, rng) {
  const config = Object.hasOwn(ADDITIONAL_PATTERN_CONFIG, pattern)
    ? ADDITIONAL_PATTERN_CONFIG[pattern]
    : null
  return config ? new OVERLAYS[config.overlay](rng) : null
}
