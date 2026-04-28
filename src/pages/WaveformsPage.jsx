import React, { useState, useEffect, useRef } from 'react'
import { useTranslation }   from 'react-i18next'
import { WAVEFORM_PATTERNS, WAVEFORM_GROUPS, generateDemoTrace } from '@/engine/waveforms'
import { makeTimeAxis, SAMPLE_RATE } from '@/engine/signalGenerator'

const GROUPS_ORDER = ['background','sleep','epileptiform','periodic','abnormal','artifact']

export default function WaveformsPage() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState('alpha')

  const pattern = WAVEFORM_PATTERNS[selected]

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Pattern list ───────────────────────────────────────────── */}
      <nav className="w-52 flex-shrink-0 border-r border-eeg-border p-4 overflow-y-auto">
        {GROUPS_ORDER.map(groupId => {
          const group = WAVEFORM_GROUPS[groupId]
          const items = Object.values(WAVEFORM_PATTERNS).filter(p => p.group === groupId)
          return (
            <div key={groupId} className="mb-5">
              <p className="text-xs font-mono uppercase tracking-widest mb-2"
                style={{ color: group.color }}>
                {group.label}
              </p>
              <div className="space-y-1">
                {items.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all
                      ${selected === p.id
                        ? 'text-eeg-text bg-eeg-card border border-eeg-border'
                        : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: p.color }} />
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── Right: Detail ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-2xl">
          {/* Tag + title */}
          <span className="label-tag mb-3 inline-block" style={{ color: pattern.color, borderColor: `${pattern.color}44`, background: `${pattern.color}11` }}>
            {WAVEFORM_GROUPS[pattern.group]?.label}
          </span>
          <h1 className="section-title mb-1">{pattern.label}</h1>
          <p className={`text-xs font-mono mb-6 ${pattern.pathological === true ? 'text-red-400' : pattern.pathological === false ? 'text-eeg-signal' : 'text-yellow-400'}`}>
            {pattern.pathological === true ? '⚠ Pathological' : pattern.pathological === false ? '✓ Non-pathological' : '⚡ Context-dependent'}
          </p>

          {/* Demo trace */}
          <div className="card mb-6 overflow-hidden">
            <div className="px-4 py-2 border-b border-eeg-border">
              <span className="text-xs font-mono text-eeg-muted">Demo trace — {pattern.label}</span>
            </div>
            <div className="eeg-paper p-2">
              <MiniTrace patternId={selected} color={pattern.color} />
            </div>
          </div>

          {/* Metadata table */}
          <div className="card divide-y divide-eeg-border">
            {[
              ['Frequency',    pattern.freq],
              pattern.duration && ['Duration', pattern.duration],
              ['Amplitude',    pattern.amplitude],
              ['Morphology',   pattern.morphology],
              ['Location',     pattern.location],
              ['Reactivity',   pattern.reactivity],
              ['Clinical significance', pattern.clinical],
            ].filter(Boolean).map(([key, val]) => (
              <div key={key} className="flex gap-4 px-4 py-3">
                <span className="text-xs font-mono text-eeg-muted w-36 flex-shrink-0">{key}</span>
                <span className="text-sm font-body text-eeg-text">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Mini trace canvas ────────────────────────────────────────────────────────

function MiniTrace({ patternId, color }) {
  const canvasRef  = useRef(null)
  const sampleRate = SAMPLE_RATE

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const data  = generateDemoTrace(patternId, sampleRate)
    const time  = makeTimeAxis(data.length, sampleRate)
    const dpr   = window.devicePixelRatio || 1
    const W     = canvas.clientWidth
    const H     = 80

    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.height = `${H}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    // Baseline
    ctx.strokeStyle = 'rgba(0,212,255,0.1)'
    ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke()

    // Signal
    const maxV = Math.max(...Array.from(data).map(Math.abs)) || 1
    ctx.strokeStyle = color
    ctx.lineWidth   = 1.5
    ctx.shadowColor = color
    ctx.shadowBlur  = 6
    ctx.beginPath()
    data.forEach((v, i) => {
      const x = (i / data.length) * W
      const y = H/2 - (v / maxV) * (H/2 - 8)
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y)
    })
    ctx.stroke()
  }, [patternId, color])

  return <canvas ref={canvasRef} className="w-full block" />
}
