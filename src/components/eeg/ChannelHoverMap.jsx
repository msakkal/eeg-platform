import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import { getChannelThemeColor, getViewerTheme } from '@/engine/viewerThemes'
import { useMemo } from 'react'
import { ELECTRODE_POSITIONS_2D, SELECTABLE_ELECTRODES } from '@/engine/propagation'

export function getChannelElectrodes(label, explicitElectrodes = null) {
  const source = Array.isArray(explicitElectrodes)
    ? explicitElectrodes
    : String(label ?? '').split(/[\u2013\u2014-]/)

  return source
    .map((part) => String(part).trim())
    .filter((elec) => Boolean(ELECTRODE_POSITIONS_2D[elec]))
}

export function ChannelHoverPanel({
  channelLabel,
  electrodes,
  sourceElec = null,
  isBipolar,
  polarity = 0,
  title = 'Hovered channel',
  activeText = 'This channel uses the highlighted scalp contact or pair.',
  idleText = 'Move over a channel to highlight its scalp contacts.',
  className = '',
}) {
  useLocale()
  const highlighted = useMemo(
    () => getChannelElectrodes(channelLabel, electrodes),
    [channelLabel, electrodes],
  )

  return (
    <div className={`bg-eeg-surface p-4 flex flex-col gap-2 items-center ${className}`}>
      <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted self-start mb-1">
        {localize(title)}
      </p>
      <ChannelHoverMap
        channelLabel={channelLabel}
        electrodes={highlighted}
        sourceElec={sourceElec}
        isBipolar={isBipolar}
        polarity={polarity}
      />
      <p className="text-[10px] font-mono text-eeg-muted text-center mt-2 leading-relaxed">
        {localize(channelLabel ? activeText : idleText)}
      </p>
    </div>
  )
}

export default function ChannelHoverMap({
  channelLabel,
  electrodes,
  sourceElec = null,
  isBipolar,
  polarity = 0,
  size = 168,
}) {
  useLocale()
  const highlighted = useMemo(
    () => getChannelElectrodes(channelLabel, electrodes),
    [channelLabel, electrodes],
  )

  const pos = highlighted[0] ?? null
  const neg = highlighted[1] ?? null
  const pairMode = typeof isBipolar === 'boolean' ? isBipolar : Boolean(pos && neg)

  const R = size * 0.38
  const CX = size / 2
  const CY = size / 2 + 4
  const svgHeight = size + 4
  const toSvg = (nx, ny) => ({ x: CX + nx * R, y: CY - ny * R })

  const posColor = pairMode
    ? polarity > 0
      ? '#FF6B35'
      : polarity < 0
        ? '#00D4FF'
        : '#FFD166'
    : '#FF6B35'
  const negColor = pairMode
    ? polarity > 0
      ? '#00D4FF'
      : polarity < 0
        ? '#FF6B35'
        : '#FFD166'
    : '#5A6A82'

  return (
    <svg dir="ltr"
      viewBox={`0 0 ${size} ${svgHeight}`}
      width={size}
      height={svgHeight}
      style={{ display: 'block' }}
      aria-label={localize(channelLabel ? `Electrodes for ${channelLabel}` : 'Hovered channel electrodes')}
      role="img"
    >
      <circle cx={CX} cy={CY} r={R} fill="#0D1424" stroke="#1E2A40" strokeWidth="1.2" />
      <path
        d={`M${CX - 6} ${CY - R + 4} Q${CX} ${CY - R - 9} ${CX + 6} ${CY - R + 4}`}
        fill="none"
        stroke="#2A3A54"
        strokeWidth="1.2"
      />
      <ellipse
        cx={CX - R - 4}
        cy={CY + 2}
        rx="3.5"
        ry="6"
        fill="none"
        stroke="#2A3A54"
        strokeWidth="1"
      />
      <ellipse
        cx={CX + R + 4}
        cy={CY + 2}
        rx="3.5"
        ry="6"
        fill="none"
        stroke="#2A3A54"
        strokeWidth="1"
      />
      <line
        x1={CX}
        y1={CY - R}
        x2={CX}
        y2={CY + R}
        stroke="#1E2A4055"
        strokeWidth="0.5"
        strokeDasharray="2,3"
      />
      <line
        x1={CX - R}
        y1={CY}
        x2={CX + R}
        y2={CY}
        stroke="#1E2A4055"
        strokeWidth="0.5"
        strokeDasharray="2,3"
      />

      {localize(pos &&
        neg &&
        pairMode &&
        (() => {
          const a = toSvg(ELECTRODE_POSITIONS_2D[pos].x, ELECTRODE_POSITIONS_2D[pos].y)
          const b = toSvg(ELECTRODE_POSITIONS_2D[neg].x, ELECTRODE_POSITIONS_2D[neg].y)
          return (
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#FFD16699"
              strokeWidth="1.5"
              strokeDasharray="3,3"
            />
          )
        })())}

      {localize(SELECTABLE_ELECTRODES.map((elec) => {
        const point = ELECTRODE_POSITIONS_2D[elec]
        const sv = toSvg(point.x, point.y)
        const isPos = elec === pos
        const isNeg = elec === neg
        const isSource = elec === sourceElec

        let r = 2.4
        const sideColor = getChannelThemeColor(elec, getViewerTheme('midnight'))
        let fill = `${sideColor}33`
        let stroke = `${sideColor}AA`
        let strokeWidth = 0.7
        let showLabel = false

        if (isSource && !isPos && !isNeg) {
          fill = '#FF333344'
          stroke = '#FF3333'
          r = 3.2
          strokeWidth = 1.2
        }

        if (isPos) {
          fill = `${posColor}AA`
          stroke = posColor
          r = 4.5
          strokeWidth = 1.6
          showLabel = true
        }

        if (isNeg) {
          fill = `${negColor}AA`
          stroke = negColor
          r = 4.5
          strokeWidth = 1.6
          showLabel = true
        }

        return (
          <g key={elec}>
            <circle
              cx={sv.x}
              cy={sv.y}
              r={r}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            {showLabel && (
              <text
                x={sv.x + (point.x < -0.6 ? -7 : point.x > 0.6 ? 7 : 0)}
                y={sv.y + (point.y > 0.6 ? -8 : point.y < -0.6 ? 12 : 4)}
                textAnchor={point.x < -0.6 ? 'end' : point.x > 0.6 ? 'start' : 'middle'}
                fontSize="7"
                fontFamily="DM Mono, monospace"
                fontWeight="bold"
                fill={isPos ? posColor : negColor}
              >
                {localize(elec)}
              </text>
            )}
          </g>
        )
      }))}

      <text
        x={CX}
        y={size}
        textAnchor="middle"
        fontSize="8.5"
        fontFamily="DM Mono, monospace"
        fill="#5A6A82"
        fontWeight="bold"
      >
        {localize(channelLabel ?? '-')}
      </text>
    </svg>
  )
}
