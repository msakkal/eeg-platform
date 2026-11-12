import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import { useMemo, useState } from 'react'
import {
  getQuizQuestions,
  QUIZ_MODULES,
  DIFFICULTY_LABELS,
} from '@/engine/quiz'
import DemoTraceViewer from '@/components/eeg/DemoTraceViewer'
import { ELECTRODE_POSITIONS_2D, SELECTABLE_ELECTRODES } from '@/engine/propagation'

// ─── States ───────────────────────────────────────────────────────────────────
const PHASE = { SELECT: 'select', QUIZ: 'quiz', RESULTS: 'results' }

export default function QuizPage() {
  useLocale()
  const [phase,      setPhase]      = useState(PHASE.SELECT)
  const [section,    setSection]    = useState('mcq')
  const [moduleId,   setModuleId]   = useState('all')
  const [questions,  setQuestions]  = useState([])
  const [current,    setCurrent]    = useState(0)
  const [answers,    setAnswers]    = useState({})   // { questionId: optionId }
  const [revealed,   setRevealed]   = useState(false)

  function startQuiz() {
    const qs = getQuizQuestions(moduleId, true)
    setQuestions(qs)
    setCurrent(0)
    setAnswers({})
    setRevealed(false)
    setPhase(PHASE.QUIZ)
  }

  function selectAnswer(qId, optId) {
    if (revealed) return
    setAnswers(prev => ({ ...prev, [qId]: optId }))
  }

  function confirmAnswer() {
    setRevealed(true)
  }

  function nextQuestion() {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1)
      setRevealed(false)
    } else {
      setPhase(PHASE.RESULTS)
    }
  }

  function restartQuiz() {
    setPhase(PHASE.SELECT)
    setQuestions([])
    setCurrent(0)
    setAnswers({})
    setRevealed(false)
  }

  if (phase === PHASE.SELECT) {
    return (
      <QuizSelector
        section={section}
        onSectionChange={setSection}
        moduleId={moduleId}
        onModuleChange={setModuleId}
        onStart={startQuiz}
      />
    )
  }

  if (phase === PHASE.RESULTS) {
    return <QuizResults questions={questions} answers={answers} onRestart={restartQuiz} />
  }

  const q           = questions[current]
  const selectedOpt = answers[q.id]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Progress bar */}
      <div className="flex-shrink-0">
        <div className="h-1 bg-eeg-border">
          <div
            className="h-1 bg-eeg-accent transition-all duration-500"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>
        <div className="px-8 py-3 flex items-center justify-between border-b border-eeg-border">
          <span className="text-xs font-mono text-eeg-muted">{localize("Question ")}{localize(current + 1)} / {localize(questions.length)}
          </span>
          <div className="flex items-center gap-3">
            <DifficultyBadge level={q.difficulty} />
            <span className="text-xs font-mono text-eeg-muted capitalize">{localize(q.module)}</span>
          </div>
        </div>
      </div>

      {/* Question body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">

          {/* EEG trace (if pattern-based question) */}
          {q.patternId && (
            <div className="card mb-6 overflow-hidden">
              <div className="px-4 py-2 border-b border-eeg-border flex items-center justify-between">
                <span className="text-xs font-mono text-eeg-muted">{localize("EEG Trace — Identify this pattern")}</span>
                {revealed && (
                  <span className="text-xs font-mono" style={{ color: '#00FFB0' }}>{localize("Pattern: ")}{localize(q.options.find(o => o.correct)?.text)}
                  </span>
                )}
              </div>
              <div className="eeg-paper p-3">
                <DemoTraceViewer
                  patternId={q.patternId}
                  color="#00FFB0"
                  height={94}
                  label="Quiz trace"
                  className={revealed ? '' : 'opacity-95'}
                />
              </div>
            </div>
          )}

          {/* Question text */}
          <p className="font-body text-eeg-text text-base leading-relaxed mb-6">
            {localize(q.question)}
          </p>

          {/* Options */}
          <div className="space-y-2.5">
            {localize(q.options.map(opt => {
              const isSelected = selectedOpt === opt.id
              const isCorrect  = opt.correct
              let style = 'border-eeg-border text-eeg-muted hover:border-eeg-muted hover:text-eeg-text'
              if (isSelected && !revealed) style = 'border-eeg-accent text-eeg-text bg-eeg-accent bg-opacity-10'
              if (revealed && isCorrect)   style = 'border-green-500 text-green-400 bg-green-500 bg-opacity-10'
              if (revealed && isSelected && !isCorrect) style = 'border-red-500 text-red-400 bg-red-500 bg-opacity-10'

              return (
                <button
                  key={opt.id}
                  onClick={() => selectAnswer(q.id, opt.id)}
                  disabled={revealed}
                  className={`w-full text-start flex items-start gap-3 px-4 py-3.5 rounded-xl border
                              transition-all duration-150 font-body text-sm ${style}
                              ${revealed ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-xs mt-0.5"
                    style={{
                      borderColor: revealed ? (isCorrect ? '#22c55e' : isSelected ? '#ef4444' : '#1E2A40') : undefined,
                      background:  revealed && isCorrect ? '#22c55e22' : undefined,
                    }}>
                    {localize(opt.id.toUpperCase())}
                  </span>
                  <span className="flex-1">{localize(opt.text)}</span>
                  {revealed && isCorrect  && <span className="text-green-400 text-lg">✓</span>}
                  {revealed && isSelected && !isCorrect && <span className="text-red-400 text-lg">✗</span>}
                </button>
              )
            }))}
          </div>

          {/* Explanation (revealed) */}
          {revealed && (
            <div className="mt-6 card p-5 border-l-4 animate-slide-up"
              style={{ borderLeftColor: answers[q.id] && q.options.find(o => o.id === answers[q.id])?.correct ? '#00FFB0' : '#FF6B35' }}>
              <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-2">{localize("Explanation")}</p>
              <p className="font-body text-sm text-eeg-text leading-relaxed">{localize(q.explanation)}</p>
              {q.reference && (
                <p className="mt-2 text-xs font-mono text-eeg-muted">{localize("Ref: ")}{q.referenceUrl ? <a className="underline hover:text-eeg-accent" href={q.referenceUrl} target="_blank" rel="noreferrer">{localize(q.reference)}</a> : localize(q.reference)}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex gap-3">
            {!revealed ? (
              <button
                onClick={confirmAnswer}
                disabled={!selectedOpt}
                className={`btn-primary disabled:opacity-40 disabled:cursor-not-allowed`}
              >{localize("Confirm Answer")}</button>
            ) : (
              <button onClick={nextQuestion} className="btn-primary">
                {localize(current < questions.length - 1 ? 'Next Question →' : 'See Results')}
              </button>
            )}
            <button onClick={restartQuiz} className="btn-ghost text-xs">{localize("Quit Quiz")}</button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Quiz Selector ────────────────────────────────────────────────────────────

function QuizSelector({ section, onSectionChange, moduleId, onModuleChange, onStart }) {
  useLocale()
  return (
    <div className="flex-1 overflow-y-auto px-12 py-10">
      <span className="label-tag mb-4 inline-block">{localize("Self Assessment")}</span>
      <h1 className="section-title mb-2">{localize("EEG Quiz")}</h1>
      <p className="font-body text-sm text-eeg-muted mb-8 max-w-lg">{localize("Test your knowledge of EEG patterns, montages, and clinical findings. Questions include waveform identification from live-generated traces and clinical scenario reasoning.")}</p>

      <div className="flex gap-2 mb-8 border-b border-eeg-border">
        {[
          { id: 'mcq', label: 'MCQ Quiz' },
          { id: 'placement', label: 'Electrode Placement' },
          { id: 'planes', label: 'Skull Planes' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => onSectionChange(tab.id)}
            className={`px-4 py-3 text-sm font-display font-semibold border-b-2 transition-colors
              ${section === tab.id
                ? 'border-eeg-accent text-eeg-text'
                : 'border-transparent text-eeg-muted hover:text-eeg-text'
              }`}
          >
            {localize(tab.label)}
          </button>
        ))}
      </div>

      {section === 'mcq' && (
        <div className="max-w-lg">
          <span className="label-tag mb-4 inline-block">{localize("MCQ Section")}</span>
          <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">{localize("Select Module")}</p>
          <div className="grid grid-cols-2 gap-2 mb-8">
            {Object.entries(QUIZ_MODULES).map(([id, mod]) => (
              <button
                key={id}
                onClick={() => onModuleChange(id)}
                className={`text-start px-4 py-3.5 rounded-xl border transition-all text-sm
                  ${moduleId === id
                    ? 'border-eeg-accent bg-eeg-accent bg-opacity-10 text-eeg-text'
                    : 'border-eeg-border text-eeg-muted hover:border-eeg-muted hover:text-eeg-text'
                  }`}
              >
                <span className="font-display font-semibold block">{localize(mod.label)}</span>
                <span className="font-mono text-xs opacity-60">
                  {localize(mod.questions.length)}{localize(" question")}{localize(mod.questions.length !== 1 ? 's' : '')}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-3 items-center mb-8">
            {Object.entries(DIFFICULTY_LABELS).map(([level, { label, color }]) => (
              <span key={level} className="flex items-center gap-1.5 text-xs font-mono"
                style={{ color }}>
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {localize(label)}
              </span>
            ))}
          </div>

          <button onClick={onStart} className="btn-primary text-base px-8 py-3">{localize("Start Quiz →")}</button>
        </div>
      )}
      {section === 'placement' && <ElectrodePlacementSection />}
      {section === 'planes' && <SkullPlanesPlacementSection />}
    </div>
  )
}

// ─── Electrode Placement Section ──────────────────────────────────────────────

const PLACEMENT_ELECTRODES = SELECTABLE_ELECTRODES

const PLACEMENT_LABELS = {
  Fp1: 'Left frontopolar',
  Fp2: 'Right frontopolar',
  F7:  'Left anterior temporal',
  F3:  'Left frontal',
  Fz:  'Midline frontal',
  F4:  'Right frontal',
  F8:  'Right anterior temporal',
  T7:  'Left mid-temporal',
  C3:  'Left central',
  Cz:  'Midline central',
  C4:  'Right central',
  T8:  'Right mid-temporal',
  P7:  'Left posterior temporal',
  P3:  'Left parietal',
  Pz:  'Midline parietal',
  P4:  'Right parietal',
  P8:  'Right posterior temporal',
  O1:  'Left occipital',
  O2:  'Right occipital',
  A1:  'Left ear reference',
  A2:  'Right ear reference',
}

function shuffleElectrodes() {
  return [...PLACEMENT_ELECTRODES].sort(() => Math.random() - 0.5)
}

function ElectrodePlacementSection() {
  useLocale()
  const [trayOrder, setTrayOrder] = useState(() => shuffleElectrodes())
  const [placements, setPlacements] = useState({})
  const [selected, setSelected] = useState(null)
  const [checked, setChecked] = useState(false)

  const placedLabels = useMemo(() => new Set(Object.values(placements).filter(Boolean)), [placements])
  const available = trayOrder.filter(label => !placedLabels.has(label))
  const placedCount = placedLabels.size
  const correctCount = PLACEMENT_ELECTRODES.filter(label => placements[label] === label).length
  const complete = placedCount === PLACEMENT_ELECTRODES.length

  function placeOn(slot) {
    const existing = placements[slot]

    if (!selected) {
      if (existing) {
        setPlacements(prev => {
          const next = { ...prev }
          delete next[slot]
          return next
        })
        setSelected(existing)
        setChecked(false)
      }
      return
    }

    setPlacements(prev => {
      const next = Object.fromEntries(Object.entries(prev).filter(([, label]) => label !== selected))
      next[slot] = selected
      return next
    })
    setSelected(existing ?? null)
    setChecked(false)
  }

  function resetPlacement() {
    setTrayOrder(shuffleElectrodes())
    setPlacements({})
    setSelected(null)
    setChecked(false)
  }

  return (
    <div className="max-w-5xl">
      <span className="label-tag mb-4 inline-block">{localize("Interactive Section")}</span>
      <div className="grid lg:grid-cols-[minmax(360px,520px)_minmax(280px,1fr)] gap-8 items-start">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-1">{localize("10-20 Placement")}</p>
              <h2 className="font-display text-xl font-bold text-eeg-text">{localize("Place the electrodes on the head")}</h2>
            </div>
            <span className="font-mono text-xs text-eeg-muted">{localize(placedCount)} / {localize(PLACEMENT_ELECTRODES.length)}</span>
          </div>

          <ElectrodePlacementMap
            placements={placements}
            selected={selected}
            checked={checked}
            onPlace={placeOn}
          />
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">{localize("Electrode Tray")}</p>
            <div className="min-h-[48px] mb-4">
              {selected ? (
                <div className="px-3 py-2 rounded-lg border border-eeg-accent bg-eeg-accent bg-opacity-10 text-eeg-text text-sm font-mono inline-flex items-center gap-2">{localize("Selected: ")}<strong>{localize(selected)}</strong>
                  <button onClick={() => setSelected(null)} className="text-eeg-muted hover:text-eeg-text">×</button>
                </div>
              ) : (
                <p className="font-body text-sm text-eeg-muted">{localize("Choose a label, then click the matching target on the scalp map.")}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {available.map(label => (
                <button
                  key={label}
                  onClick={() => {
                    setSelected(label)
                    setChecked(false)
                  }}
                  className={`px-3 py-2 rounded-lg border font-mono text-sm transition-colors
                    ${selected === label
                      ? 'border-eeg-accent bg-eeg-accent bg-opacity-10 text-eeg-text'
                      : 'border-eeg-border text-eeg-muted hover:border-eeg-muted hover:text-eeg-text'
                    }`}
                  title={localize(PLACEMENT_LABELS[label])}
                >
                  {localize(label)}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">{localize("Check Your Map")}</p>
            {checked ? (
              <p className="font-body text-sm text-eeg-text mb-4">{localize("You placed ")}<span className="font-mono text-green-400">{localize(correctCount)}</span>{localize(" of ")}{localize(PLACEMENT_ELECTRODES.length)}{localize(" electrodes correctly.")}</p>
            ) : (
              <p className="font-body text-sm text-eeg-muted mb-4">{localize("Filled targets can be clicked again to pick the label back up. Use the midline and left/right numbering to orient yourself.")}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setChecked(true)}
                disabled={!complete}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >{localize("Check Placement")}</button>
              <button onClick={resetPlacement} className="btn-ghost text-xs">{localize("Reset")}</button>
            </div>
          </div>

          {checked && correctCount < PLACEMENT_ELECTRODES.length && (
            <div className="card p-5 border-l-4 border-l-orange-500 animate-slide-up">
              <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-2">{localize("Corrections")}</p>
              <div className="grid grid-cols-2 gap-2">
                {PLACEMENT_ELECTRODES.filter(label => placements[label] !== label).map(label => (
                  <p key={label} className="font-mono text-xs text-eeg-muted">
                    {localize(label)}: {localize(PLACEMENT_LABELS[label])}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ElectrodePlacementMap({ placements, selected, checked, onPlace }) {
  useLocale()
  const size = 480
  const cx = size / 2
  const cy = size / 2 + 8
  const r = size * 0.38
  const toSvg = point => ({ x: cx + point.x * r, y: cy - point.y * r })

  return (
    <svg dir="ltr"
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-auto"
      role="img"
      aria-label={localize("Interactive 10-20 electrode placement map")}
    >
      <circle cx={cx} cy={cy} r={r} fill="#0D1424" stroke="#1E2A40" strokeWidth="2" />
      <path
        d={`M ${cx - 20} ${cy - r + 8} Q ${cx} ${cy - r - 26} ${cx + 20} ${cy - r + 8}`}
        fill="none"
        stroke="#2A3A54"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx={cx - r - 12} cy={cy + 8} rx="12" ry="22" fill="none" stroke="#2A3A54" strokeWidth="2" />
      <ellipse cx={cx + r + 12} cy={cy + 8} rx="12" ry="22" fill="none" stroke="#2A3A54" strokeWidth="2" />
      <line x1={cx} y1={cy - r + 6} x2={cx} y2={cy + r - 6} stroke="#1E2A40" strokeWidth="1" strokeDasharray="5,7" />
      <line x1={cx - r + 6} y1={cy} x2={cx + r - 6} y2={cy} stroke="#1E2A40" strokeWidth="1" strokeDasharray="5,7" />

      {localize(PLACEMENT_ELECTRODES.map(label => {
        const point = ELECTRODE_POSITIONS_2D[label]
        const { x, y } = toSvg(point)
        const placed = placements[label]
        const isCorrect = placed === label
        const isWrong = checked && placed && !isCorrect
        const stroke = checked && placed ? (isCorrect ? '#22c55e' : '#ef4444') : selected ? '#00D4FF' : '#334466'
        const fill = placed ? (isWrong ? '#3A1420' : '#102338') : '#0D1424'

        return (
          <g key={label}>
            <g
              role="button"
              tabIndex={0}
              aria-label={localize(`Place ${selected ?? 'electrode'} at ${label}`)}
              onClick={() => onPlace(label)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onPlace(label)
                }
              }}
              className="cursor-pointer"
            >
              <circle
                cx={x}
                cy={y}
                r={placed ? 18 : 13}
                fill={fill}
                stroke={stroke}
                strokeWidth={placed ? 2.5 : 1.5}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize={placed ? 14 : 10}
                fontFamily="DM Mono, monospace"
                fontWeight="bold"
                fill={placed ? '#E6EDF7' : '#5A6A82'}
              >
                {localize(placed ?? '?')}
              </text>
            </g>
            {checked && isWrong && (
              <text
                x={x}
                y={y + 31}
                textAnchor="middle"
                fontSize="10"
                fontFamily="DM Mono, monospace"
                fill="#22c55e"
                fontWeight="bold"
              >
                {localize(label)}
              </text>
            )}
          </g>
        )
      }))}
    </svg>
  )
}

// ─── Skull Planes Placement Section ───────────────────────────────────────────

const SNAP_STEP = 10
const SNAP_LABEL = 10
const SNAP_TOLERANCE = 3

const SKULL_GRID_ELECTRODES = [...PLACEMENT_ELECTRODES, 'A1', 'A2']

const TEN_TWENTY_COORDS = {
  Nz:  { x: 0, y: 100 },
  Fp1: { x: -25, y: 76 }, Fpz: { x: 0, y: 80 }, Fp2: { x: 25, y: 76 },
  AF7: { x: -47, y: 65 }, AF3: { x: -24, y: 63 }, AFz: { x: 0, y: 60 }, AF4: { x: 24, y: 63 }, AF8: { x: 47, y: 65 },
  F7:  { x: -65, y: 47 }, F5:  { x: -49, y: 45 }, F3:  { x: -33, y: 44 }, F1:  { x: -16, y: 42 }, Fz:  { x: 0, y: 40 }, F2:  { x: 16, y: 42 }, F4:  { x: 33, y: 44 }, F6:  { x: 49, y: 45 }, F8:  { x: 65, y: 47 },
  FT7: { x: -76, y: 25 }, FC5: { x: -57, y: 24 }, FC3: { x: -38, y: 23 }, FC1: { x: -19, y: 21 }, FCz: { x: 0, y: 20 }, FC2: { x: 19, y: 21 }, FC4: { x: 38, y: 23 }, FC6: { x: 57, y: 24 }, FT8: { x: 76, y: 25 },
  A1:  { x: -100, y: 0 }, T7:  { x: -80, y: 0 }, C5:  { x: -60, y: 0 }, C3:  { x: -40, y: 0 }, C1:  { x: -20, y: 0 }, Cz:  { x: 0, y: 0 }, C2:  { x: 20, y: 0 }, C4:  { x: 40, y: 0 }, C6:  { x: 60, y: 0 }, T8:  { x: 80, y: 0 }, A2: { x: 100, y: 0 },
  TP7: { x: -76, y: -25 }, CP5: { x: -57, y: -24 }, CP3: { x: -38, y: -23 }, CP1: { x: -19, y: -21 }, CPz: { x: 0, y: -20 }, CP2: { x: 19, y: -21 }, CP4: { x: 38, y: -23 }, CP6: { x: 57, y: -24 }, TP8: { x: 76, y: -25 },
  P7:  { x: -65, y: -47 }, P5:  { x: -49, y: -45 }, P3:  { x: -33, y: -44 }, P1:  { x: -16, y: -42 }, Pz:  { x: 0, y: -40 }, P2:  { x: 16, y: -42 }, P4:  { x: 33, y: -44 }, P6:  { x: 49, y: -45 }, P8:  { x: 65, y: -47 },
  PO7: { x: -47, y: -65 }, PO3: { x: -24, y: -63 }, POz: { x: 0, y: -60 }, PO4: { x: 24, y: -63 }, PO8: { x: 47, y: -65 },
  O1:  { x: -25, y: -76 }, Oz:  { x: 0, y: -80 }, O2:  { x: 25, y: -76 },
  Iz:  { x: 0, y: -100 },
}

const TEN_TWENTY_ALIASES = {}

const TEN_TWENTY_ROWS = [
  ['Fp1', 'Fpz', 'Fp2'],
  ['AF7', 'AF3', 'AFz', 'AF4', 'AF8'],
  ['F7', 'F5', 'F3', 'F1', 'Fz', 'F2', 'F4', 'F6', 'F8'],
  ['FT7', 'FC5', 'FC3', 'FC1', 'FCz', 'FC2', 'FC4', 'FC6', 'FT8'],
  ['A1', 'T7', 'C5', 'C3', 'C1', 'Cz', 'C2', 'C4', 'C6', 'T8', 'A2'],
  ['TP7', 'CP5', 'CP3', 'CP1', 'CPz', 'CP2', 'CP4', 'CP6', 'TP8'],
  ['P7', 'P5', 'P3', 'P1', 'Pz', 'P2', 'P4', 'P6', 'P8'],
  ['PO7', 'PO3', 'POz', 'PO4', 'PO8'],
  ['O1', 'Oz', 'O2'],
]

const TEN_TWENTY_VISUAL_LABELS = Object.keys(TEN_TWENTY_COORDS)

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function snapPercent(value) {
  return clamp(Math.round(value / SNAP_STEP) * SNAP_STEP, -110, 110)
}

function snapScalpAxis(value) {
  return clamp(Math.round(value / SNAP_STEP) * SNAP_STEP, -100, 100)
}

function makeSkullTarget(label) {
  const tenTwentyLabel = TEN_TWENTY_ALIASES[label] ?? label
  const point = TEN_TWENTY_COORDS[tenTwentyLabel] ?? ELECTRODE_POSITIONS_2D[label]
  return { x: point.x, y: point.y }
}

const SKULL_TARGETS = Object.fromEntries(SKULL_GRID_ELECTRODES.map(label => [label, makeSkullTarget(label)]))

function randomSnap(min, max) {
  const steps = Math.floor((max - min) / SNAP_STEP)
  return min + Math.floor(Math.random() * (steps + 1)) * SNAP_STEP
}

function randomScalpPoint() {
  let point = { x: 0, y: 0 }
  do {
    point = {
      x: randomSnap(-80, 80),
      y: randomSnap(-80, 80),
    }
  } while (Math.sqrt(point.x ** 2 + point.y ** 2) > 92)
  return point
}

function makeInitialSkullPositions() {
  return Object.fromEntries(SKULL_GRID_ELECTRODES.map(label => [label, randomScalpPoint()]))
}

function isAxisCorrect(position, target, axis) {
  return Math.abs((position?.[axis] ?? 999) - target[axis]) <= SNAP_TOLERANCE
}

function isElectrodeCorrect(position, target) {
  return ['x', 'y'].every(axis => isAxisCorrect(position, target, axis))
}

function sagittalAxisPercent(coords) {
  return clamp(Math.round((100 - coords.y) / 2), 0, 100)
}

function coronalAxisPercent(coords) {
  return clamp(Math.round((coords.x + 100) / 2), 0, 100)
}

function horizontalAxisPercent(coords) {
  const degrees = Math.atan2(coords.x, coords.y) * 180 / Math.PI
  return Math.round(((degrees + 360) % 360) / 3.6) % 100
}

function SkullPlanesPlacementSection() {
  useLocale()
  const [positions, setPositions] = useState(() => makeInitialSkullPositions())
  const [selected, setSelected] = useState('Cz')
  const [checked, setChecked] = useState(false)

  const correctCount = SKULL_GRID_ELECTRODES.filter(label => (
    isElectrodeCorrect(positions[label], SKULL_TARGETS[label])
  )).length

  function moveElectrode(label, values) {
    setPositions(prev => ({
      ...prev,
      [label]: values,
    }))
    setSelected(label)
    setChecked(false)
  }

  function resetSkullPlanes() {
    setPositions(makeInitialSkullPositions())
    setSelected('Cz')
    setChecked(false)
  }

  return (
    <div className="max-w-7xl">
      <span className="label-tag mb-4 inline-block">{localize("Interactive Section")}</span>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-1">{localize("Top-Down Skull Placement")}</p>
            <h2 className="font-display text-2xl font-bold text-eeg-text">{localize("Drag electrodes onto the scalp grid")}</h2>
            <p className="font-body text-sm text-eeg-muted mt-2 max-w-3xl">{localize("The scalp is shown from above with spherical sagittal and coronal guides. Sagittal runs 0% at the nasion to 100% at the inion; coronal runs 0% left to 100% right.")}</p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setChecked(true)}
              className="btn-primary"
            >{localize("Check Placement")}</button>
            <button onClick={resetSkullPlanes} className="btn-ghost text-xs">{localize("Reset")}</button>
          </div>
        </div>

        <div className="grid xl:grid-cols-[minmax(0,760px)_320px] gap-5 items-start">
          <div className="card p-5 overflow-hidden">
            <ScalpGridPlacementMap
              positions={positions}
              targets={SKULL_TARGETS}
              selected={selected}
              checked={checked}
              onSelect={setSelected}
              onMove={moveElectrode}
            />
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-1">{localize("Electrodes")}</p>
                <p className="font-body text-sm text-eeg-muted">{localize("Select a label, then drag it on the scalp.")}</p>
              </div>
              <span className="font-mono text-xs text-eeg-muted">
                {localize(correctCount)} / {localize(SKULL_GRID_ELECTRODES.length)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {localize(SKULL_GRID_ELECTRODES.map(label => {
                const correct = isElectrodeCorrect(positions[label], SKULL_TARGETS[label])
                return (
                  <button
                    key={label}
                    onClick={() => setSelected(label)}
                    className={`px-2.5 py-2 rounded-lg border font-mono text-xs transition-colors
                      ${selected === label
                        ? 'border-eeg-accent bg-eeg-accent bg-opacity-10 text-eeg-text'
                        : checked && correct
                          ? 'border-green-500 text-green-400 bg-green-500 bg-opacity-10'
                          : checked
                            ? 'border-red-500 text-red-400 bg-red-500 bg-opacity-10'
                            : 'border-eeg-border text-eeg-muted hover:border-eeg-muted hover:text-eeg-text'
                      }`}
                    title={localize(PLACEMENT_LABELS[label])}
                  >
                    {localize(label)}
                  </button>
                )
              }))}
            </div>

            {selected && (
              <div className="border-t border-eeg-border pt-4">
                <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-2">{localize("Selected")}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display text-xl font-bold text-eeg-text">{localize(selected)}</span>
                  <span className="font-body text-xs text-eeg-muted">{localize(PLACEMENT_LABELS[selected])}</span>
                </div>
                <CoordinateReadout
                  position={positions[selected]}
                  target={SKULL_TARGETS[selected]}
                  checked={checked}
                />
              </div>
            )}
          </div>
        </div>

        {checked && (
          <div className="card p-5 border-l-4 animate-slide-up"
            style={{ borderLeftColor: correctCount === SKULL_GRID_ELECTRODES.length ? '#00FFB0' : '#FF6B35' }}>
            <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-2">{localize("Result")}</p>
            <p className="font-body text-sm text-eeg-text">
              {localize(correctCount === SKULL_GRID_ELECTRODES.length
                ? 'All electrodes are correctly placed on the scalp grid.'
                : `${correctCount} electrodes are correctly placed. Missed electrodes show their target crosshair on the scalp grid.`)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function CoordinateReadout({ position, target, checked }) {
  useLocale()
  const rows = [
    {
      id: 'sagittal',
      label: 'Sagittal',
      value: sagittalAxisPercent(position),
      target: sagittalAxisPercent(target),
      correct: isAxisCorrect(position, target, 'y'),
    },
    {
      id: 'coronal',
      label: 'Coronal',
      value: coronalAxisPercent(position),
      target: coronalAxisPercent(target),
      correct: isAxisCorrect(position, target, 'x'),
    },
    {
      id: 'horizontal',
      label: 'Horizontal',
      value: horizontalAxisPercent(position),
      target: horizontalAxisPercent(target),
      correct: (() => {
        const delta = Math.abs(horizontalAxisPercent(position) - horizontalAxisPercent(target))
        return Math.min(delta, 100 - delta) <= SNAP_TOLERANCE
      })(),
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {localize(rows.map(row => {
        return (
          <div
            key={row.id}
            className={`rounded-lg border px-3 py-2
              ${checked
                ? row.correct
                  ? 'border-green-500 bg-green-500 bg-opacity-10'
                  : 'border-red-500 bg-red-500 bg-opacity-10'
                : 'border-eeg-border bg-eeg-surface'
              }`}
          >
            <p className="font-mono text-[10px] uppercase text-eeg-muted">{localize(row.label)}</p>
            <p className="font-mono text-sm text-eeg-text">{localize(row.value)}%</p>
            {checked && <p className="font-mono text-[10px] text-eeg-muted">{localize("Target ")}{localize(row.target)}%</p>}
          </div>
        )
      }))}
    </div>
  )
}

function LegacyScalpGridPlacementMap({ positions, targets, selected, checked, onSelect, onMove }) {
  useLocale()
  const [dragging, setDragging] = useState(null)
  const size = 640
  const cx = size / 2
  const cy = size / 2 + 12
  const r = 250
  const earLimit = 110
  const nasion = { x: cx, y: cy - r - 34 }
  const inion = { x: cx, y: cy + r + 34 }
  const leftPreauricular = { x: cx - r - 48, y: cy }
  const rightPreauricular = { x: cx + r + 48, y: cy }
  const orderedLabels = useMemo(() => {
    return [...SKULL_GRID_ELECTRODES].sort((a, b) => {
      if (a === selected) return 1
      if (b === selected) return -1
      return positions[a].y - positions[b].y
    })
  }, [positions, selected])

  function pointFor(coords) {
    if (Number.isFinite(coords.sx) && Number.isFinite(coords.sy)) {
      return { x: coords.sx, y: coords.sy }
    }

    if (Math.abs(coords.x) > 100) {
      return {
        x: cx + (coords.x / 100) * r,
        y: cy - (coords.y / 100) * r,
      }
    }

    const scale = Math.sqrt(Math.max(0, 1 - (coords.y / 100) ** 2))
    return {
      x: cx + ((coords.x * scale) / 100) * r,
      y: cy - (coords.y / 100) * r,
    }
  }

  function sphericalGridPoint(x, y) {
    return pointFor({ x, y })
  }

  function valuesFromPointer(event) {
    const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget
    const rect = svg.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * size
    const py = ((event.clientY - rect.top) / rect.height) * size

    const rawX = ((px - cx) / r) * 100
    const rawY = ((cy - py) / r) * 100

    if (snapPoints.length > 0) {
      const nearest = snapPoints.reduce((best, candidate) => {
        const dx = px - candidate.sx
        const dy = py - candidate.sy
        const distance = dx * dx + dy * dy
        return distance < best.distance ? { candidate, distance } : best
      }, { candidate: snapPoints[0], distance: Infinity }).candidate

      return {
        x: nearest.x,
        y: nearest.y,
        sx: nearest.sx,
        sy: nearest.sy,
      }
    }

    if (Math.abs(rawX) > 100 && Math.abs(rawY) <= 22) {
      return {
        x: rawX < 0 ? -earLimit : earLimit,
        y: 0,
      }
    }

    const y = snapScalpAxis(rawY)
    const horizontalScale = Math.sqrt(Math.max(0.01, 1 - (y / 100) ** 2))
    const x = snapScalpAxis(rawX / horizontalScale)

    return { x, y }
  }

  function beginDrag(event, label) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragging(label)
    onSelect(label)
    onMove(label, valuesFromPointer(event))
  }

  function continueDrag(event) {
    if (!dragging) return
    onMove(dragging, valuesFromPointer(event))
  }

  function endDrag() {
    setDragging(null)
  }

  const guidePoints = {
    ...Object.fromEntries(SKULL_GRID_ELECTRODES.map(label => [label, pointFor(targets[label])])),
    Nz:  nasion,
    Fpz: pointFor({ x: 0, y: 90 }),
    P7:  pointFor(targets.P7),
    P8:  pointFor(targets.P8),
    Oz:  pointFor({ x: 0, y: -90 }),
    Iz:  inion,
  }

  function linePoint(a, b, percent) {
    return {
      x: a.x + (b.x - a.x) * (percent / 100),
      y: a.y + (b.y - a.y) * (percent / 100),
    }
  }

  function arcPath(from, to, bend = 0) {
    const a = guidePoints[from]
    const b = guidePoints[to]
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.max(1, Math.sqrt(dx ** 2 + dy ** 2))
    const control = {
      x: mx + (-dy / length) * bend,
      y: my + (dx / length) * bend,
    }

    return `M ${a.x} ${a.y} Q ${control.x} ${control.y} ${b.x} ${b.y}`
  }

  function arcPoint(from, to, bend = 0, percent = 50) {
    const a = guidePoints[from]
    const b = guidePoints[to]
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.max(1, Math.sqrt(dx ** 2 + dy ** 2))
    const c = {
      x: mx + (-dy / length) * bend,
      y: my + (dx / length) * bend,
    }
    const t = percent / 100
    const u = 1 - t

    return {
      x: u ** 2 * a.x + 2 * u * t * c.x + t ** 2 * b.x,
      y: u ** 2 * a.y + 2 * u * t * c.y + t ** 2 * b.y,
    }
  }

  const sagittalTicks = Array.from({ length: 11 }, (_, index) => index * 10)
  const coronalTicks = Array.from({ length: 11 }, (_, index) => index * 10)
  const quarterCoronalTicks = [0, 25, 50, 75, 100]
  const horizontalTicks = Array.from({ length: 21 }, (_, index) => index * 5)
  const horizontalLandmarks = {
    0: 'Fpz',
    5: 'Fp2',
    15: 'F8',
    25: 'T8',
    35: 'P8',
    45: 'O2',
    50: 'Oz',
    55: 'O1',
    65: 'P7',
    75: 'T7',
    85: 'F7',
    95: 'Fp1',
    100: 'Fpz',
  }
  function sagittalPoint(percent) {
    const theta = (percent / 100) * Math.PI
    const radius = (guidePoints.Iz.y - guidePoints.Nz.y) / 2
    const centerY = (guidePoints.Nz.y + guidePoints.Iz.y) / 2
    return {
      x: cx,
      y: centerY - Math.cos(theta) * radius,
    }
  }

  function coronalPoint(percent) {
    const theta = (percent / 100) * Math.PI
    const radius = (guidePoints.A2.x - guidePoints.A1.x) / 2
    const centerX = (guidePoints.A1.x + guidePoints.A2.x) / 2
    return {
      x: centerX - Math.cos(theta) * radius,
      y: cy,
    }
  }

  const sagittalPath = sagittalTicks.map((percent, index) => {
    const point = sagittalPoint(percent)
    return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  }).join(' ')

  const coronalPath = coronalTicks.map((percent, index) => {
    const point = coronalPoint(percent)
    return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  }).join(' ')

  const horizontalLoop = {
    cx,
    cy: (sagittalPoint(10).y + sagittalPoint(90).y) / 2,
    rx: r * 0.86,
    ry: (sagittalPoint(90).y - sagittalPoint(10).y) / 2,
  }

  function horizontalLoopPoint(percent) {
    // 0/100% is Fpz; the loop moves clockwise first through Fp2, F8, T8.
    const theta = -Math.PI / 2 + (percent / 100) * Math.PI * 2
    return {
      x: horizontalLoop.cx + Math.cos(theta) * horizontalLoop.rx,
      y: horizontalLoop.cy + Math.sin(theta) * horizontalLoop.ry,
    }
  }

  function controlThroughMid(start, mid, end) {
    return {
      x: 2 * mid.x - (start.x + end.x) / 2,
      y: 2 * mid.y - (start.y + end.y) / 2,
    }
  }

  function pathThroughMid(start, mid, end) {
    const control = controlThroughMid(start, mid, end)
    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
  }

  function pointThroughMid(start, mid, end, percent) {
    const control = controlThroughMid(start, mid, end)
    const t = percent / 100
    const u = 1 - t
    return {
      x: u ** 2 * start.x + 2 * u * t * control.x + t ** 2 * end.x,
      y: u ** 2 * start.y + 2 * u * t * control.y + t ** 2 * end.y,
    }
  }

  const coronalBands = [
    {
      id: 'frontal',
      start: horizontalLoopPoint(85),
      mid: sagittalPoint(30),
      end: horizontalLoopPoint(15),
      ticks: quarterCoronalTicks,
      color: '#00D4FF',
    },
    {
      id: 'central',
      start: coronalPoint(0),
      mid: sagittalPoint(50),
      end: coronalPoint(100),
      ticks: coronalTicks,
      color: '#FFD166',
    },
    {
      id: 'posterior',
      start: horizontalLoopPoint(65),
      mid: sagittalPoint(70),
      end: horizontalLoopPoint(35),
      ticks: quarterCoronalTicks,
      color: '#00D4FF',
    },
  ]

  function snapCandidate(coords, point) {
    return {
      x: coords.x,
      y: coords.y,
      sx: point.x,
      sy: point.y,
    }
  }

  const horizontalLabelCoords = {
    Fpz: { x: 0, y: 90 },
    Fp2: targets.Fp2,
    F8:  targets.F8,
    T8:  targets.T8,
    P8:  targets.P8,
    O2:  targets.O2,
    Oz:  { x: 0, y: -90 },
    O1:  targets.O1,
    P7:  targets.P7,
    T7:  targets.T7,
    F7:  targets.F7,
    Fp1: targets.Fp1,
  }

  const horizontalSnapPoints = horizontalTicks.map(percent => {
    const landmark = horizontalLandmarks[percent]
    return snapCandidate(
      landmark && horizontalLabelCoords[landmark]
        ? horizontalLabelCoords[landmark]
        : {
            x: Math.round(((horizontalLoopPoint(percent).x - cx) / r) * 100),
            y: Math.round(((cy - horizontalLoopPoint(percent).y) / r) * 100),
          },
      horizontalLoopPoint(percent),
    )
  })

  const sagittalSnapPoints = sagittalTicks.map(percent => (
    snapCandidate(
      {
        30: targets.Fz,
        50: targets.Cz,
        70: targets.Pz,
      }[percent] ?? { x: 0, y: 100 - percent * 2 },
      sagittalPoint(percent),
    )
  ))

  const coronalSnapPoints = coronalBands.flatMap(axis => (
    axis.ticks.map(percent => {
      let coords
      if (axis.id === 'central') {
        coords = { x: -110 + percent * 2.2, y: 0 }
      } else if (axis.id === 'frontal') {
        const labelCoords = { 0: targets.F7, 25: targets.F3, 50: targets.Fz, 75: targets.F4, 100: targets.F8 }
        coords = labelCoords[percent] ?? { x: -80 + percent * 1.6, y: 40 }
      } else {
        const labelCoords = { 0: targets.P7, 25: targets.P3, 50: targets.Pz, 75: targets.P4, 100: targets.P8 }
        coords = labelCoords[percent] ?? { x: -80 + percent * 1.6, y: -40 }
      }

      return snapCandidate(
        coords,
        axis.id === 'central'
          ? coronalPoint(percent)
          : pointThroughMid(axis.start, axis.mid, axis.end, percent),
      )
    })
  ))

  const snapPoints = [
    ...sagittalSnapPoints,
    ...coronalSnapPoints,
    ...horizontalSnapPoints,
  ]

  const drawnTargetByLabel = {
    Fp1: snapCandidate(targets.Fp1, horizontalLoopPoint(95)),
    Fp2: snapCandidate(targets.Fp2, horizontalLoopPoint(5)),
    F7:  snapCandidate(targets.F7, horizontalLoopPoint(85)),
    F8:  snapCandidate(targets.F8, horizontalLoopPoint(15)),
    T7:  snapCandidate(targets.T7, horizontalLoopPoint(75)),
    T8:  snapCandidate(targets.T8, horizontalLoopPoint(25)),
    P7:  snapCandidate(targets.P7, horizontalLoopPoint(65)),
    P8:  snapCandidate(targets.P8, horizontalLoopPoint(35)),
    O1:  snapCandidate(targets.O1, horizontalLoopPoint(55)),
    O2:  snapCandidate(targets.O2, horizontalLoopPoint(45)),
    F3:  snapCandidate(targets.F3, pointThroughMid(coronalBands[0].start, coronalBands[0].mid, coronalBands[0].end, 25)),
    Fz:  snapCandidate(targets.Fz, pointThroughMid(coronalBands[0].start, coronalBands[0].mid, coronalBands[0].end, 50)),
    F4:  snapCandidate(targets.F4, pointThroughMid(coronalBands[0].start, coronalBands[0].mid, coronalBands[0].end, 75)),
    C3:  snapCandidate(targets.C3, coronalPoint(30)),
    Cz:  snapCandidate(targets.Cz, coronalPoint(50)),
    C4:  snapCandidate(targets.C4, coronalPoint(70)),
    P3:  snapCandidate(targets.P3, pointThroughMid(coronalBands[2].start, coronalBands[2].mid, coronalBands[2].end, 25)),
    Pz:  snapCandidate(targets.Pz, pointThroughMid(coronalBands[2].start, coronalBands[2].mid, coronalBands[2].end, 50)),
    P4:  snapCandidate(targets.P4, pointThroughMid(coronalBands[2].start, coronalBands[2].mid, coronalBands[2].end, 75)),
    A1:  snapCandidate(targets.A1, guidePoints.A1),
    A2:  snapCandidate(targets.A2, guidePoints.A2),
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-1">{localize("Scalp Grid")}</p>
          <p className="font-body text-xs text-eeg-muted">{localize("Nose anterior, ears lateral. Drag labels to the 10-20 positions.")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-eeg-muted">
          <span className="border border-eeg-border rounded px-2 py-1">{localize("sagittal: 10%")}</span>
          <span className="border border-eeg-border rounded px-2 py-1">{localize("coronal: 10%")}</span>
          <span className="border border-eeg-border rounded px-2 py-1">{localize("horizontal: 5%")}</span>
        </div>
      </div>

      <svg dir="ltr"
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-h-[70vh] h-auto touch-none select-none"
        role="img"
        aria-label={localize("Top-down scalp grid electrode placement")}
        onPointerMove={continueDrag}
        onPointerDown={() => onSelect(null)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <clipPath id="scalp-grid-clip">
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
          <filter id="scalp-grid-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="axis-dot" markerWidth="4" markerHeight="4" refX="2" refY="2">
            <circle cx="2" cy="2" r="2" fill="#E6EDF7" />
          </marker>
        </defs>

        <circle cx={cx} cy={cy} r={r} fill="#0D1424" stroke="#C8D2E0" strokeWidth="2.2" opacity="0.96" />
        <path
          d={`M ${cx - 18} ${cy - r - 4} L ${nasion.x} ${nasion.y} L ${cx + 18} ${cy - r - 4}`}
          fill="#0D1424"
          stroke="#C8D2E0"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        <line x1={leftPreauricular.x + 20} y1={cy - 34} x2={leftPreauricular.x + 20} y2={cy + 34} stroke="#C8D2E0" strokeWidth="2" />
        <line x1={leftPreauricular.x + 20} y1={cy - 34} x2={leftPreauricular.x + 34} y2={cy - 34} stroke="#C8D2E0" strokeWidth="2" />
        <line x1={leftPreauricular.x + 20} y1={cy + 34} x2={leftPreauricular.x + 34} y2={cy + 34} stroke="#C8D2E0" strokeWidth="2" />
        <line x1={rightPreauricular.x - 20} y1={cy - 34} x2={rightPreauricular.x - 20} y2={cy + 34} stroke="#C8D2E0" strokeWidth="2" />
        <line x1={rightPreauricular.x - 34} y1={cy - 34} x2={rightPreauricular.x - 20} y2={cy - 34} stroke="#C8D2E0" strokeWidth="2" />
        <line x1={rightPreauricular.x - 34} y1={cy + 34} x2={rightPreauricular.x - 20} y2={cy + 34} stroke="#C8D2E0" strokeWidth="2" />

        <g clipPath="url(#scalp-grid-clip)">
          <ellipse
            cx={horizontalLoop.cx}
            cy={horizontalLoop.cy}
            rx={horizontalLoop.rx}
            ry={horizontalLoop.ry}
            fill="none"
            stroke="#00D4FFAA"
            strokeWidth="2.5"
          />
          <path
            d={sagittalPath}
            fill="none"
            stroke="#00FFB0CC"
            strokeWidth="2.6"
          />
          {coronalBands.map(axis => (
            <path
              key={`coronal-axis-${axis.id}`}
              d={axis.id === 'central' ? coronalPath : pathThroughMid(axis.start, axis.mid, axis.end)}
              fill="none"
              stroke={`${axis.color}CC`}
              strokeWidth={axis.id === 'central' ? 2.6 : 2.3}
            />
          ))}

          {localize(sagittalTicks.map(percent => {
            const p = sagittalPoint(percent)
            return (
              <g key={`sagittal-tick-${percent}`}>
                <circle cx={p.x} cy={p.y} r={percent % 20 === 0 ? 3 : 2.2} fill="#00FFB0" opacity="0.9" />
                <text
                  x={p.x + 16}
                  y={p.y + 4}
                  fontSize="9"
                  fontFamily="DM Mono, monospace"
                  fill="#00FFB0"
                >
                  {localize(percent)}%
                </text>
              </g>
            )
          }))}

          {localize(coronalBands.map(axis => (
            axis.ticks.map(percent => {
              const p = axis.id === 'central'
                ? coronalPoint(percent)
                : pointThroughMid(axis.start, axis.mid, axis.end, percent)
              return (
                <g key={`coronal-tick-${axis.id}-${percent}`}>
                  <circle cx={p.x} cy={p.y} r={percent % 50 === 0 ? 3 : 2.2} fill={axis.color} opacity="0.95" />
                  <text
                    x={p.x}
                    y={p.y - 9}
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="DM Mono, monospace"
                    fill={axis.color}
                  >
                    {localize(percent)}%
                  </text>
                </g>
              )
            })
          )))}

          {localize(horizontalTicks.map(percent => {
            const p = horizontalLoopPoint(percent)
            const landmark = horizontalLandmarks[percent]
            return (
              <g key={`horizontal-tick-${percent}`}>
                <circle cx={p.x} cy={p.y} r={landmark ? 3.4 : 2} fill="#00D4FF" opacity="0.9" />
                {landmark && (
                  <text
                    x={p.x}
                    y={p.y + (percent > 25 && percent < 75 ? 17 : -9)}
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="DM Mono, monospace"
                    fill="#00D4FF"
                  >
                    {localize(landmark)} {localize(percent)}%
                  </text>
                )}
              </g>
            )
          }))}
        </g>

        <circle cx={sagittalPoint(10).x} cy={sagittalPoint(10).y} r="5" fill="#00D4FF" stroke="#08111F" strokeWidth="1.5" />
        <circle cx={nasion.x} cy={nasion.y} r="5" fill="#E6EDF7" stroke="#08111F" strokeWidth="1.5" />
        <circle cx={inion.x} cy={inion.y} r="5" fill="#E6EDF7" stroke="#08111F" strokeWidth="1.5" />
        <circle cx={leftPreauricular.x} cy={leftPreauricular.y} r="5" fill="#E6EDF7" stroke="#08111F" strokeWidth="1.5" />
        <circle cx={rightPreauricular.x} cy={rightPreauricular.y} r="5" fill="#E6EDF7" stroke="#08111F" strokeWidth="1.5" />

        {localize(checked && SKULL_GRID_ELECTRODES.map(label => {
          const targetPoint = pointFor(drawnTargetByLabel[label] ?? targets[label])
          return (
            <g key={`target-${label}`} opacity="0.7">
              <line x1={targetPoint.x - 5} y1={targetPoint.y} x2={targetPoint.x + 5} y2={targetPoint.y} stroke="#00FFB0" strokeWidth="1" />
              <line x1={targetPoint.x} y1={targetPoint.y - 5} x2={targetPoint.x} y2={targetPoint.y + 5} stroke="#00FFB0" strokeWidth="1" />
            </g>
          )
        }))}

        {localize(orderedLabels.map(label => {
          const point = pointFor(positions[label])
          const isSelected = selected === label
          const correct = isElectrodeCorrect(positions[label], targets[label])
          const isEar = label === 'A1' || label === 'A2'
          const fill = isSelected ? '#00D4FF' : checked && correct ? '#22c55e' : checked ? '#ef4444' : '#1E3050'
          const stroke = isSelected ? '#00FFB0' : checked && correct ? '#86efac' : checked ? '#fca5a5' : '#334466'

          return (
            <g
              key={label}
              role="button"
              tabIndex={0}
              aria-label={localize(`Drag ${label} on scalp grid`)}
              transform={`translate(${point.x} ${point.y})`}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => beginDrag(event, label)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(label)
                }
              }}
              filter={isSelected ? 'url(#scalp-grid-glow)' : undefined}
            >
              <circle r={isSelected ? 16 : isEar ? 14 : 12} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.3} />
              <text
                y="5"
                textAnchor="middle"
                fontSize={isSelected ? 12 : isEar ? 11 : 10}
                fontFamily="DM Mono, monospace"
                fontWeight="bold"
                fill={isSelected || checked ? '#08111F' : '#E6EDF7'}
              >
                {localize(label)}
              </text>
            </g>
          )
        }))}

        <text x={nasion.x + 15} y={nasion.y + 2} textAnchor="start" fontSize="12" fontFamily="DM Mono, monospace" fill="#C8D2E0">{localize("Nasion")}</text>
        <text x={nasion.x - 15} y={nasion.y + 2} textAnchor="end" fontSize="10" fontFamily="DM Mono, monospace" fill="#00FFB0">{localize("Sagittal 0%")}</text>
        <text x={inion.x + 15} y={inion.y + 4} textAnchor="start" fontSize="12" fontFamily="DM Mono, monospace" fill="#C8D2E0">{localize("Inion")}</text>
        <text x={inion.x - 15} y={inion.y + 4} textAnchor="end" fontSize="10" fontFamily="DM Mono, monospace" fill="#00FFB0">{localize("Sagittal 100%")}</text>
        <text x={leftPreauricular.x - 12} y={leftPreauricular.y - 8} textAnchor="end" fontSize="12" fontFamily="DM Mono, monospace" fill="#C8D2E0">{localize("Left")}</text>
        <text x={leftPreauricular.x - 12} y={leftPreauricular.y + 10} textAnchor="end" fontSize="10" fontFamily="DM Mono, monospace" fill="#C8D2E0">{localize("tragus")}</text>
        <text x={leftPreauricular.x - 12} y={leftPreauricular.y + 28} textAnchor="end" fontSize="10" fontFamily="DM Mono, monospace" fill="#00D4FF">{localize("Coronal 0%")}</text>
        <text x={rightPreauricular.x + 12} y={rightPreauricular.y - 8} textAnchor="start" fontSize="12" fontFamily="DM Mono, monospace" fill="#C8D2E0">{localize("Right")}</text>
        <text x={rightPreauricular.x + 12} y={rightPreauricular.y + 10} textAnchor="start" fontSize="10" fontFamily="DM Mono, monospace" fill="#C8D2E0">{localize("tragus")}</text>
        <text x={rightPreauricular.x + 12} y={rightPreauricular.y + 28} textAnchor="start" fontSize="10" fontFamily="DM Mono, monospace" fill="#00D4FF">{localize("Coronal 100%")}</text>
      </svg>
    </div>
  )
}

function ScalpGridPlacementMap({ positions, targets, selected, checked, onSelect, onMove }) {
  useLocale()
  const [dragging, setDragging] = useState(null)
  const size = 660
  const cx = size / 2
  const cy = size / 2 + 10
  const scalpRadius = 250
  const landmarkRadius = scalpRadius * 1.1

  function project(coord) {
    if (Math.abs(coord.x) > 100 || Math.abs(coord.y) > 100) {
      return {
        x: cx + (coord.x / 114) * landmarkRadius,
        y: cy - (coord.y / 114) * landmarkRadius,
      }
    }

    return {
      x: cx + (coord.x / 100) * scalpRadius,
      y: cy - (coord.y / 100) * scalpRadius,
    }
  }

  const pointFor = (coords) => project(coords)
  const coordFor = (label) => TEN_TWENTY_COORDS[TEN_TWENTY_ALIASES[label] ?? label]
  const pointForLabel = (label) => project(coordFor(label))

  const nodeCandidates = TEN_TWENTY_VISUAL_LABELS.map(label => ({
    label,
    coord: TEN_TWENTY_COORDS[label],
    point: project(TEN_TWENTY_COORDS[label]),
  }))

  const orderedLabels = useMemo(() => {
    return [...SKULL_GRID_ELECTRODES].sort((a, b) => {
      if (a === selected) return 1
      if (b === selected) return -1
      return positions[a].y - positions[b].y
    })
  }, [positions, selected])

  function pathForLabels(labels) {
    return labels.map((label, index) => {
      const point = pointForLabel(label)
      return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    }).join(' ')
  }

  function straightPathForAxis(labels) {
    const start = pointForLabel(labels[0])
    const end = pointForLabel(labels[labels.length - 1])
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  }

  function coordFromSvgPoint(px, py) {
    return {
      x: ((px - cx) / scalpRadius) * 100,
      y: ((cy - py) / scalpRadius) * 100,
    }
  }

  function distanceSquared(a, b) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
  }

  function nearestPointOnSegment(point, start, end) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx ** 2 + dy ** 2
    if (lengthSquared === 0) return start

    const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
    return {
      x: start.x + dx * t,
      y: start.y + dy * t,
    }
  }

  function nearestPointOnHorizontalCircle(point) {
    const distance = Math.hypot(point.x, point.y)
    if (distance === 0) return { x: 0, y: horizontalAxisRadius }
    return {
      x: (point.x / distance) * horizontalAxisRadius,
      y: (point.y / distance) * horizontalAxisRadius,
    }
  }

  function nearestPointOnDrawnAxis(point) {
    const lineCandidate = axisLineSegments.reduce((best, segment) => {
      const projected = nearestPointOnSegment(point, segment.start, segment.end)
      const distance = distanceSquared(point, projected)
      return distance < best.distance ? { coord: projected, distance } : best
    }, { coord: axisLineSegments[0].start, distance: Infinity })

    const circleCoord = nearestPointOnHorizontalCircle(point)
    const circleCandidate = {
      coord: circleCoord,
      distance: distanceSquared(point, circleCoord),
    }

    return circleCandidate.distance < lineCandidate.distance ? circleCandidate.coord : lineCandidate.coord
  }

  function valuesFromPointer(event) {
    const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget
    const rect = svg.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * size
    const py = ((event.clientY - rect.top) / rect.height) * size
    const pointerCoord = coordFromSvgPoint(px, py)
    const axisCoord = nearestPointOnDrawnAxis(pointerCoord)

    const nearestNode = nodeCandidates.reduce((best, node) => {
      const distance = distanceSquared(axisCoord, node.coord)
      return distance < best.distance ? { node, distance } : best
    }, { node: nodeCandidates[0], distance: Infinity }).node

    if (distanceSquared(axisCoord, nearestNode.coord) <= 6 ** 2) {
      return { x: nearestNode.coord.x, y: nearestNode.coord.y }
    }

    return {
      x: Math.round(axisCoord.x * 10) / 10,
      y: Math.round(axisCoord.y * 10) / 10,
    }
  }

  function beginDrag(event, label) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragging(label)
    onSelect(label)
    onMove(label, valuesFromPointer(event))
  }

  function continueDrag(event) {
    if (!dragging) return
    onMove(dragging, valuesFromPointer(event))
  }

  function endDrag() {
    setDragging(null)
  }

  function clearSelectionFromBackground(event) {
    if (event.target.closest?.('[data-electrode-handle="true"]')) return
    setDragging(null)
    onSelect(null)
  }

  const sagittalLabels = ['Nz', 'Fpz', 'AFz', 'Fz', 'FCz', 'Cz', 'CPz', 'Pz', 'POz', 'Oz', 'Iz']
  const centralCoronalLabels = ['A1', 'T7', 'C5', 'C3', 'C1', 'Cz', 'C2', 'C4', 'C6', 'T8', 'A2']
  const horizontalAxisRadius = 80
  const horizontalTickPercents = Array.from({ length: 21 }, (_, index) => index * 5)
  const horizontalTickLabels = {
    0: 'Fpz',
    5: 'Fp2',
    10: 'AF8',
    15: 'F8',
    20: 'FT8',
    25: 'T8',
    30: 'TP8',
    35: 'P8',
    40: 'PO8',
    45: 'O2',
    50: 'Oz',
    55: 'O1',
    60: 'PO7',
    65: 'P7',
    70: 'TP7',
    75: 'T7',
    80: 'FT7',
    85: 'F7',
    90: 'AF7',
    95: 'Fp1',
    100: 'Fpz',
  }
  const longitudinalChains = [
    ['Fp1', 'AF3', 'F3', 'FC3', 'C3', 'CP3', 'P3', 'PO3', 'O1'],
    ['Fp2', 'AF4', 'F4', 'FC4', 'C4', 'CP4', 'P4', 'PO4', 'O2'],
    ['AF7', 'F7', 'FT7', 'T7', 'TP7', 'P7', 'PO7'],
    ['AF8', 'F8', 'FT8', 'T8', 'TP8', 'P8', 'PO8'],
  ]
  const axisLineGroups = [
    ...TEN_TWENTY_ROWS,
    sagittalLabels,
    centralCoronalLabels,
    ...longitudinalChains,
  ]
  const axisLineSegments = axisLineGroups.flatMap(group => (
    group.slice(0, -1).map((label, index) => ({
      start: coordFor(label),
      end: coordFor(group[index + 1]),
    }))
  ))

  function horizontalAxisCoord(percent, radius = horizontalAxisRadius) {
    const theta = (percent / 100) * Math.PI * 2
    return {
      x: Math.sin(theta) * radius,
      y: Math.cos(theta) * radius,
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-1">{localize("Top-Down Scalp Projection")}</p>
          <p className="font-body text-xs text-eeg-muted">{localize("Top-down projection. Drag labels to snap onto the nearest 10-10 coordinate.")}</p>
        </div>
      </div>

      <svg dir="ltr"
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-h-[72vh] h-auto touch-none select-none"
        role="img"
        aria-label={localize("Top-down 10-10 scalp projection electrode placement")}
        onPointerDownCapture={clearSelectionFromBackground}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <clipPath id="ten-ten-scalp-clip">
            <circle cx={cx} cy={cy} r={scalpRadius} />
          </clipPath>
          <filter id="scalp-grid-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx={cx - scalpRadius - 14} cy={cy + 4} rx="14" ry="34" fill="#0D1424" stroke="#C8D2E0" strokeWidth="2" opacity="0.96" />
        <ellipse cx={cx + scalpRadius + 14} cy={cy + 4} rx="14" ry="34" fill="#0D1424" stroke="#C8D2E0" strokeWidth="2" opacity="0.96" />
        <circle cx={cx} cy={cy} r={scalpRadius} fill="#0D1424" stroke="#C8D2E0" strokeWidth="2.2" opacity="0.96" />
        <path
          d={`M ${cx - 22} ${cy - scalpRadius + 2} Q ${cx} ${cy - scalpRadius - 24} ${cx + 22} ${cy - scalpRadius + 2} Q ${cx} ${cy - scalpRadius + 12} ${cx - 22} ${cy - scalpRadius + 2} Z`}
          fill="#0D1424"
          stroke="#C8D2E0"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        <g clipPath="url(#ten-ten-scalp-clip)">
          <circle
            cx={cx}
            cy={cy}
            r={(horizontalAxisRadius / 100) * scalpRadius}
            fill="none"
            stroke="#74849BCC"
            strokeWidth="1.8"
          />
          {localize(horizontalTickPercents.map(percent => {
            const inner = project(horizontalAxisCoord(percent, horizontalAxisRadius - 2.5))
            const outer = project(horizontalAxisCoord(percent, horizontalAxisRadius + 2.5))
            const labelPoint = project(horizontalAxisCoord(percent, horizontalAxisRadius + 8))
            const isCardinal = percent % 25 === 0
            return (
              <g key={`horizontal-axis-tick-${percent}`}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#74849BCC"
                  strokeWidth={isCardinal ? 1.4 : 0.9}
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y + 3}
                  textAnchor="middle"
                  fontSize={isCardinal ? 8 : 7}
                  fontFamily="DM Mono, monospace"
                  fill={isCardinal ? '#8EA2BD' : '#5A6A82'}
                >
                  {localize(percent)}%
                </text>
              </g>
            )
          }))}
          {localize(TEN_TWENTY_ROWS.map((row, index) => {
            const isMiddleCoronal = row.includes('Cz')
            return (
            <path
              key={`ten-ten-row-${index}`}
              d={isMiddleCoronal ? straightPathForAxis(row) : pathForLabels(row)}
              fill="none"
              stroke={isMiddleCoronal ? '#FFD166AA' : '#00D4FF66'}
              strokeWidth={isMiddleCoronal ? 2.2 : 1.2}
            />
            )
          }))}
          {localize([sagittalLabels, centralCoronalLabels, ...longitudinalChains].map((chain, index) => {
            const isMiddleAxis = index === 0 || index === 1
            return (
            <path
              key={`ten-ten-chain-${index}`}
              d={isMiddleAxis ? straightPathForAxis(chain) : pathForLabels(chain)}
              fill="none"
              stroke={index === 0 ? '#00FFB0CC' : index === 1 ? '#FFD166CC' : '#74849B88'}
              strokeWidth={index < 2 ? 2.4 : 1.2}
            />
            )
          }))}
        </g>

        {localize(TEN_TWENTY_VISUAL_LABELS.map(label => {
          const point = pointForLabel(label)
          const aliasTargets = Object.values(TEN_TWENTY_ALIASES)
          const isMajor = SKULL_GRID_ELECTRODES.includes(label) || aliasTargets.includes(label) || sagittalLabels.includes(label)
          return (
            <g key={`ten-ten-node-${label}`}>
              <circle cx={point.x} cy={point.y} r={isMajor ? 4 : 2.5} fill={isMajor ? '#C8D2E0' : '#5A6A82'} opacity={isMajor ? 0.9 : 0.6} />
            </g>
          )
        }))}

        {localize(checked && SKULL_GRID_ELECTRODES.map(label => {
          const targetPoint = pointFor(targets[label])
          return (
            <g key={`target-${label}`} opacity="0.75">
              <line x1={targetPoint.x - 6} y1={targetPoint.y} x2={targetPoint.x + 6} y2={targetPoint.y} stroke="#00FFB0" strokeWidth="1" />
              <line x1={targetPoint.x} y1={targetPoint.y - 6} x2={targetPoint.x} y2={targetPoint.y + 6} stroke="#00FFB0" strokeWidth="1" />
            </g>
          )
        }))}

        {localize(orderedLabels.map(label => {
          const point = pointFor(positions[label])
          const isSelected = selected === label
          const correct = isElectrodeCorrect(positions[label], targets[label])
          const isEar = label === 'A1' || label === 'A2'
          const fill = isSelected ? '#00D4FF' : checked && correct ? '#22c55e' : checked ? '#ef4444' : '#1E3050'
          const stroke = isSelected ? '#00FFB0' : checked && correct ? '#86efac' : checked ? '#fca5a5' : '#334466'

          return (
            <g
              key={label}
              data-electrode-handle="true"
              role="button"
              tabIndex={0}
              aria-label={localize(`Drag ${label} on 10-20 scalp grid`)}
              transform={`translate(${point.x} ${point.y})`}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => beginDrag(event, label)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(label)
                }
              }}
              filter={isSelected ? 'url(#scalp-grid-glow)' : undefined}
            >
              <circle r={isSelected ? 16 : isEar ? 14 : 12} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2 : 1.3} />
              <text
                y="5"
                textAnchor="middle"
                fontSize={isSelected ? 12 : isEar ? 11 : 10}
                fontFamily="DM Mono, monospace"
                fontWeight="bold"
                fill={isSelected || checked ? '#08111F' : '#E6EDF7'}
              >
                {localize(label)}
              </text>
            </g>
          )
        }))}
      </svg>
    </div>
  )
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function QuizResults({ questions, answers, onRestart }) {
  useLocale()
  const correct = questions.filter(q => {
    const chosen = answers[q.id]
    return q.options.find(o => o.id === chosen)?.correct
  }).length
  const total   = questions.length
  const pct     = total > 0 ? Math.round((correct / total) * 100) : 0

  const grade =
    pct >= 90 ? { label: 'Excellent', color: '#00FFB0', emoji: '🏆' } :
    pct >= 70 ? { label: 'Good',      color: '#00D4FF', emoji: '🎯' } :
    pct >= 50 ? { label: 'Fair',      color: '#FFD166', emoji: '📚' } :
                { label: 'Keep practising', color: '#FF6B35', emoji: '🔄' }

  return (
    <div className="flex-1 overflow-y-auto px-12 py-10">
      <div className="max-w-2xl">
        <span className="label-tag mb-4 inline-block">{localize("Results")}</span>

        {/* Score card */}
        <div className="card p-8 mb-8 text-center">
          <div className="text-5xl mb-3">{localize(grade.emoji)}</div>
          <div className="font-display font-extrabold text-6xl mb-1" style={{ color: grade.color }}>
            {localize(pct)}%
          </div>
          <div className="font-body text-eeg-muted mb-1">{localize(correct)} / {localize(total)}{localize(" correct")}</div>
          <div className="font-display font-semibold text-xl mt-3" style={{ color: grade.color }}>
            {localize(grade.label)}
          </div>
        </div>

        {/* Per-question review */}
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-4">{localize("Review")}</p>
        <div className="space-y-2 mb-8">
          {localize(questions.map(q => {
            const chosen     = answers[q.id]
            const isCorrect  = q.options.find(o => o.id === chosen)?.correct
            const correctOpt = q.options.find(o => o.correct)
            return (
              <div key={q.id} className="card px-4 py-3 flex items-start gap-3">
                <span className={`text-lg flex-shrink-0 mt-0.5 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {localize(isCorrect ? '✓' : '✗')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs text-eeg-text leading-snug line-clamp-2">{localize(q.question)}</p>
                  {!isCorrect && (
                    <p className="font-mono text-xs text-green-400 mt-1">
                      ✓ {localize(correctOpt?.text)}
                    </p>
                  )}
                </div>
                <DifficultyBadge level={q.difficulty} small />
              </div>
            )
          }))}
        </div>

        <button onClick={onRestart} className="btn-primary">{localize("Try Another Quiz")}</button>
      </div>
    </div>
  )
}

// ─── Difficulty Badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ level, small }) {
  useLocale()
  const { label, color } = DIFFICULTY_LABELS[level] ?? { label: level, color: '#5A6A82' }
  return (
    <span className={`font-mono rounded border ${small ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}
      style={{ color, borderColor: color + '44', background: color + '11' }}>
      {localize(label)}
    </span>
  )
}
