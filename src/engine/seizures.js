import { leftHemisphereGradient } from './electrodes.js'

const TAU = 2 * Math.PI
// Symmetric frontal maximum with a spatial gradient. Equal frontal/central
// weights would cancel the evolving seizure entirely in F3-C3 and F4-C4.
const GENERALIZED_SEIZURE_FIELD = {
  Fp1: 0.65,
  Fp2: 0.65,
  F3: 1,
  F4: 1,
  F7: 0.9,
  F8: 0.9,
  Fz: 1.05,
  C3: 0.55,
  C4: 0.55,
  Cz: 0.6,
  T7: 0.42,
  T8: 0.42,
  P3: 0.32,
  P4: 0.32,
  Pz: 0.35,
  P7: 0.28,
  P8: 0.28,
  O1: 0.18,
  O2: 0.18,
  A1: 0.02,
  A2: 0.02,
}
const generalizedSeizureField = (label) => GENERALIZED_SEIZURE_FIELD[label] ?? 0
const inactive = () => ({ overlay: 0, preserve: 1 })
export const SEIZURE_DURATIONS = { focal: 24, generalized: 18 }
export const DEFAULT_SEIZURE_DURATION = 30
export function normalizeSeizureDuration(kind, value) {
  const duration = Number(value)
  const minimum = 10
  return Number.isFinite(duration) && duration >= minimum && duration <= 120
    ? duration
    : SEIZURE_DURATIONS[kind]
}
export const FOCAL_ONSET_OPTIONS = ['left', 'right'].flatMap((side) =>
  ['frontal', 'central', 'temporal', 'parietal', 'occipital'].map((region) => ({
    value: `${side}_${region}`,
    label: `${side[0].toUpperCase()}${side.slice(1)} ${region}`,
  })),
)
export const FOCAL_SPREAD_OPTIONS = [
  { value: 'none', label: 'Remain focal' },
  { value: 'ipsilateral', label: 'Within the same hemisphere' },
  { value: 'contralateral', label: 'To the opposite matching region' },
  { value: 'bilateral', label: 'Across both hemispheres' },
]
export const DEFAULT_FOCAL_SEIZURE_OPTIONS = {
  onset: 'left_temporal',
  spread: 'ipsilateral',
  spreadDelay: 4,
  spreadDuration: 8,
}
export function normalizeFocalOptions(options = {}) {
  options = options ?? {}
  return {
    onset: FOCAL_ONSET_OPTIONS.some((item) => item.value === options.onset)
      ? options.onset
      : DEFAULT_FOCAL_SEIZURE_OPTIONS.onset,
    spread: FOCAL_SPREAD_OPTIONS.some((item) => item.value === options.spread)
      ? options.spread
      : DEFAULT_FOCAL_SEIZURE_OPTIONS.spread,
    spreadDelay: [2, 4, 6].includes(Number(options.spreadDelay)) ? Number(options.spreadDelay) : 4,
    spreadDuration: [4, 8, 12].includes(Number(options.spreadDuration))
      ? Number(options.spreadDuration)
      : 8,
  }
}
// Keep the entire selected spread inside the event, with time for its offset.
export function fitFocalOptionsToDuration(options, duration) {
  const next = normalizeFocalOptions(options)
  if (next.spread === 'none') return next
  next.spreadDelay =
    [2, 4, 6].filter((value) => value <= next.spreadDelay && value + 6 <= duration).at(-1) ?? 2
  next.spreadDuration =
    [4, 8, 12]
      .filter((value) => value <= next.spreadDuration && value + next.spreadDelay + 2 <= duration)
      .at(-1) ?? 4
  return next
}
const REGION_ROUTES = {
  temporal: ['frontal', 'central', 'parietal', 'occipital'],
  frontal: ['central', 'temporal', 'parietal', 'occipital'],
  central: ['frontal', 'parietal', 'temporal', 'occipital'],
  parietal: ['occipital', 'central', 'temporal', 'frontal'],
  occipital: ['parietal', 'temporal', 'central', 'frontal'],
}
const LEFT_FIELDS = {
  frontal: { Fp1: 0.65, F3: 1, F7: 0.75, Fz: 0.3, C3: 0.3, T7: 0.15 },
  central: { C3: 1, Cz: 0.3, F3: 0.4, P3: 0.4, T7: 0.2 },
  temporal: { F7: 0.8, T7: 1, P7: 0.55, Fp1: 0.2, F3: 0.25, C3: 0.2, P3: 0.15 },
  parietal: { P3: 1, P7: 0.6, Pz: 0.3, C3: 0.3, O1: 0.35 },
  occipital: { O1: 1, P3: 0.45, P7: 0.3, Pz: 0.2 },
}
const RIGHT_TO_LEFT = {
  Fp2: 'Fp1',
  F4: 'F3',
  F8: 'F7',
  C4: 'C3',
  T8: 'T7',
  P4: 'P3',
  P8: 'P7',
  O2: 'O1',
  Fz: 'Fz',
  Cz: 'Cz',
  Pz: 'Pz',
}
function regionWeight(id, label) {
  const [side, region] = id.split('_')
  return LEFT_FIELDS[region][side === 'left' ? label : RIGHT_TO_LEFT[label]] ?? 0
}
export function getFocalSpreadRoute(settings) {
  const { onset, spread } = normalizeFocalOptions(settings)
  const [side, region] = onset.split('_')
  const opposite = side === 'left' ? 'right' : 'left'
  const local = REGION_ROUTES[region].map((item) => `${side}_${item}`)
  if (spread === 'none') return [onset]
  if (spread === 'contralateral') return [onset, `${opposite}_${region}`]
  if (spread === 'ipsilateral') return [onset, ...local]
  return [
    onset,
    ...local,
    `${opposite}_${region}`,
    ...REGION_ROUTES[region].map((item) => `${opposite}_${item}`),
  ]
}
export function describeFocalPlan(settings) {
  const options = normalizeFocalOptions(settings)
  return `${FOCAL_ONSET_OPTIONS.find((item) => item.value === options.onset).label}; ${FOCAL_SPREAD_OPTIONS.find((item) => item.value === options.spread).label.toLowerCase()}`
}

