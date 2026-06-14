import { useEffect, useMemo, useState } from 'react'
import { MONTAGE_LIST } from '@/engine/montages'
import { FILTER_PRESETS } from '@/engine/filters'
import { SENSITIVITY_STEPS, VIEWER_THEME_LIST } from '@/engine/viewerThemes'

export const DEFAULT_VIEWER_STYLE = {
  signalColor: '',
  plotBg: '',
  pageBg: '',
  gridColor: '',
  curveWidth: 1.1,
  polarity: 'negative-up',
}

export function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean.length === 3
    ? clean.split('').map(ch => ch + ch).join('')
    : clean, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export function rgbaToHex(color) {
  const match = color?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return color?.startsWith('#') ? color : null
  return `#${match.slice(1, 4).map(value =>
    Number(value).toString(16).padStart(2, '0')
  ).join('')}`
}

export function buildViewerThemeOverrides(viewerStyle) {
  const overrides = {}
  if (viewerStyle.signalColor) {
    overrides.signal = viewerStyle.signalColor
    overrides.signalHover = viewerStyle.signalColor
    overrides.glow = viewerStyle.signalColor
    overrides.glowHover = viewerStyle.signalColor
  }
  if (viewerStyle.plotBg) overrides.plotBg = viewerStyle.plotBg
  if (viewerStyle.pageBg) {
    overrides.pageBg = viewerStyle.pageBg
    overrides.labelBg = viewerStyle.pageBg
  }
  if (viewerStyle.gridColor) {
    overrides.gridMajor = hexToRgba(viewerStyle.gridColor, 0.32)
    overrides.gridMinor = hexToRgba(viewerStyle.gridColor, 0.11)
    overrides.baseline = hexToRgba(viewerStyle.gridColor, 0.12)
    overrides.midline = hexToRgba(viewerStyle.gridColor, 0.09)
    overrides.divider = hexToRgba(viewerStyle.gridColor, 0.24)
  }
  return overrides
}

