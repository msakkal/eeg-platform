import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import { useTranslation } from 'react-i18next'
import { PATTERN_GROUPS } from '@/engine/patterns'
import {
  DEFAULT_FOCAL_SEIZURE_OPTIONS,
  SEIZURE_DURATIONS,
  DEFAULT_SEIZURE_DURATION,
  FOCAL_ONSET_OPTIONS,
  FOCAL_SPREAD_OPTIONS,
  getFocalSpreadRoute,
} from '@/engine/seizures'

export default function SandboxControls({
  pattern,
  onPatternChange,
  isPlaying,
  onTogglePlay,
  onStartSeizure,
  onStopSeizure,
  seizureDuration = DEFAULT_SEIZURE_DURATION,
  onSeizureDurationChange,
  focalOptions = DEFAULT_FOCAL_SEIZURE_OPTIONS,
  onFocalOptionsChange,
  seizureElapsed = 0,
  activeSeizure = null,
  isReady = true,
}) {
  useLocale()
  const { t } = useTranslation()
  const statusPattern = ['focal_status', 'generalized_status'].includes(pattern)
  const startDisabled = !isReady || Boolean(activeSeizure) || statusPattern
  const changeFocalOption = (key, value) =>
    onFocalOptionsChange?.({ ...focalOptions, [key]: value })
  const evolutionTime = activeSeizure
    ? (seizureElapsed * SEIZURE_DURATIONS[activeSeizure.kind]) /
      (activeSeizure.duration ?? SEIZURE_DURATIONS[activeSeizure.kind])
    : 0
  const phase =
    activeSeizure?.kind === 'focal'
      ? evolutionTime < 6
        ? 0
        : evolutionTime < 12
          ? 1
          : 2
      : evolutionTime < 5
        ? 0
        : evolutionTime < 10
          ? 1
          : 2

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex gap-2">
        <button
          onClick={onTogglePlay}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
            transition-all border ${
              isPlaying
                ? 'border-eeg-signal text-eeg-signal bg-eeg-signal bg-opacity-10 hover:bg-opacity-20'
                : 'border-eeg-warn text-eeg-warn bg-eeg-warn bg-opacity-10 hover:bg-opacity-20'
            }`}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
          {localize(isPlaying ? 'Pause' : 'Resume')}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-eeg-muted">{localize("Induce seizure")}</h3>
        <details className="rounded-lg border border-eeg-border p-3 text-xs text-eeg-muted">
          <summary className="cursor-pointer font-medium text-eeg-text">{localize("Seizure settings")}</summary>
          <div className="mt-3 flex flex-col gap-3">
            <label className="text-xs text-eeg-muted">
              <span className="flex justify-between gap-2">
                <span>{localize("Seizure duration")}</span>
                <span className="font-mono text-eeg-text" aria-hidden="true">
                  {localize(seizureDuration)} s
                </span>
              </span>
              <input
                type="range"
                aria-label={localize("Seizure duration")}
                min="10"
                max="120"
                step="1"
                value={seizureDuration}
                disabled={startDisabled}
                aria-valuetext={`${seizureDuration} seconds`}
                onChange={(event) => onSeizureDurationChange?.(Number(event.target.value))}
                className="mt-2 w-full accent-eeg-accent disabled:opacity-40"
              />
              <span className="flex justify-between text-[10px] mt-1" aria-hidden="true">
                <span>10 s</span>
                <span>2 min</span>
              </span>
            </label>
            <label className="text-xs text-eeg-muted">{localize("Focal onset")}<select
                value={focalOptions.onset}
                disabled={startDisabled}
                onChange={(event) => changeFocalOption('onset', event.target.value)}
                className="mt-1 w-full rounded-lg border border-eeg-border bg-eeg-surface px-2 py-2 text-eeg-text disabled:opacity-40"
              >
                {FOCAL_ONSET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {localize(option.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-eeg-muted">{localize("Focal spread")}<select
                value={focalOptions.spread}
                disabled={startDisabled}
                onChange={(event) => changeFocalOption('spread', event.target.value)}
                className="mt-1 w-full rounded-lg border border-eeg-border bg-eeg-surface px-2 py-2 text-eeg-text disabled:opacity-40"
              >
                {FOCAL_SPREAD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {localize(option.label)}
                  </option>
                ))}
              </select>
            </label>
            {focalOptions.spread !== 'none' && (
              <div className="text-xs text-eeg-muted py-1">
                <div className="mt-2 space-y-2">
                  <label className="block">{localize("Spread starts after")}<select
                      value={focalOptions.spreadDelay}
                      disabled={startDisabled}
                      onChange={(event) =>
                        changeFocalOption('spreadDelay', Number(event.target.value))
                      }
                      className="mt-1 w-full rounded-lg border border-eeg-border bg-eeg-surface px-2 py-2 text-eeg-text disabled:opacity-40"
                    >
                      {[2, 4, 6].map((value) => (
                        <option key={value} value={value} disabled={value + 6 > seizureDuration}>
                          {localize(value)}{localize(" seconds")}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">{localize("Spread unfolds over")}<select
                      value={focalOptions.spreadDuration}
                      disabled={startDisabled}
                      onChange={(event) =>
                        changeFocalOption('spreadDuration', Number(event.target.value))
                      }
                      className="mt-1 w-full rounded-lg border border-eeg-border bg-eeg-surface px-2 py-2 text-eeg-text disabled:opacity-40"
                    >
                      {[4, 8, 12].map((value) => (
                        <option
                          key={value}
                          value={value}
                          disabled={value + focalOptions.spreadDelay + 2 > seizureDuration}
                        >
                          {localize(value)}{localize(" seconds")}</option>
                      ))}
                    </select>
                  </label>
                  <p className="leading-relaxed">
                    {localize(getFocalSpreadRoute(focalOptions)
                      .map((id) => FOCAL_ONSET_OPTIONS.find((option) => option.value === id).label)
                      .join(' → '))}
                  </p>
                  <p>{localize("Spread paths are illustrative.")}</p>
                </div>
              </div>
            )}
          </div>
        </details>
        <div role="group" aria-label={localize("Induce seizure")} className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onStartSeizure('focal')}
            disabled={startDisabled}
            className="min-w-0 py-1.5 px-2 rounded-lg text-xs font-medium border border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >{localize("Focal")}</button>
          <button
            type="button"
            onClick={() => onStartSeizure('generalized')}
            disabled={startDisabled}
            className="min-w-0 py-1.5 px-2 rounded-lg text-xs font-medium border border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >{localize("Generalized")}</button>
        </div>
        {activeSeizure && (
          <button type="button" onClick={onStopSeizure} className="btn-ghost">{localize("Stop example")}</button>
        )}
        {activeSeizure && (
          <ol aria-label={localize("Seizure evolution")} className="space-y-1 text-xs">
            {['Faster rhythm', 'Slowing and sharpening', 'Slow sharp-wave activity'].map(
              (label, index) => (
                <li
                  key={label}
                  aria-current={phase === index ? 'step' : undefined}
                  className={phase === index ? 'text-eeg-accent' : 'text-eeg-muted'}
                >
                  {localize(label)}
                </li>
              ),
            )}
          </ol>
        )}
        <p role="status" className="text-xs text-eeg-muted leading-relaxed">
          {localize(statusPattern
            ? 'Status activity continues until you select another pattern.'
            : activeSeizure
              ? `${activeSeizure.kind === 'focal' ? 'Focal' : 'Generalized'} seizure running. The selected background returns after the event.`
              : 'Adds one event to the selected background and resumes playback.')}
        </p>
      </div>

      <Divider />

      <div>
        <Label>{t('sandbox.controls')}</Label>
        <div className="flex flex-col gap-3 mt-2">
          {PATTERN_GROUPS.map((group) => (
            <div key={group.id}>
              <p
                className="text-[10px] font-mono uppercase tracking-widest mb-1.5"
                style={{ color: group.color }}
              >
                {localize(group.label)}
              </p>
              <div className="flex flex-col gap-1">
                {group.patterns.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPatternChange(p.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all
                      border text-start ${
                        pattern === p.id
                          ? 'border-eeg-accent bg-eeg-accent bg-opacity-10 text-eeg-text'
                          : 'border-transparent text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                      }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: p.color }}
                    />
                    <span className="font-body">{localize(p.label)}</span>
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
  useLocale()
  return <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted">{localize(children)}</p>
}

function Divider() {
  useLocale()
  return <div className="border-t border-eeg-border" />
}

function PlayIcon() {
  useLocale()
  return (
    <svg dir="ltr" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

function PauseIcon() {
  useLocale()
  return (
    <svg dir="ltr" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}
