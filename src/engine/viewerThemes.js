/**
 * EEG Viewer Themes
 * ─────────────────
 * Colour schemes for the multi-channel trace renderer (EEGViewer).
 *
 * `clinical` and `paper` deliberately reproduce the look of real clinical
 * review software / paper chart recorders — dark ink traces on a light page
 * with a grey or red grid — which is what most EEG reviewers are trained on.
 * `midnight` keeps the platform's neon-on-navy aesthetic and stays default.
 *
 * Every field is consumed directly by EEGViewer; `glow` may be null to
 * disable the canvas shadow (light themes look wrong with a glow).
 */

export const VIEWER_THEMES = {
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    blurb: 'Neon trace on deep navy — the platform default.',
    pageBg: '#0A0E1A',
    plotBg: '#0D1424',
    labelBg: '#0A0E1A',
    gridMajor: 'rgba(0,212,255,0.12)',
    gridMinor: 'rgba(0,212,255,0.045)',
    axisText: '#5A6A82',
    signal: '#00FFB0',
    signalHover: '#00D4FF',
    glow: '#00FFB0',
    glowHover: '#00D4FF',
    glowBlur: 2,
    baseline: 'rgba(0,212,255,0.07)',
    baselineHover: 'rgba(0,212,255,0.2)',
    midline: 'rgba(0,212,255,0.06)',
    rowHover: 'rgba(0,212,255,0.05)',
    chanLabel: '#5A6A82',
    chanLabelHover: '#00D4FF',
    divider: 'rgba(0,212,255,0.12)',
    cursorLine: 'rgba(255,213,102,0.35)',
    cursorBox: 'rgba(255,213,102,0.6)',
    cursorText: '#0A0E1A',
    annotationText: '#0A0E1A',
    scan: '#00D4FF',
  },

  clinical: {
    id: 'clinical',
    label: 'Clinical',
    blurb: 'Dark ink on white with a faint grid — modern review software.',
    pageBg: '#FFFFFF',
    plotBg: '#FFFFFF',
    labelBg: '#EEF1F4',
    gridMajor: 'rgba(40,70,110,0.22)',
    gridMinor: 'rgba(40,70,110,0.08)',
    axisText: '#7B8794',
    signal: '#10243C',
    signalHover: '#0B5FAA',
    glow: null,
    glowHover: null,
    glowBlur: 0,
    baseline: 'rgba(20,35,55,0.10)',
    baselineHover: 'rgba(11,95,170,0.35)',
    midline: 'rgba(20,35,55,0.06)',
    rowHover: 'rgba(11,95,170,0.06)',
    chanLabel: '#3A4654',
    chanLabelHover: '#0B5FAA',
    divider: 'rgba(20,35,55,0.18)',
    cursorLine: 'rgba(11,95,170,0.45)',
    cursorBox: 'rgba(11,95,170,0.85)',
    cursorText: '#FFFFFF',
    annotationText: '#FFFFFF',
    scan: '#0B5FAA',
  },

  paper: {
    id: 'paper',
    label: 'Chart Paper',
    blurb: 'Blue-black ink on cream with a red grid — classic paper EEG.',
    pageBg: '#F5EFE2',
    plotBg: '#FBF6EA',
    labelBg: '#EDE4D0',
    gridMajor: 'rgba(196,72,60,0.42)',
    gridMinor: 'rgba(196,72,60,0.16)',
    axisText: '#9A7B52',
    signal: '#1B2A4A',
    signalHover: '#8A1F1A',
    glow: null,
    glowHover: null,
    glowBlur: 0,
    baseline: 'rgba(120,90,55,0.16)',
    baselineHover: 'rgba(138,31,26,0.30)',
    midline: 'rgba(120,90,55,0.10)',
    rowHover: 'rgba(196,72,60,0.07)',
    chanLabel: '#5C4A30',
    chanLabelHover: '#8A1F1A',
    divider: 'rgba(120,90,55,0.30)',
    cursorLine: 'rgba(138,31,26,0.45)',
    cursorBox: 'rgba(138,31,26,0.85)',
    cursorText: '#FBF6EA',
    annotationText: '#FBF6EA',
    scan: '#8A1F1A',
  },

  amber: {
    id: 'amber',
    label: 'Amber CRT',
    blurb: 'Amber phosphor on black — vintage monitor look.',
    pageBg: '#0B0A06',
    plotBg: '#12100A',
    labelBg: '#0B0A06',
    gridMajor: 'rgba(255,176,59,0.16)',
    gridMinor: 'rgba(255,176,59,0.06)',
    axisText: '#8A6A33',
    signal: '#FFB23B',
    signalHover: '#FFE08A',
    glow: '#FFB23B',
    glowHover: '#FFE08A',
    glowBlur: 2.5,
    baseline: 'rgba(255,176,59,0.09)',
    baselineHover: 'rgba(255,224,138,0.25)',
    midline: 'rgba(255,176,59,0.07)',
    rowHover: 'rgba(255,176,59,0.05)',
    chanLabel: '#8A6A33',
    chanLabelHover: '#FFE08A',
    divider: 'rgba(255,176,59,0.16)',
    cursorLine: 'rgba(255,224,138,0.4)',
    cursorBox: 'rgba(255,224,138,0.7)',
    cursorText: '#0B0A06',
    annotationText: '#0B0A06',
    scan: '#FFB23B',
  },
}

