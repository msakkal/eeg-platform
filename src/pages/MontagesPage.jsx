import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import CollapsiblePanel from '@/components/ui/CollapsiblePanel'
import React, { useState, useMemo } from 'react'
import { useTranslation }        from 'react-i18next'
import { MONTAGES, MONTAGE_LIST } from '@/engine/montages'
import { useEEGSignal }           from '@/hooks/useEEGSignal'
import EEGViewer                 from '@/components/eeg/EEGViewer'
import EEGViewerControls, {
  buildViewerThemeOverrides,
  DEFAULT_VIEWER_STYLE,
} from '@/components/eeg/EEGViewerControls'
import CollapsibleChannelPanel from '@/components/eeg/CollapsibleChannelPanel'
import { getViewerTheme } from '@/engine/viewerThemes'
import { ELECTRODE_POSITIONS_2D } from '@/engine/propagation'

const MONTAGE_MAP_POSITIONS = {
  ...ELECTRODE_POSITIONS_2D,
  A1: { x: -1.12, y: 0 },
  A2: { x: 1.12, y: 0 },
}

const REFERENCE_POSITIONS = {
  average: { x: 0, y: 0 },
  ears: { x: 0, y: -1.12 },
}

function MontageChainMap({ montage }) {
  useLocale()
  const size = 380
  const cx = size / 2
  const cy = size / 2 + 8
  const r = size * 0.36
  const toSvg = (point) => ({ x: cx + point.x * r, y: cy - point.y * r })

  const channels = montage?.channels ?? []
  const usedElectrodes = new Set()
  const hasAverageRef = channels.some((ch) => ch.neg === 'average')
  const hasEarRef = channels.some((ch) => ch.neg === 'ears')
  const channelArrows = channels
    .map((ch, i) => {
      const pos = MONTAGE_MAP_POSITIONS[ch.pos]
      const neg = MONTAGE_MAP_POSITIONS[ch.neg] ?? REFERENCE_POSITIONS[ch.neg]
      if (!pos || !neg) return null

      const a = toSvg(pos)
      const b = toSvg(neg)
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const nodePad = 6
      const start = {
        x: a.x + ux * nodePad,
        y: a.y + uy * nodePad,
      }
      const end = {
        x: b.x - ux * nodePad,
        y: b.y - uy * nodePad,
      }
      const mid = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      }

      return {
        ...ch,
        index: i,
        isReference: ch.neg === 'average' || ch.neg === 'ears',
        path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
        mid,
      }
    })
    .filter(Boolean)

  channels.forEach((ch) => {
    if (MONTAGE_MAP_POSITIONS[ch.pos]) usedElectrodes.add(ch.pos)
    if (MONTAGE_MAP_POSITIONS[ch.neg]) usedElectrodes.add(ch.neg)
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)] items-center">
      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${size} ${size + 20}`}
          width={size}
          height={size + 20}
          role="img"
          aria-label={localize(`${montage?.label ?? 'Montage'} chain map`)}
          className="max-w-full"
        >
          <defs>
            <filter id="montage-chain-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker
              id="montage-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#00D4FF" />
            </marker>
            <marker
              id="montage-reference-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#5A6A82" />
            </marker>
          </defs>

          <circle cx={cx} cy={cy} r={r} fill="#0D1424" stroke="#1E2A40" strokeWidth="1.5" />
          <path
            d={`M ${cx - 9} ${cy - r + 4} Q ${cx} ${cy - r - 14} ${cx + 9} ${cy - r + 4}`}
            fill="none"
            stroke="#2A3A54"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <ellipse cx={cx - r - 9} cy={cy + 3} rx="5" ry="9" fill="none" stroke="#2A3A54" strokeWidth="1.2" />
          <ellipse cx={cx + r + 9} cy={cy + 3} rx="5" ry="9" fill="none" stroke="#2A3A54" strokeWidth="1.2" />
          <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#1E2A4055" strokeWidth="0.7" strokeDasharray="2,4" />
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#1E2A4055" strokeWidth="0.7" strokeDasharray="2,4" />

          {localize(channelArrows.map((ch) => {
            return (
              <g key={`${ch.label}-${ch.index}`}>
                <path
                  d={ch.path}
                  fill="none"
                  stroke={ch.isReference ? '#5A6A82' : '#00D4FF'}
                  strokeWidth={ch.isReference ? 0.9 : 1.6}
                  strokeOpacity={ch.isReference ? 0.38 : 0.78}
                  strokeDasharray={ch.isReference ? '3,4' : undefined}
                  markerEnd={ch.isReference ? 'url(#montage-reference-arrow)' : 'url(#montage-arrow)'}
                  filter={ch.isReference ? undefined : 'url(#montage-chain-glow)'}
                />
                <circle
                  cx={ch.mid.x}
                  cy={ch.mid.y}
                  r="5"
                  fill="#0D1424DD"
                  stroke={ch.isReference ? '#5A6A82' : '#00D4FF'}
                  strokeWidth="0.7"
                />
                <text
                  x={ch.mid.x}
                  y={ch.mid.y + 2.5}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="6"
                  fill={ch.isReference ? '#94A3B8' : '#B8F7FF'}
                >
                  {localize(ch.index + 1)}
                </text>
              </g>
            )
          }))}

          {localize(hasAverageRef && (() => {
            const p = toSvg(REFERENCE_POSITIONS.average)
            return (
              <g>
                <circle cx={p.x} cy={p.y} r="7" fill="#FFD16622" stroke="#FFD166" strokeWidth="1.2" />
                <text x={p.x} y={p.y + 3} textAnchor="middle" className="font-mono" fontSize="7" fill="#FFD166">{localize("avg")}</text>
              </g>
            )
          })())}

          {localize(hasEarRef && (() => {
            const p = toSvg(REFERENCE_POSITIONS.ears)
            return (
              <g>
                <circle cx={p.x} cy={p.y} r="7" fill="#FFD16622" stroke="#FFD166" strokeWidth="1.2" />
                <text x={p.x} y={p.y + 3} textAnchor="middle" className="font-mono" fontSize="7" fill="#FFD166">A</text>
              </g>
            )
          })())}

          {localize(Object.entries(MONTAGE_MAP_POSITIONS).map(([name, point]) => {
            const p = toSvg(point)
            const active = usedElectrodes.has(name)
            const isEar = name === 'A1' || name === 'A2'
            return (
              <g key={name}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? 4.5 : 2.7}
                  fill={active ? '#00D4FF' : '#0D1424'}
                  stroke={active ? '#00FFB0' : '#2A3A5488'}
                  strokeWidth={active ? 1.3 : 0.8}
                />
                {(active || isEar) && (
                  <text
                    x={p.x}
                    y={p.y - 7}
                    textAnchor="middle"
                    className="font-mono"
                    fontSize="7"
                    fill={active ? '#B8F7FF' : '#5A6A82'}
                  >
                    {localize(name)}
                  </text>
                )}
              </g>
            )
          }))}
        </svg>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">{localize("Montage chain")}</p>
        <div className="flex gap-2 flex-wrap">
          {channels.slice(0, 24).map((ch, i) => (
            <span
              key={`${ch.label}-${i}`}
              className="text-xs font-mono px-2 py-1 bg-eeg-card border border-eeg-border rounded text-eeg-muted whitespace-nowrap"
            >
              {localize(ch.label)}
            </span>
          ))}
          {channels.length > 24 && (
            <span className="text-xs font-mono px-2 py-1 text-eeg-muted">
              +{localize(channels.length - 24)}{localize(" more...")}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MontagesPage() {
  useLocale()
  const { t } = useTranslation()
  const [selectedId, setSelectedId]   = useState('longitudinal_bipolar')
  const [hoveredChannel, setHoveredChannel] = useState(null)
  const [sensitivity, setSensitivity] = useState(5)
  const [filterConfig, setFilterConfig] = useState({ hp: 0.5, lp: 70, notch: 50 })
  const [viewerTheme, setViewerTheme] = useState('midnight')
  const [viewerStyle, setViewerStyle] = useState(DEFAULT_VIEWER_STYLE)
  const baseTheme = getViewerTheme(viewerTheme)
  const themeOverrides = useMemo(
    () => viewerTheme === 'custom' ? buildViewerThemeOverrides(viewerStyle) : {},
    [viewerStyle, viewerTheme]
  )
  const effectiveTheme = useMemo(() => ({ ...baseTheme, ...themeOverrides }), [baseTheme, themeOverrides])
  const chainGap = selectedId.includes('bipolar') ? 18 : 0

  const { channels, timeAxis } = useEEGSignal({
    montageId: selectedId,
    pattern: 'normal_awake',
    noiseLevel: 0.15,
    filterConfig,
    isPlaying: false,
    eyesClosed: true,
    blinksEnabled: true,
    windowSecs: 10,
    maxWindowSecs: 10,
  })

  const montage = MONTAGES[selectedId]

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Montage list ───────────────────────────────────────────── */}
      <CollapsiblePanel title="Montages" widthClass="w-52"><nav className="p-4">
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">
          {t('montages.select_montage')}
        </p>
        <div className="space-y-1">
          {MONTAGE_LIST.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full text-start px-3 py-2.5 rounded-lg text-xs transition-all
                ${selectedId === m.id
                  ? 'bg-eeg-accent bg-opacity-10 text-eeg-accent border border-eeg-accent border-opacity-20'
                  : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                }`}
            >
              <span className="font-body block font-medium">{localize(m.label)}</span>
              <span className="font-mono opacity-60 text-xs">{localize(m.channels.length)}{localize(" ch")}</span>
            </button>
          ))}
        </div>
      </nav></CollapsiblePanel>

      {/* ── Right: Detail + preview ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Montage info header */}
        <div className="px-8 py-6 border-b border-eeg-border flex-shrink-0">
          <span className="label-tag mb-3 inline-block">{t('montages.title')}</span>
          <h1 className="section-title mb-2">{localize(montage?.label)}</h1>
          <p className="font-body text-sm text-eeg-muted leading-relaxed max-w-xl">
            {localize(montage?.description)}
          </p>
          <div className="mt-3 flex gap-4 text-xs font-mono text-eeg-muted">
            <span className="text-eeg-accent">{localize(montage?.channels.length)}{localize(" channels")}</span>
            <span>{t('common.interactive')}{localize(" preview")}</span>
          </div>
        </div>

        {/* Montage chain map */}
        <div className="px-8 py-5 border-b border-eeg-border bg-eeg-surface flex-shrink-0 overflow-x-auto">
          <MontageChainMap montage={montage} />
        </div>

        {/* EEG preview */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className="flex-1 min-w-0 overflow-y-auto" style={{ background: effectiveTheme.pageBg }}>
            <EEGViewerControls
              montageId={selectedId}
              onMontageChange={setSelectedId}
              sensitivity={sensitivity}
              onSensitivityChange={setSensitivity}
              filterConfig={filterConfig}
              onFilterChange={setFilterConfig}
              viewerTheme={viewerTheme}
              onViewerThemeChange={setViewerTheme}
              baseTheme={baseTheme}
              viewerStyle={viewerStyle}
              onViewerStyleChange={setViewerStyle}
            />
            {channels.length > 0 ? (
              <EEGViewer
                channels={channels}
                timeAxis={timeAxis}
                sensitivity={sensitivity}
                isPlaying={false}
                filterConfig={filterConfig}
                theme={viewerTheme}
                themeOverrides={themeOverrides}
                curveWidth={viewerTheme === 'custom' ? viewerStyle.curveWidth : DEFAULT_VIEWER_STYLE.curveWidth}
                polarity={viewerTheme === 'custom' ? viewerStyle.polarity : DEFAULT_VIEWER_STYLE.polarity}
                chainGap={chainGap}
                onHoverChannel={setHoveredChannel}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-eeg-muted font-mono text-sm">
                {t('common.loading')}
              </div>
            )}
          </div>
          <CollapsibleChannelPanel
            channelLabel={hoveredChannel}
          />
        </div>

      </div>
    </div>
  )
}
