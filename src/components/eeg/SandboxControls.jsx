import React from 'react'
import { useTranslation } from 'react-i18next'
import { PATTERN_GROUPS } from '@/engine/patterns'

export default function SandboxControls({
  pattern, onPatternChange,
  isPlaying, onTogglePlay,
  onInjectSpike,
  onInjectArtifact,
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex gap-2">
        <button
          onClick={onTogglePlay}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
            transition-all border ${isPlaying
              ? 'border-eeg-signal text-eeg-signal bg-eeg-signal bg-opacity-10 hover:bg-opacity-20'
              : 'border-eeg-warn text-eeg-warn bg-eeg-warn bg-opacity-10 hover:bg-opacity-20'
            }`}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
          {isPlaying ? 'Pause' : 'Resume'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-1">Inject Event</p>
        <button onClick={onInjectSpike}
          className="w-full py-2 rounded-lg text-xs font-medium border border-red-500 border-opacity-40
                     text-red-400 bg-red-500 bg-opacity-10 hover:bg-opacity-20 transition-all">
          {t('sandbox.add_spike')}
        </button>
        <button onClick={onInjectArtifact}
          className="w-full py-2 rounded-lg text-xs font-medium border border-eeg-border
                     text-eeg-muted hover:text-eeg-text hover:border-eeg-muted transition-all">
          {t('sandbox.add_artifact')}
        </button>
      </div>

      <Divider />

      <div>
        <Label>{t('sandbox.controls')}</Label>
        <div className="flex flex-col gap-3 mt-2">
          {PATTERN_GROUPS.map(group => (
            <div key={group.id}>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1.5"
                 style={{ color: group.color }}>
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.patterns.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onPatternChange(p.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all
                      border text-left ${pattern === p.id
                        ? 'border-eeg-accent bg-eeg-accent bg-opacity-10 text-eeg-text'
                        : 'border-transparent text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                      }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="font-body">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted">{children}</p>
}

function Divider() {
  return <div className="border-t border-eeg-border" />
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
    </svg>
  )
}