// Cool left / warm right hues remain recognizable, with ink-like colors on
// light pages and brighter accents on dark pages. Midline retains each theme's ink.
const HEMISPHERE_PALETTES = {
  midnight: {
    signalLeft: '#60A5FA',
    signalRight: '#FB7185',
    signalMidline: '#00FFB0',
    signalMixed: '#C4B5FD',
  },
  clinical: {
    signalLeft: '#1D4ED8',
    signalRight: '#B91C1C',
    signalMidline: '#10243C',
    signalMixed: '#6B21A8',
  },
  paper: {
    signalLeft: '#254B78',
    signalRight: '#9D342B',
    signalMidline: '#5C4A30',
    signalMixed: '#6B4F77',
  },
  amber: {
    signalLeft: '#8FC7D6',
    signalRight: '#F3A383',
    signalMidline: '#FFB23B',
    signalMixed: '#E7D7AF',
  },
}
for (const theme of Object.values(VIEWER_THEMES))
  Object.assign(theme, HEMISPHERE_PALETTES[theme.id])

export function getElectrodeSide(electrode) {
  const match = /^(?:Fp|AF|FC|FT|CP|TP|PO|F|C|T|P|O|A|M)(\d+|z)$/i.exec(String(electrode).trim())
  if (!match) return 'neutral'
  if (match[1].toLowerCase() === 'z') return 'midline'
  return Number(match[1]) % 2 ? 'left' : 'right'
}

export function getChannelSide(label) {
  let contacts = String(label ?? '')
    .split(/[\u2013\u2014\u2212-]/)
    .map((contact) => contact.trim())
  // Ear references do not turn a unilateral scalp channel into a cross-head pair.
  if (
    contacts.some(
      (contact) => !/^[AM][12]$/i.test(contact) && getElectrodeSide(contact) !== 'neutral',
    )
  ) {
    contacts = contacts.filter((contact) => !/^[AM][12]$/i.test(contact))
  }
  const sides = new Set(contacts.map(getElectrodeSide))
  if (sides.has('left') && sides.has('right')) return 'mixed'
  if (sides.has('left')) return 'left'
  if (sides.has('right')) return 'right'
  return sides.has('midline') ? 'midline' : 'neutral'
}

export function getChannelThemeColor(label, theme) {
  const side = getChannelSide(label)
  return (
    theme[
      { left: 'signalLeft', right: 'signalRight', midline: 'signalMidline', mixed: 'signalMixed' }[
        side
      ]
    ] ?? theme.signal
  )
}

export const VIEWER_THEME_LIST = Object.values(VIEWER_THEMES)
export const DEFAULT_VIEWER_THEME = 'midnight'

/**
 * Standard clinical EEG display sensitivities (µV/mm). On a real EEG review
 * screen a *lower* µV/mm value means more amplification — a larger on-screen
 * deflection. 7 µV/mm is the conventional default for routine adult EEG.
 */
export const SENSITIVITY_STEPS = [2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100, 150, 200, 300]
export const DEFAULT_SENSITIVITY = 7

export function getViewerTheme(id) {
  return VIEWER_THEMES[id] ?? VIEWER_THEMES[DEFAULT_VIEWER_THEME]
}
