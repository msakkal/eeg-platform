import { useSearchParams } from 'react-router-dom'
import { WAVEFORM_PATTERNS, WAVEFORM_GROUPS } from '@/engine/waveforms'
import DemoTraceViewer from '@/components/eeg/DemoTraceViewer'

const GROUPS_ORDER = ['background','sleep','epileptiform','periodic','abnormal','artifact']
const DEMO_TRACE_SCALE = {
  beta: 0.42,
}

export default function WaveformsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedId = searchParams.get('id')
  const selected = requestedId && WAVEFORM_PATTERNS[requestedId]
    ? requestedId
    : 'alpha'

  const selectPattern = id => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('id', id)
    setSearchParams(nextParams)
  }

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
                    onClick={() => selectPattern(p.id)}
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
              <DemoTraceViewer
                patternId={selected}
                color={pattern.color}
                height={84}
                label={pattern.label}
                traceScale={DEMO_TRACE_SCALE[selected] ?? 1}
              />
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