export default function EEGViewerControls({
  montageId,
  onMontageChange,
  sensitivity,
  onSensitivityChange,
  noiseLevel,
  onNoiseLevelChange,
  sweepSpeed,
  onSweepSpeedChange,
  eyesClosed,
  onEyesClosedChange,
  filterConfig,
  onFilterChange,
  viewerTheme,
  onViewerThemeChange,
  baseTheme,
  viewerStyle,
  onViewerStyleChange,
  blinksEnabled,
  onBlinksEnabledChange,
  blinkRate,
  onBlinkRateChange,
}) {
  const matchedFilter = useMemo(() => (
    Object.entries(FILTER_PRESETS).find(([, preset]) =>
      preset.hp === filterConfig?.hp &&
      preset.lp === filterConfig?.lp &&
      preset.notch === filterConfig?.notch
    )?.[0] ?? 'custom'
  ), [filterConfig])
  const [selectedFilterId, setSelectedFilterId] = useState(matchedFilter)
  const activeFilter = selectedFilterId === 'custom' ? 'custom' : matchedFilter
  const isCustomTheme = viewerTheme === 'custom'

  useEffect(() => {
    if (selectedFilterId !== 'custom') setSelectedFilterId(matchedFilter)
  }, [matchedFilter, selectedFilterId])

  const setStyle = (key, value) => {
    onViewerStyleChange(current => ({ ...current, [key]: value }))
  }

  return (
    <div className="relative z-10 border-b border-eeg-border bg-eeg-surface">
      <div className="px-3 py-2 flex flex-wrap items-end gap-2">
        {montageId && onMontageChange && (
          <ToolbarSelect label="Montage" value={montageId} onChange={onMontageChange} className="w-36">
            {MONTAGE_LIST.map(m => <option key={m.id} value={m.id}>{m.shortLabel}</option>)}
          </ToolbarSelect>
        )}
        {sensitivity && onSensitivityChange && (
          <ToolbarSelect label="Sensitivity" value={sensitivity} onChange={value => onSensitivityChange(Number(value))} className="w-28">
            {SENSITIVITY_STEPS.map(step => <option key={step} value={step}>{step} uV/mm</option>)}
          </ToolbarSelect>
        )}
        {noiseLevel != null && onNoiseLevelChange && (
          <ToolbarRange label="Noise" value={Math.round(noiseLevel * 100)} min={0} max={100} step={5} unit="%" onChange={value => onNoiseLevelChange(value / 100)} />
        )}
        {sweepSpeed != null && onSweepSpeedChange && (
          <ToolbarRange label="Sweep" value={sweepSpeed} min={5} max={90} step={5} unit=" mm/s" onChange={onSweepSpeedChange} />
        )}
        {eyesClosed != null && onEyesClosedChange && (
          <ToolbarToggle
            label="Eyes"
            value={eyesClosed}
            offLabel="Open"
            onLabel="Closed"
            onChange={onEyesClosedChange}
          />
        )}
        {blinksEnabled != null && onBlinksEnabledChange && (
          <ToolbarToggle
            label="Blinks"
            value={blinksEnabled}
            offLabel="Off"
            onLabel="On"
            onChange={onBlinksEnabledChange}
          />
        )}
        {blinkRate != null && onBlinkRateChange && (
          <ToolbarRange
            label="Blink rate"
            value={blinkRate}
            min={0}
            max={40}
            step={1}
            unit="/min"
            onChange={onBlinkRateChange}
            disabled={blinksEnabled === false}
          />
        )}
        {filterConfig && onFilterChange && (
          <>
            <ToolbarSelect
              label="Filter"
              value={activeFilter}
              onChange={id => {
                setSelectedFilterId(id)
                if (id === 'custom') return
                const preset = FILTER_PRESETS[id]
                onFilterChange({ hp: preset.hp, lp: preset.lp, notch: preset.notch })
              }}
              className="w-44"
            >
              {Object.entries(FILTER_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
              <option value="custom">Custom</option>
            </ToolbarSelect>
            {activeFilter === 'custom' && (
              <div className="grid grid-cols-3 gap-1">
                <ToolbarNumber label="HP" value={filterConfig.hp} onChange={value => onFilterChange({ ...filterConfig, hp: value })} />
                <ToolbarNumber label="LP" value={filterConfig.lp} onChange={value => onFilterChange({ ...filterConfig, lp: value })} />
                <ToolbarNumber label="Notch" value={filterConfig.notch} onChange={value => onFilterChange({ ...filterConfig, notch: value })} />
              </div>
            )}
          </>
        )}
        {viewerTheme && onViewerThemeChange && (
          <ToolbarSelect label="Theme" value={viewerTheme} onChange={onViewerThemeChange} className="w-32">
            {VIEWER_THEME_LIST.map(th => <option key={th.id} value={th.id}>{th.label}</option>)}
            <option value="custom">Custom</option>
          </ToolbarSelect>
        )}
        {isCustomTheme && viewerStyle && onViewerStyleChange && (
          <ToolbarToggle
            label="Polarity"
            value={(viewerStyle.polarity ?? 'negative-up') === 'negative-up'}
            offLabel="+Up"
            onLabel="-Up"
            onChange={value => setStyle('polarity', value ? 'negative-up' : 'positive-up')}
          />
        )}
      </div>

      {isCustomTheme && viewerStyle && (
        <div className="px-3 pb-3 flex flex-wrap items-end gap-3 border-t border-eeg-border bg-eeg-bg bg-opacity-35">
          <ToolbarColor label="Curve" value={viewerStyle.signalColor || baseTheme.signal} onChange={value => setStyle('signalColor', value)} />
          <ToolbarColor label="Plot" value={viewerStyle.plotBg || baseTheme.plotBg} onChange={value => setStyle('plotBg', value)} />
          <ToolbarColor label="Frame" value={viewerStyle.pageBg || baseTheme.pageBg} onChange={value => setStyle('pageBg', value)} />
          <ToolbarColor label="Grid" value={viewerStyle.gridColor || rgbaToHex(baseTheme.gridMajor) || baseTheme.signal} onChange={value => setStyle('gridColor', value)} />
          <ToolbarRange label="Curve width" value={viewerStyle.curveWidth} min={0.7} max={2.4} step={0.05} unit=" px" onChange={value => setStyle('curveWidth', value)} wide />
          <button
            type="button"
            onClick={() => onViewerStyleChange(DEFAULT_VIEWER_STYLE)}
            className="h-8 px-3 rounded border border-eeg-border text-xs font-mono text-eeg-muted hover:text-eeg-text transition-colors"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  )
}

function ToolbarToggle({ label, value, offLabel, onLabel, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-eeg-muted">{label}</span>
      <div className="h-8 grid grid-cols-2 rounded border border-eeg-border bg-eeg-card overflow-hidden text-xs font-mono">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-2 transition-colors ${!value ? 'bg-eeg-accent text-eeg-bg' : 'text-eeg-muted hover:text-eeg-text'}`}
        >
          {offLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-2 transition-colors ${value ? 'bg-eeg-accent text-eeg-bg' : 'text-eeg-muted hover:text-eeg-text'}`}
        >
          {onLabel}
        </button>
      </div>
    </label>
  )
}

function ToolbarSelect({ label, value, onChange, children, className = '' }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-eeg-muted">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}
        className={`h-8 bg-eeg-card border border-eeg-border rounded px-2 text-xs font-mono text-eeg-text focus:outline-none focus:border-eeg-accent ${className}`}>
        {children}
      </select>
    </label>
  )
}

function ToolbarRange({ label, value, min, max, step, unit, onChange, wide = false, disabled = false }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'w-40' : 'w-28'}`}>
      <span className="text-[10px] font-mono uppercase tracking-widest text-eeg-muted">
        {label} <span className="text-eeg-accent">{Number(value).toFixed(step < 1 ? 2 : 0)}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))} className="h-8 w-full accent-eeg-accent disabled:opacity-40" />
    </label>
  )
}

function ToolbarNumber({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1 w-16">
      <span className="text-[10px] font-mono uppercase tracking-widest text-eeg-muted">{label}</span>
      <input type="number" value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
        className="h-8 bg-eeg-card border border-eeg-border rounded px-2 text-xs font-mono text-eeg-text focus:outline-none focus:border-eeg-accent" />
    </label>
  )
}

function ToolbarColor({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-eeg-muted">{label}</span>
      <input type="color" value={value} onChange={event => onChange(event.target.value)}
        className="h-8 w-12 rounded border border-eeg-border bg-eeg-card cursor-pointer" />
    </label>
  )
}
