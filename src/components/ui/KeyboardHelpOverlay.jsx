import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import React from 'react'
import { SANDBOX_SHORTCUTS } from '@/hooks/useKeyboardShortcuts'

export default function KeyboardHelpOverlay({ onClose }) {
  useLocale()
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="card p-6 max-w-sm w-full mx-4 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-display font-semibold text-eeg-text">{localize("Keyboard Shortcuts")}</p>
            <p className="text-xs font-mono text-eeg-muted mt-0.5">{localize("Sandbox — Reviewer mode")}</p>
          </div>
          <button onClick={onClose}
            className="text-eeg-muted hover:text-eeg-text transition-colors p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          {SANDBOX_SHORTCUTS.map(({ keys, description }) => (
            <div key={description} className="flex items-center justify-between gap-4">
              <span className="font-body text-sm text-eeg-muted">{localize(description)}</span>
              <div className="flex gap-1 flex-shrink-0">
                {keys.map(k => (
                  <kbd key={k}
                    className="font-mono text-xs px-2 py-0.5 rounded border border-eeg-border
                               bg-eeg-card text-eeg-text">
                    {localize(k)}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs font-mono text-eeg-muted text-center">{localize("Press ")}<kbd className="font-mono text-xs px-1.5 py-0.5 rounded border border-eeg-border bg-eeg-card">?</kbd>{localize(" to toggle this overlay")}</p>
      </div>
    </div>
  )
}
