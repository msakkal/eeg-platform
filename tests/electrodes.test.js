import { describe, it, expect } from 'vitest'
import {
  ELECTRODES_1020,
  regionOf,
  alphaGradient,
  muGradient,
  frontalBetaGradient,
  blinkField,
  lateralEogField,
  cardiacAmpForRegion,
  frontocentralGradient,
  bifrontalGradient,
  leftHemisphereGradient,
} from '../src/engine/electrodes.js'

describe('ELECTRODES_1020', () => {
  it('contains 21 electrodes', () => {
    expect(ELECTRODES_1020).toHaveLength(21)
  })

  it('includes standard lead names', () => {
    expect(ELECTRODES_1020).toContain('Fz')
    expect(ELECTRODES_1020).toContain('Cz')
    expect(ELECTRODES_1020).toContain('Pz')
    expect(ELECTRODES_1020).toContain('O1')
    expect(ELECTRODES_1020).toContain('O2')
    expect(ELECTRODES_1020).toContain('A1')
    expect(ELECTRODES_1020).toContain('A2')
  })
})

describe('regionOf', () => {
  it('classifies frontopolar', () => {
    expect(regionOf('Fp1')).toBe('frontopolar')
    expect(regionOf('Fp2')).toBe('frontopolar')
  })

  it('classifies frontal', () => {
    expect(regionOf('F3')).toBe('frontal')
    expect(regionOf('Fz')).toBe('frontal')
    expect(regionOf('F7')).toBe('frontal')
  })

  it('classifies occipital', () => {
    expect(regionOf('O1')).toBe('occipital')
    expect(regionOf('O2')).toBe('occipital')
  })

  it('classifies ear references', () => {
    expect(regionOf('A1')).toBe('ear')
    expect(regionOf('A2')).toBe('ear')
  })

  it('returns other for unknown labels', () => {
    expect(regionOf('X1')).toBe('other')
  })
})

describe('gradient functions', () => {
  it('alphaGradient peaks at occipital leads', () => {
    expect(alphaGradient('O1')).toBe(1.0)
    expect(alphaGradient('O2')).toBe(1.0)
    expect(alphaGradient('Cz')).toBeLessThan(0.5)
  })

  it('muGradient peaks at central leads', () => {
    expect(muGradient('C3')).toBe(1.0)
    expect(muGradient('C4')).toBe(1.0)
    expect(muGradient('O1')).toBe(0)
    expect(muGradient('Fp1')).toBe(0)
  })

  it('frontalBetaGradient peaks frontally', () => {
    expect(frontalBetaGradient('F3')).toBe(1.0)
    expect(frontalBetaGradient('Fz')).toBe(1.0)
    expect(frontalBetaGradient('O1')).toBe(0.3)
  })

  it('blinkField peaks at frontopolar', () => {
    expect(blinkField('Fp1')).toBe(1.0)
    expect(blinkField('Fp2')).toBe(1.0)
    expect(blinkField('O2')).toBeLessThan(0.05)
  })

  it('lateralEogField returns anti-phase for F7/F8', () => {
    expect(lateralEogField('F7', 1)).toBe(-1.0)
    expect(lateralEogField('F8', 1)).toBe(1.0)
    expect(lateralEogField('F7', -1)).toBe(1.0)
  })

  it('cardiacAmpForRegion is strongest at ears', () => {
    expect(cardiacAmpForRegion('A1')).toBe(22)
    expect(cardiacAmpForRegion('Cz')).toBe(2)
  })

  it('pathology gradients return valid ranges', () => {
    expect(frontocentralGradient('Fz')).toBe(1.0)
    expect(bifrontalGradient('Fz')).toBe(1.0)
    expect(leftHemisphereGradient('F7')).toBe(1.0)
    expect(leftHemisphereGradient('F8')).toBeLessThan(0.05)
    expect(frontocentralGradient('A1')).toBe(0.05)
  })
})
