/**
 * Shared electrode definitions, region classification, and field gradients.
 * Single source of truth — consumed by both signalGenerator.js and streaming.js.
 */

// ─── 10-20 Electrode Labels ────────────────────────────────────────────────
export const ELECTRODES_1020 = [
  'Fp1', 'Fp2',
  'F7', 'F3', 'Fz', 'F4', 'F8',
  'T7', 'C3', 'Cz', 'C4', 'T8',
  'P7', 'P3', 'Pz', 'P4', 'P8',
  'O1', 'O2',
  'A1', 'A2',
]

// ─── Region Classification ─────────────────────────────────────────────────
export function regionOf(label) {
  if (label === 'A1' || label === 'A2') return 'ear'
  if (label.startsWith('Fp')) return 'frontopolar'
  if (label.startsWith('F')) return 'frontal'
  if (label === 'T7' || label === 'T8') return 'midtemporal'
  if (label === 'P7' || label === 'P8') return 'posttemporal'
  if (label.startsWith('C')) return 'central'
  if (label.startsWith('P')) return 'parietal'
  if (label.startsWith('O')) return 'occipital'
  return 'other'
}

// ─── Amplitude Gradients (per-electrode field weights) ──────────────────────

export function alphaGradient(label) {
  const map = {
    O1: 1.00, O2: 1.00,
    P3: 0.80, P4: 0.80, Pz: 0.75,
    P7: 0.70, P8: 0.70,
    C3: 0.35, C4: 0.35, Cz: 0.30,
    T7: 0.35, T8: 0.35,
    F3: 0.18, F4: 0.18, Fz: 0.18,
    F7: 0.20, F8: 0.20,
    Fp1: 0.12, Fp2: 0.12,
  }
  return map[label] ?? 0.05
}

export function muGradient(label) {
  const map = {
    C3: 1.00, C4: 1.00, Cz: 0.55,
    F3: 0.35, F4: 0.35,
    P3: 0.30, P4: 0.30,
  }
  return map[label] ?? 0
}

export function frontalBetaGradient(label) {
  const map = {
    F3: 1.00, F4: 1.00, Fz: 1.00,
    Fp1: 0.70, Fp2: 0.70,
    F7: 0.80, F8: 0.80,
    C3: 0.60, C4: 0.60, Cz: 0.60,
  }
  return map[label] ?? 0.30
}

export function blinkField(label) {
  const map = {
    Fp1: 1.00, Fp2: 1.00,
    F7: 0.55, F8: 0.55,
    F3: 0.45, F4: 0.45, Fz: 0.45,
    T7: 0.15, T8: 0.15,
    C3: 0.10, C4: 0.10, Cz: 0.10,
    P7: 0.05, P8: 0.05,
    P3: 0.03, P4: 0.03, Pz: 0.03,
    O1: 0.02, O2: 0.02,
    A1: 0.05, A2: 0.05,
  }
  return map[label] ?? 0.05
}

export function lateralEogField(label, direction = 1) {
  const map = {
    F7: -1.00, F8: 1.00,
    Fp1: -0.40, Fp2: 0.40,
    T7: -0.35, T8: 0.35,
    F3: -0.20, F4: 0.20,
  }
  return (map[label] ?? 0) * direction
}

export function cardiacAmpForRegion(label) {
  switch (regionOf(label)) {
    case 'ear': return 22
    case 'posttemporal': return 9
    case 'midtemporal': return 8
    case 'parietal': return 4.5
    case 'occipital': return 4.5
    case 'central': return 2
    case 'frontal': return 1.5
    case 'frontopolar': return 1
    default: return 1
  }
}

// ─── Pathology Field Gradients ──────────────────────────────────────────────

export function frontocentralGradient(label) {
  const map = {
    Fz: 1.00, Cz: 1.00,
    F3: 0.88, F4: 0.88, C3: 0.88, C4: 0.88,
    Fp1: 0.75, Fp2: 0.75,
    F7: 0.70, F8: 0.70,
    Pz: 0.60,
    P3: 0.55, P4: 0.55,
    T7: 0.45, T8: 0.45,
    P7: 0.35, P8: 0.35,
    O1: 0.30, O2: 0.30,
  }
  return map[label] ?? 0.05
}

export function bifrontalGradient(label) {
  const map = {
    Fz: 1.00,
    F3: 0.92, F4: 0.92,
    Fp1: 0.85, Fp2: 0.85,
    F7: 0.72, F8: 0.72,
    C3: 0.40, C4: 0.40, Cz: 0.40,
    T7: 0.25, T8: 0.25,
    P3: 0.18, P4: 0.18, Pz: 0.18,
    P7: 0.14, P8: 0.14,
    O1: 0.10, O2: 0.10,
  }
  return map[label] ?? 0.05
}

export function leftHemisphereGradient(label) {
  const map = {
    F7: 1.00,
    T7: 0.95, P7: 0.82,
    C3: 0.75, F3: 0.70, P3: 0.62,
    Fp1: 0.55, O1: 0.38,
    Fz: 0.22, Cz: 0.18, Pz: 0.15,
  }
  return map[label] ?? 0.04
}
