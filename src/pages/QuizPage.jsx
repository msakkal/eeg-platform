import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getQuizQuestions,
  QUIZ_MODULES,
  DIFFICULTY_LABELS,
  shuffle,
} from '@/engine/quiz'
import { generateDemoTrace } from '@/engine/waveforms'
import { makeTimeAxis, SAMPLE_RATE } from '@/engine/signalGenerator'

// ─── States ───────────────────────────────────────────────────────────────────
const PHASE = { SELECT: 'select', QUIZ: 'quiz', RESULTS: 'results' }

export default function QuizPage() {
  const { t } = useTranslation()
  const [phase,      setPhase]      = useState(PHASE.SELECT)
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
    return <QuizSelector moduleId={moduleId} onModuleChange={setModuleId} onStart={startQuiz} />
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
          <span className="text-xs font-mono text-eeg-muted">
            Question {current + 1} / {questions.length}
          </span>
          <div className="flex items-center gap-3">
            <DifficultyBadge level={q.difficulty} />
            <span className="text-xs font-mono text-eeg-muted capitalize">{q.module}</span>
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
                <span className="text-xs font-mono text-eeg-muted">EEG Trace — Identify this pattern</span>
                {revealed && (
                  <span className="text-xs font-mono" style={{ color: '#00FFB0' }}>
                    Pattern: {q.options.find(o => o.correct)?.text}
                  </span>
                )}
              </div>
              <div className="eeg-paper p-3">
                <QuestionTrace patternId={q.patternId} revealed={revealed} />
              </div>
            </div>
          )}

          {/* Question text */}
          <p className="font-body text-eeg-text text-base leading-relaxed mb-6">
            {q.question}
          </p>

          {/* Options */}
          <div className="space-y-2.5">
            {q.options.map(opt => {
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
                  className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border
                              transition-all duration-150 font-body text-sm ${style}
                              ${revealed ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className="w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-xs mt-0.5"
                    style={{
                      borderColor: revealed ? (isCorrect ? '#22c55e' : isSelected ? '#ef4444' : '#1E2A40') : undefined,
                      background:  revealed && isCorrect ? '#22c55e22' : undefined,
                    }}>
                    {opt.id.toUpperCase()}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                  {revealed && isCorrect  && <span className="text-green-400 text-lg">✓</span>}
                  {revealed && isSelected && !isCorrect && <span className="text-red-400 text-lg">✗</span>}
                </button>
              )
            })}
          </div>

          {/* Explanation (revealed) */}
          {revealed && (
            <div className="mt-6 card p-5 border-l-4 animate-slide-up"
              style={{ borderLeftColor: answers[q.id] && q.options.find(o => o.id === answers[q.id])?.correct ? '#00FFB0' : '#FF6B35' }}>
              <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-2">Explanation</p>
              <p className="font-body text-sm text-eeg-text leading-relaxed">{q.explanation}</p>
              {q.reference && (
                <p className="mt-2 text-xs font-mono text-eeg-muted">Ref: {q.reference}</p>
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
              >
                Confirm Answer
              </button>
            ) : (
              <button onClick={nextQuestion} className="btn-primary">
                {current < questions.length - 1 ? 'Next Question →' : 'See Results'}
              </button>
            )}
            <button onClick={restartQuiz} className="btn-ghost text-xs">
              Quit Quiz
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Quiz Selector ────────────────────────────────────────────────────────────

function QuizSelector({ moduleId, onModuleChange, onStart }) {
  return (
    <div className="flex-1 overflow-y-auto px-12 py-10">
      <span className="label-tag mb-4 inline-block">Self Assessment</span>
      <h1 className="section-title mb-2">EEG Quiz</h1>
      <p className="font-body text-sm text-eeg-muted mb-8 max-w-lg">
        Test your knowledge of EEG patterns, montages, and clinical findings. Questions include waveform identification from live-generated traces and clinical scenario reasoning.
      </p>

      <div className="max-w-lg">
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-3">Select Module</p>
        <div className="grid grid-cols-2 gap-2 mb-8">
          {Object.entries(QUIZ_MODULES).map(([id, mod]) => (
            <button
              key={id}
              onClick={() => onModuleChange(id)}
              className={`text-left px-4 py-3.5 rounded-xl border transition-all text-sm
                ${moduleId === id
                  ? 'border-eeg-accent bg-eeg-accent bg-opacity-10 text-eeg-text'
                  : 'border-eeg-border text-eeg-muted hover:border-eeg-muted hover:text-eeg-text'
                }`}
            >
              <span className="font-display font-semibold block">{mod.label}</span>
              <span className="font-mono text-xs opacity-60">
                {mod.questions.length} question{mod.questions.length !== 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-3 items-center mb-8">
          {Object.entries(DIFFICULTY_LABELS).map(([level, { label, color }]) => (
            <span key={level} className="flex items-center gap-1.5 text-xs font-mono"
              style={{ color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>

        <button onClick={onStart} className="btn-primary text-base px-8 py-3">
          Start Quiz →
        </button>
      </div>
    </div>
  )
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function QuizResults({ questions, answers, onRestart }) {
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
        <span className="label-tag mb-4 inline-block">Results</span>

        {/* Score card */}
        <div className="card p-8 mb-8 text-center">
          <div className="text-5xl mb-3">{grade.emoji}</div>
          <div className="font-display font-extrabold text-6xl mb-1" style={{ color: grade.color }}>
            {pct}%
          </div>
          <div className="font-body text-eeg-muted mb-1">{correct} / {total} correct</div>
          <div className="font-display font-semibold text-xl mt-3" style={{ color: grade.color }}>
            {grade.label}
          </div>
        </div>

        {/* Per-question review */}
        <p className="text-xs font-mono uppercase tracking-widest text-eeg-muted mb-4">Review</p>
        <div className="space-y-2 mb-8">
          {questions.map((q, i) => {
            const chosen     = answers[q.id]
            const isCorrect  = q.options.find(o => o.id === chosen)?.correct
            const correctOpt = q.options.find(o => o.correct)
            return (
              <div key={q.id} className="card px-4 py-3 flex items-start gap-3">
                <span className={`text-lg flex-shrink-0 mt-0.5 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {isCorrect ? '✓' : '✗'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs text-eeg-text leading-snug line-clamp-2">{q.question}</p>
                  {!isCorrect && (
                    <p className="font-mono text-xs text-green-400 mt-1">
                      ✓ {correctOpt?.text}
                    </p>
                  )}
                </div>
                <DifficultyBadge level={q.difficulty} small />
              </div>
            )
          })}
        </div>

        <button onClick={onRestart} className="btn-primary">Try Another Quiz</button>
      </div>
    </div>
  )
}

// ─── Question Trace ───────────────────────────────────────────────────────────

function QuestionTrace({ patternId, revealed }) {
  const canvasRef  = useRef(null)
  const sampleRate = SAMPLE_RATE

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const data  = generateDemoTrace(patternId, sampleRate)
    const dpr   = window.devicePixelRatio || 1
    const W     = canvas.clientWidth
    const H     = 90
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const maxV = Math.max(...Array.from(data).map(Math.abs)) || 1
    // Grid
    ctx.strokeStyle = 'rgba(0,212,255,0.08)'
    ctx.lineWidth   = 0.5
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y <= H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);  ctx.stroke() }
    // Baseline
    ctx.strokeStyle = 'rgba(0,212,255,0.15)'
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke()
    // Signal (blurred if not revealed for identify questions — keep same color regardless)
    const color = '#00FFB0'
    ctx.strokeStyle = color
    ctx.lineWidth   = 1.5
    ctx.shadowColor = color
    ctx.shadowBlur  = revealed ? 6 : 8
    ctx.beginPath()
    data.forEach((v, i) => {
      const x = (i / data.length) * W
      const y = H/2 - (v / maxV) * (H/2 - 6)
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y)
    })
    ctx.stroke()
    ctx.shadowBlur = 0
  }, [patternId, revealed])

  return <canvas ref={canvasRef} className="w-full block" />
}

// ─── Difficulty Badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ level, small }) {
  const { label, color } = DIFFICULTY_LABELS[level] ?? { label: level, color: '#5A6A82' }
  return (
    <span className={`font-mono rounded border ${small ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}`}
      style={{ color, borderColor: color + '44', background: color + '11' }}>
      {label}
    </span>
  )
}
