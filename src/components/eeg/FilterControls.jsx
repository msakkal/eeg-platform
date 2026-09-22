import React, { useState } from 'react'
import { FILTER_PRESETS } from '@/engine/filters'

/**
 * FilterControls
 * Compact panel to configure highpass, lowpass, and notch filter settings.
 *
 * Props:
 *   config    - { hp, lp, notch }
 *   onChange  - (config) => void
 */
export default function FilterControls({ config, onChange }) {
  const [expanded, setExpanded] = useState(false)

  function applyPreset(id) {
    const p = FILTER_PRESETS[id]
    onChange({ hp: p.hp, lp: p.lp, notch: p.notch })
  }

  function set(key, value) {
    if (value === '') {
      onChange({ ...config, [key]: null })
      return
    }
    const frequency = Number(value)
    if (!Number.isFinite(frequency) || frequency <= 0 || frequency >= 128) return
    const next = { ...config, [key]: frequency }
    if (next.hp !== null && next.lp !== null && next.hp >= next.lp) return
    onChange(next)
  }

  const activePreset = Object.entries(FILTER_PRESETS).find(([, p]) =>
    p.hp === config.hp && p.lp === config.lp && p.notch === config.notch
  )?.[0] ?? 'custom'

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between w-full text-xs font-mono text-eeg-muted
                   hover:text-eeg-text transition-colors"
      >
        <span className="uppercase tracking-widest">Filters</span>
        <span className="flex items-center gap-1.5">
          <span className="text-eeg-accent">
            {activePreset === 'none' ? 'off' : activePreset === 'custom' ? 'custom' : FILTER_PRESETS[activePreset]?.label?.split(' ')[0]}
          </span>
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 pt-1 animate-slide-up">
          {/* Preset buttons */}
          <div className="flex flex-col gap-1">
            {Object.entries(FILTER_PRESETS).map(([id, preset]) => (
              <button
                key={id}
                onClick={() => applyPreset(id)}
                className={`text-left text-xs px-2 py-1.5 rounded transition-all font-body
                  ${activePreset === id
                    ? 'bg-eeg-accent bg-opacity-10 text-eeg-accent border border-eeg-accent border-opacity-20'
                    : 'text-eeg-muted hover:text-eeg-text'
                  }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="border-t border-eeg-border pt-2">
            <p className="text-xs font-mono text-eeg-muted mb-2">Custom</p>
            <div className="grid grid-cols-1 gap-2">
              <FilterInput label="HP (Hz)" value={config.hp} onChange={v => set('hp', v)} placeholder="e.g. 0.5" />
              <FilterInput label="LP (Hz)" value={config.lp} onChange={v => set('lp', v)} placeholder="e.g. 70" />
              <FilterInput label="Notch"   value={config.notch} onChange={v => set('notch', v)} placeholder="50 or 60" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterInput({ label, value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-eeg-muted w-14 flex-shrink-0">{label}</span>
      <input
        type="number"
        min="0.1"
        max="127.9"
        step="0.1"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-eeg-bg border border-eeg-border rounded px-2 py-1 text-xs font-mono
                   text-eeg-text placeholder-eeg-muted focus:outline-none focus:border-eeg-accent
                   [appearance:textfield]"
      />
    </div>
  )
}
