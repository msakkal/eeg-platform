import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import { getChannelThemeColor, getViewerTheme } from '@/engine/viewerThemes'
import { useMemo } from 'react'

/**
 * ScalpElectrodeMap
 * SVG schematic of the 10-20 system with interactive electrode highlighting.
 *
 * Props:
 *   highlightedElectrodes  string[]   electrode names to illuminate (e.g. ['Fp1','F7'])
 *   size                   number     SVG pixel size (default 160)
 *   className              string
 */

// Normalised positions: x = left(-1)..right(+1), y = front(+1)..back(-1)
const ELECTRODE_POSITIONS = {
  Fp1: [-0.27,  0.85],  Fp2: [ 0.27,  0.85],
  F7:  [-0.72,  0.51],  F3:  [-0.38,  0.51],
  Fz:  [ 0.00,  0.51],  F4:  [ 0.38,  0.51],  F8: [ 0.72,  0.51],
  T7:  [-0.87,  0.00],  C3:  [-0.45,  0.00],
  Cz:  [ 0.00,  0.00],
  C4:  [ 0.45,  0.00],  T8:  [ 0.87,  0.00],
  P7:  [-0.72, -0.51],  P3:  [-0.38, -0.51],
  Pz:  [ 0.00, -0.51],  P4:  [ 0.38, -0.51],  P8: [ 0.72, -0.51],
  O1:  [-0.27, -0.85],  O2:  [ 0.27, -0.85],
  // Ear references (shown outside the head ring)
  A1:  [-1.10,  0.00],  A2:  [ 1.10,  0.00],
}

/**
 * Given a channel label like "Fp1–F7" or "Fp1–avg" or "Fp1",
 * returns the electrode name(s) present in ELECTRODE_POSITIONS.
 */
export function parseElectrodes(label) {
  if (!label) return []
  const parts = label.split(/[–—-]/).map(s => s.trim())
  return parts.filter(p => p in ELECTRODE_POSITIONS)
}

export default function ScalpElectrodeMap({
  highlightedElectrodes = [],
  size = 160,
  className = '',
}) {
  useLocale()
  const S   = size
  const cx  = S / 2
  const cy  = S / 2
  const R   = S * 0.40   // scalp ring radius

  const highlighted = useMemo(() => new Set(highlightedElectrodes), [highlightedElectrodes])

  return (
    <svg dir="ltr"
      viewBox={`0 0 ${S} ${S}`}
      width={S}
      height={S}
      className={className}
      style={{ display: 'block' }}
      role="img"
      aria-label={localize("Top-down 10-20 scalp electrode map")}
    >
      <defs>
        {/* Glow filter for highlighted electrodes */}
        <filter id="elec-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Soft glow for the connection line */}
        <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Clip to head circle */}
        <clipPath id="head-clip">
          <circle cx={cx} cy={cy} r={R + 1} />
        </clipPath>
      </defs>

      {/* ── Background head ─────────────────────────────────────────── */}
      <circle
        cx={cx} cy={cy} r={R}
        fill="#0D1424"
        stroke="#1E2A40"
        strokeWidth="1.5"
      />

      {/* ── Nose ─────────────────────────────────────────────────────── */}
      <path
        d={`M ${cx - 6} ${cy - R + 2} Q ${cx} ${cy - R - 10} ${cx + 6} ${cy - R + 2}`}
        fill="none"
        stroke="#2A3A54"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* ── Ears ─────────────────────────────────────────────────────── */}
      {[[-1], [1]].map(([side]) => (
        <ellipse
          key={`ear-${side}`}
          cx={cx + side * (R + 5)}
          cy={cy + 4}
          rx={5}
          ry={7}
          fill="none"
          stroke="#2A3A54"
          strokeWidth="1.5"
        />
      ))}

      {/* ── Midline cross-hair guides (subtle) ───────────────────────── */}
      <line
        x1={cx} y1={cy - R + 2} x2={cx} y2={cy + R - 2}
        stroke="#1A2538" strokeWidth="0.5" strokeDasharray="2,3"
      />
      <line
        x1={cx - R + 2} y1={cy} x2={cx + R - 2} y2={cy}
        stroke="#1A2538" strokeWidth="0.5" strokeDasharray="2,3"
      />

      {/* ── Connection line between highlighted pair ─────────────────── */}
      {localize(highlightedElectrodes.length === 2 && (() => {
        const [e1, e2] = highlightedElectrodes
        const p1 = ELECTRODE_POSITIONS[e1]
        const p2 = ELECTRODE_POSITIONS[e2]
        if (!p1 || !p2) return null
        const x1 = cx + p1[0] * R
        const y1 = cy - p1[1] * R
        const x2 = cx + p2[0] * R
        const y2 = cy - p2[1] * R
        return (
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#00D4FF"
            strokeWidth="1.5"
            strokeDasharray="3,2"
            opacity="0.6"
            filter="url(#line-glow)"
          />
        )
      })())}

      {/* ── Electrodes ───────────────────────────────────────────────── */}
      {localize(Object.entries(ELECTRODE_POSITIONS).map(([name, [nx, ny]]) => {
        const px = cx + nx * R
        const py = cy - ny * R
        const isHigh = highlighted.has(name)
        const isEar  = name === 'A1' || name === 'A2'
        const sideColor = getChannelThemeColor(name, getViewerTheme('midnight'))

        return (
          <g key={name}>
            {/* Outer ring / pulse for highlighted */}
            {isHigh && (
              <circle
                cx={px} cy={py}
                r={isEar ? 7 : 6}
                fill="none"
                stroke="#00D4FF"
                strokeWidth="1"
                opacity="0.35"
              />
            )}

            {/* Main dot */}
            <circle
              cx={px} cy={py}
              r={isHigh ? (isEar ? 5 : 4.5) : (isEar ? 3.5 : 3)}
              fill={isHigh ? sideColor : `${sideColor}66`}
              stroke={isHigh ? '#FFD166' : sideColor}
              strokeWidth={isHigh ? 1.2 : 0.8}
              filter={isHigh ? 'url(#elec-glow)' : undefined}
            />

            {/* Label */}
            <text
              x={px}
              y={py - (isHigh ? 7 : 6)}
              textAnchor="middle"
              fontSize={isHigh ? 7 : 6}
              fontFamily='"DM Mono", monospace'
              fill={sideColor}
              fontWeight={isHigh ? 'bold' : 'normal'}
            >
              {localize(name)}
            </text>
          </g>
        )
      }))}

      {/* ── Idle hint ring (shows when nothing highlighted) ───────────── */}
      {highlightedElectrodes.length === 0 && (
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke="#1E2A40"
          strokeWidth="1"
          opacity="0.4"
        />
      )}
    </svg>
  )
}