// Hold each rate for several cycles, then transition without resetting phase.
// The changes are deliberately easy to follow on a teaching trace.
const FREQUENCY_STAGES = {
  focal: [
    [0, 9],
    [5, 9],
    [6, 6],
    [11, 6],
    [12, 3],
    [24, 3],
  ],
  generalized: [
    [0, 6],
    [4, 6],
    [5, 4],
    [9, 4],
    [10, 2.5],
    [18, 2.5],
  ],
}
function integratedCycles(kind, time) {
  const knots = FREQUENCY_STAGES[kind]
  let cycles = 0
  for (let i = 1; i < knots.length; i++) {
    const [start, initialHz] = knots[i - 1]
    const [end, finalHz] = knots[i]
    const dt = Math.max(0, Math.min(time, end) - start)
    cycles += initialHz * dt + ((0.5 * (finalHz - initialHz)) / (end - start)) * dt * dt
    if (time <= end) break
  }
  return cycles
}

function spikeWave(cycles) {
  const x = ((cycles % 1) + 1) % 1
  const spike = -135 * Math.exp(-(((x - 0.12) / 0.045) ** 2))
  const slow = x >= 0.24 && x <= 0.94 ? 82 * Math.sin((Math.PI * (x - 0.24)) / 0.7) : 0
  return spike + slow
}

