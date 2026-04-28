import React from 'react'
import { useTranslation } from 'react-i18next'
import { MONTAGE_LIST }   from '@/engine/montages'

const PATTERN_GROUPS = [
  {
    id: 'normal',
    label: 'Normal',
    color: '#00FFB0',
    patterns: [
      { id: 'normal_awake',      label: 'Awake',              color: '#00FFB0' },
      { id: 'normal_drowsy',     label: 'Drowsy (N1)',        color: '#88DDAA' },
      { id: 'normal_sleep',      label: 'Stage N2',           color: '#00D4FF' },
      { id: 'slow_wave_sleep',   label: 'Slow Wave (N3)',     color: '#7B5EA7' },
    ],
  },
  {
    id: 'epileptiform',
    label: 'Epileptiform',
    color: '#FF4444',
    patterns: [
      { id: 'absence',               label: '3 Hz Absence',       color: '#FF4444' },
      { id: 'slow_spike_wave',       label: 'Slow S/W (LGS)',     color: '#FF3377' },
      { id: 'polyspike_jme',         label: 'JME Polyspike',      color: '#FF0066' },
      { id: 'centrotemporal_spikes', label: 'BECTS',              color: '#FF6B35' },
      { id: 'temporal_sharps',       label: 'TLE Sharps',         color: '#FF5544' },
      { id: 'hypsarrhythmia',        label: 'Hypsarrhythmia',     color: '#FF2255' },
      { id: 'photoparoxysmal',       label: 'Photoparoxysmal',    color: '#FF8866' },
    ],
  },
  {
    id: 'periodic',
    label: 'Periodic (ICU)',
    color: '#FFA552',
    patterns: [
      { id: 'gpds',            label: 'GPDs',             color: '#FFA552' },
      { id: 'lpds',            label: 'LPDs',             color: '#FF8B40' },
      { id: 'triphasic_waves', label: 'Triphasic Waves',  color: '#FFB347' },
    ],
  },
  {
    id: 'abnormal',
    label: 'Non-Epileptiform',
    color: '#FFD166',
    patterns: [
      { id: 'focal_slowing',   label: 'Focal Slowing',    color: '#FFD166' },
      { id: 'firda',           label: 'FIRDA',            color: '#FFC27A' },
      { id: 'diffuse_slowing', label: 'Diffuse Slowing',  color: '#FFDC7A' },
      { id: 'breach_rhythm',   label: 'Breach Rhythm',    color: '#BFA4FF' },
    ],
  },
  {
    id: 'coma',
    label: 'Coma Patterns',
    color: '#A0A0FF',
    patterns: [
      { id: 'burst_suppression',       label: 'Burst-Suppression', color: '#A0A0FF' },
      { id: 'alpha_coma',              label: 'Alpha Coma',        color: '#99AACC' },
      { id: 'electrocerebral_silence', label: 'ECS (Brain Death)', color: '#6B7BA0' },
    ],
  },
]

