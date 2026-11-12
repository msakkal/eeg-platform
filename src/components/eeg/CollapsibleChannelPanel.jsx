import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import { useState } from 'react'
import { ChannelHoverPanel } from '@/components/eeg/ChannelHoverMap'

export default function CollapsibleChannelPanel({ channelLabel, className = '' }) {
  useLocale()
  const [open, setOpen] = useState(true)

  return (
    <div className={`lg:flex-shrink-0 border-eeg-border bg-eeg-surface ${open ? 'lg:w-52 lg:border-l' : 'lg:w-12 lg:border-l'} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full h-9 flex items-center justify-center border-b border-eeg-border text-eeg-muted hover:text-eeg-text transition-colors
          ${open ? '' : 'bg-eeg-card bg-opacity-60'}`}
        title={localize(open ? 'Collapse channel view' : 'Expand channel view')}
        aria-label={localize(open ? 'Collapse channel view' : 'Expand channel view')}
        aria-expanded={open}
      >
        <span className="w-6 h-6 rounded border border-eeg-border flex items-center justify-center font-mono text-xs">
          {localize(open ? '>' : '<')}
        </span>
      </button>
      {open ? (
        <ChannelHoverPanel
          channelLabel={channelLabel}
          className="h-[calc(100%-2.25rem)]"
        />
      ) : (
        <div className="h-[calc(100%-2.25rem)] flex items-center justify-center">
          <div className="rotate-90 whitespace-nowrap text-[10px] font-mono uppercase tracking-widest text-eeg-muted">{localize("Channel")}</div>
        </div>
      )}
    </div>
  )
}
