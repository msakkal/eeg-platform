import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation }        from 'react-i18next'
import { MONTAGES, MONTAGE_LIST, applyMontage } from '@/engine/montages'
import { generateMultiChannelEEG, makeTimeAxis }  from '@/engine/signalGenerator'
import EEGViewer                 from '@/components/eeg/EEGViewer'
import EEGViewerControls, {
  buildViewerThemeOverrides,
  DEFAULT_VIEWER_STYLE,
} from '@/components/eeg/EEGViewerControls'
import CollapsibleChannelPanel from '@/components/eeg/CollapsibleChannelPanel'
import { getViewerTheme } from '@/engine/viewerThemes'

export default function MontagesPage() {
  const { t } = useTranslation()
  const [selectedId, setSelectedId]   = useState('longitudinal_bipolar')
  const [channels,   setChannels]     = useState([])
  const [timeAxis,   setTimeAxis]     = useState([])
  const [rawEEG,     setRawEEG]       = useState(null)
  const [hoveredChannel, setHoveredChannel] = useState(null)
  const [sensitivity, setSensitivity] = useState(5)
  const [filterConfig, setFilterConfig] = useState({ hp: 0.5, lp: 70, notch: 50 })
  const [viewerTheme, setViewerTheme] = useState('midnight')
  const [viewerStyle, setViewerStyle] = useState(DEFAULT_VIEWER_STYLE)
  const baseTheme = getViewerTheme(viewerTheme)
  const themeOverrides = useMemo(() => buildViewerThemeOverrides(viewerStyle), [viewerStyle])
  const effectiveTheme = useMemo(() => ({ ...baseTheme, ...themeOverrides }), [baseTheme, themeOverrides])

  // Generate raw data once
  useEffect(() => {
    const eeg = generateMultiChannelEEG({ duration: 10, pattern: 'normal_awake' })
    setRawEEG(eeg)
    setTimeAxis(makeTimeAxis(eeg.nSamples))
  }, [])

  // Recompute derived channels when montage or raw data changes
  useEffect(() => {
    if (!rawEEG) return
    const derived = applyMontage(rawEEG.channels, selectedId)
    setChannels(derived)
  }, [rawEEG, selectedId])

  const montage = MONTAGES[selectedId]

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Montage list ───────────────────────────────────────────── */}
      <nav className="w-52 flex-shrink-0 border-r border-eeg-border p-4">
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">
          {t('montages.select_montage')}
        </p>
        <div className="space-y-1">
          {MONTAGE_LIST.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all
                ${selectedId === m.id
                  ? 'bg-eeg-accent bg-opacity-10 text-eeg-accent border border-eeg-accent border-opacity-20'
                  : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                }`}
            >
              <span className="font-body block font-medium">{m.label}</span>
              <span className="font-mono opacity-60 text-xs">{m.channels.length} ch</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Right: Detail + preview ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Montage info header */}
        <div className="px-8 py-6 border-b border-eeg-border flex-shrink-0">
          <span className="label-tag mb-3 inline-block">{t('montages.title')}</span>
          <h1 className="section-title mb-2">{montage?.label}</h1>
          <p className="font-body text-sm text-eeg-muted leading-relaxed max-w-xl">
            {montage?.description}
          </p>
          <div className="mt-3 flex gap-4 text-xs font-mono text-eeg-muted">
            <span className="text-eeg-accent">{montage?.channels.length} channels</span>
            <span>{t('common.interactive')} preview</span>
          </div>
        </div>

        {/* Channel chain display */}
        <div className="px-8 py-4 border-b border-eeg-border bg-eeg-surface flex-shrink-0 overflow-x-auto">
          <div className="flex gap-2 flex-wrap">
            {montage?.channels.slice(0, 20).map((ch, i) => (
              <span key={i} className="text-xs font-mono px-2 py-1 bg-eeg-card border border-eeg-border
                                       rounded text-eeg-muted whitespace-nowrap">
                {ch.label}
              </span>
            ))}
            {montage?.channels.length > 20 && (
              <span className="text-xs font-mono px-2 py-1 text-eeg-muted">
                +{montage.channels.length - 20} more…
              </span>
            )}
          </div>
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
                curveWidth={viewerStyle.curveWidth}
                polarity={viewerStyle.polarity}
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