export default function SandboxControls({
  montageId, onMontageChange,
  pattern,   onPatternChange,
  amplitude, onAmplitudeChange,
  noiseLevel,onNoiseLevelChange,
  sweepSpeed,onSweepSpeedChange,
  isPlaying, onTogglePlay,
  onInjectSpike,
  onInjectArtifact,
  eyesClosed, onToggleEyes,
  blinksEnabled, onToggleBlinks,
  blinkRate, onBlinkRateChange,
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">

      {/* Play / Pause */}
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

      {/* Inject buttons */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-1">Inject Event</p>
        <button onClick={onInjectSpike}
          className="w-full py-2 rounded-lg text-xs font-medium border border-red-500 border-opacity-40
                     text-red-400 bg-red-500 bg-opacity-10 hover:bg-opacity-20 transition-all">
          ⚡ {t('sandbox.add_spike')}
        </button>
        <button onClick={onInjectArtifact}
          className="w-full py-2 rounded-lg text-xs font-medium border border-eeg-border
                     text-eeg-muted hover:text-eeg-text hover:border-eeg-muted transition-all">
          〰 {t('sandbox.add_artifact')}
        </button>
      </div>

      <Divider />

      {/* Pattern selector */}
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

      {/* Physiologic modifiers (awake only) */}
      {pattern === 'normal_awake' && (
        <>
          <Divider />
          <div className="flex flex-col gap-3">
            <Label>Physiologic State</Label>

            {/* Eye state segmented control */}
            <div>
              <p className="text-xs font-body text-eeg-muted mb-1.5">Eyes</p>
              <div className="grid grid-cols-2 gap-1 bg-eeg-card border border-eeg-border rounded-lg p-1">
                <button
                  onClick={() => eyesClosed && onToggleEyes()}
                  className={`py-1.5 rounded text-xs font-mono transition-colors
                    ${!eyesClosed
                      ? 'bg-eeg-accent bg-opacity-20 text-eeg-accent'
                      : 'text-eeg-muted hover:text-eeg-text'}`}
                  title="Alpha blocks; blinks visible frontally"
                >
                  Open
                </button>
                <button
                  onClick={() => !eyesClosed && onToggleEyes()}
                  className={`py-1.5 rounded text-xs font-mono transition-colors
                    ${eyesClosed
                      ? 'bg-eeg-accent bg-opacity-20 text-eeg-accent'
                      : 'text-eeg-muted hover:text-eeg-text'}`}
                  title="Posterior dominant alpha rhythm"
                >
                  Closed
                </button>
              </div>
              <p className="text-[10px] font-body text-eeg-muted mt-1.5 leading-snug">
                {eyesClosed
                  ? 'Posterior α (8–13 Hz) dominant — Berger rhythm.'
                  : 'α attenuated; diffuse low-amplitude β; blinks at Fp1/Fp2.'}
              </p>
            </div>

            {/* Blinks toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-body text-eeg-muted">Eye blinks</span>
                <button
                  type="button"
                  onClick={onToggleBlinks}
                  className={`relative w-9 h-5 rounded-full transition-colors
                    ${blinksEnabled ? 'bg-eeg-accent' : 'bg-eeg-border'}`}
                  aria-pressed={blinksEnabled}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all
                    ${blinksEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </label>
              {blinksEnabled && !eyesClosed && (
                <Slider
                  label="Blink rate"
                  value={blinkRate}
                  min={0} max={40} step={1}
                  unit="/min"
                  onChange={onBlinkRateChange}
                  color="#66AAFF"
                />
              )}
              {blinksEnabled && eyesClosed && (
                <p className="text-[10px] font-body text-eeg-muted mt-1.5 leading-snug">
                  Blinks suppressed while eyes closed.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <Divider />

      {/* Montage selector */}
      <div>
        <Label>{t('sandbox.montage')}</Label>
        <select
          value={montageId}
          onChange={e => onMontageChange(e.target.value)}
          className="w-full mt-2 bg-eeg-card border border-eeg-border rounded-lg px-3 py-2
                     text-sm text-eeg-text font-body focus:outline-none focus:border-eeg-accent
                     appearance-none cursor-pointer"
        >
          {MONTAGE_LIST.map(m => (
            <option key={m.id} value={m.id}>{m.shortLabel}</option>
          ))}
        </select>
      </div>

      <Divider />

      {/* Sliders */}
      <div className="flex flex-col gap-4">
        <Slider
          label={t('sandbox.amplitude')}
          value={amplitude}
          min={10} max={200} step={5}
          unit="µV"
          onChange={onAmplitudeChange}
          color="#00FFB0"
        />
        <Slider
          label={t('sandbox.noise_level')}
          value={Math.round(noiseLevel * 100)}
          min={0} max={100} step={5}
          unit="%"
          onChange={v => onNoiseLevelChange(v / 100)}
          color="#00D4FF"
        />
        <Slider
          label={t('sandbox.speed')}
          value={sweepSpeed}
          min={5} max={60} step={5}
          unit="mm/s"
          onChange={onSweepSpeedChange}
          color="#7B5EA7"
        />
      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }) {
  return <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted">{children}</p>
}

function Divider() {
  return <div className="border-t border-eeg-border" />
}

function Slider({ label, value, min, max, step, unit, onChange, color }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-body text-eeg-muted">{label}</span>
        <span className="text-xs font-mono" style={{ color }}>{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color}88 ${pct}%, #1E2A40 ${pct}%)`,
        }}
      />
    </div>
  )
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