export class OneShotSeizureOverlay {
  constructor(kind, startTime, rng, settings = {}) {
    this.kind = kind
    this.startTime = startTime
    this.duration = normalizeSeizureDuration(kind, settings?.duration)
    this.timeScale = this.duration / SEIZURE_DURATIONS[kind]
    this.endTime = startTime + this.duration
    this.phase = rng() * TAU
    this.isManualSeizure = true
    this.focalOptions = kind === 'focal' ? fitFocalOptionsToDuration(settings, this.duration) : null
    this.route = kind === 'focal' ? getFocalSpreadRoute(this.focalOptions) : []
    this.nextMarker = 0
    this.markers =
      kind === 'focal'
        ? [
            { at: 6, label: 'Evolution: 6 Hz sharp rhythm' },
            { at: 12, label: 'Evolution: 3 Hz sharp and slow activity' },
          ]
        : [
            { at: 5, label: 'Evolution: 4 Hz spike-wave' },
            { at: 10, label: 'Evolution: 2.5 Hz spike-wave' },
          ]
    this.markers = this.markers.map((marker) => ({ ...marker, at: marker.at * this.timeScale }))
    if (kind === 'focal' && this.route.length > 1) {
      this.markers.push({ at: this.focalOptions.spreadDelay, label: 'Spatial spread begins' })
      this.markers.sort((a, b) => a.at - b.at)
    }
  }
  advance(t, emit) {
    while (
      this.nextMarker < this.markers.length &&
      t >= this.startTime + this.markers[this.nextMarker].at
    ) {
      const marker = this.markers[this.nextMarker++]
      emit?.({
        t: this.startTime + marker.at,
        type: 'seizure_evolution',
        label: marker.label,
        detail:
          this.kind === 'focal'
            ? describeFocalPlan(this.focalOptions)
            : 'Generalized evolving seizure example',
      })
    }
  }
  isFinished(t) {
    return t >= this.endTime
  }
  focalWeight(label, elapsed) {
    let weight = regionWeight(this.route[0], label)
    for (let i = 1; i < this.route.length; i++) {
      const arrival =
        this.focalOptions.spreadDelay +
        ((i - 1) / Math.max(1, this.route.length - 2)) * this.focalOptions.spreadDuration
      const ramp =
        this.route.length === 2
          ? this.focalOptions.spreadDuration
          : Math.min(2, this.focalOptions.spreadDuration / (this.route.length - 1))
      const recruited = Math.max(0, Math.min(1, (elapsed - arrival) / ramp))
      weight = Math.max(weight, regionWeight(this.route[i], label) * recruited * 0.9)
    }
    return weight
  }
  valueFor(label, t) {
    const elapsed = t - this.startTime
    if (elapsed < 0 || elapsed >= this.duration) return inactive()
    const evolutionTime = elapsed / this.timeScale
    const cycles = integratedCycles(this.kind, evolutionTime) * this.timeScale
    const phase = this.phase + TAU * cycles
    const progress = elapsed / this.duration
    const envelope = Math.max(0, Math.min(1, elapsed / 0.25, (this.duration - elapsed) / 0.4))
    if (this.kind === 'focal') {
      const w = this.focalWeight(label, elapsed)
      const sharpness = 0.08 + 0.65 * Math.min(1, evolutionTime / 12)
      const contour =
        Math.sin(phase) +
        sharpness * Math.sin(2 * phase + 0.3) +
        sharpness * 0.3 * Math.sin(3 * phase)
      return {
        overlay: (75 + 60 * progress) * w * envelope * contour,
        preserve: 1 - 0.8 * w * envelope,
      }
    }
    const w = generalizedSeizureField(label)
    const morphology = Math.min(1, evolutionTime / 10)
    const rhythmic = -105 * (Math.sin(phase) + 0.15 * Math.sin(2 * phase))
    const evolvingWave =
      (1 - morphology) * rhythmic + morphology * spikeWave(cycles + this.phase / TAU)
    return {
      overlay: w * envelope * (0.95 + 0.5 * progress) * evolvingWave,
      preserve: 1 - 0.85 * w * envelope,
    }
  }
}

// An excerpt of a modeled episode that is already ongoing. There is no
// repeating short seizure / recovery cycle hidden behind the status label.
export class FocalStatusOverlay {
  constructor(rng) {
    this.phase = rng() * TAU
    this.emitted = false
  }
  advance(t, emit) {
    if (!this.emitted) {
      emit?.({
        t,
        type: 'focal_status',
        label: 'Focal status (ongoing)',
        detail:
          'Excerpt of sustained modeled ictal activity; status requires duration and clinical context',
      })
      this.emitted = true
    }
  }
  valueFor(label, t) {
    const w = leftHemisphereGradient(label)
    // Analytic integral keeps phase continuous while frequency varies slowly.
    const phase = this.phase + TAU * 4.5 * t + 54 * Math.sin((TAU * t) / 45)
    const contour = Math.sin(phase) + 0.45 * Math.sin(2 * phase + 0.3)
    return { overlay: 100 * w * contour, preserve: 1 - 0.8 * w }
  }
}

export class GeneralizedStatusOverlay {
  constructor() {
    this.emitted = false
  }
  advance(t, emit) {
    if (!this.emitted) {
      emit?.({
        t,
        type: 'generalized_status',
        label: 'Generalized status (ongoing)',
        detail: 'Sustained generalized spike-wave example; clinical manifestations are not modeled',
      })
      this.emitted = true
    }
  }
  valueFor(label, t) {
    const w = generalizedSeizureField(label)
    return { overlay: w * spikeWave(3.1 * t), preserve: 1 - 0.8 * w }
  }
}
