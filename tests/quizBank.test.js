import { describe, expect, it } from 'vitest'
import { QUIZ_QUESTIONS, QUIZ_MODULES, getQuizQuestions } from '../src/engine/quiz'
import { WAVEFORM_PATTERNS } from '../src/engine/waveforms'
import german from '../src/i18n/locales/de.content.json'
import arabic from '../src/i18n/locales/ar.content.json'

describe('expanded quiz bank', () => {
  it('offers 40 distinct questions across all four modules', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(40)
    expect(new Set(QUIZ_QUESTIONS.map(question => question.id)).size).toBe(40)
    expect(getQuizQuestions('all', false)).toEqual(QUIZ_QUESTIONS)
    const modules = ['waveforms', 'montages', 'findings', 'concepts']
    for (const moduleId of modules) {
      const questions = getQuizQuestions(moduleId, false)
      expect(questions.length).toBeGreaterThanOrEqual(8)
      expect(questions.every(question => question.module === moduleId)).toBe(true)
      expect(QUIZ_MODULES[moduleId].questions).toEqual(questions.map(question => question.id))
    }
    expect(modules.flatMap(moduleId => QUIZ_MODULES[moduleId].questions).sort())
      .toEqual(QUIZ_MODULES.all.questions.toSorted())
  })

  it.each(QUIZ_QUESTIONS)('$id has one answer, valid trace, explanation, and source', question => {
    expect(['beginner', 'intermediate', 'advanced']).toContain(question.difficulty)
    expect(question.question.trim()).not.toBe('')
    expect(question.options).toHaveLength(4)
    expect(new Set(question.options.map(option => option.id)).size).toBe(4)
    expect(new Set(question.options.map(option => option.text)).size).toBe(4)
    expect(question.options.filter(option => option.correct)).toHaveLength(1)
    expect(question.explanation.trim()).not.toBe('')
    expect(question.reference.trim()).not.toBe('')
    if (question.patternId) expect(WAVEFORM_PATTERNS[question.patternId]).toBeDefined()
    if (question.referenceUrl) expect(new URL(question.referenceUrl).protocol).toBe('https:')
  })

  it('translates every new question, answer, explanation, and reference in both languages', () => {
    for (const question of QUIZ_QUESTIONS.slice(15)) {
      const texts = [question.question, question.explanation, question.reference,
        ...question.options.map(option => option.text)]
      for (const catalog of [german, arabic]) {
        for (const text of texts) {
          expect(catalog[text], text).toBeTruthy()
          expect(catalog[text], text).not.toMatch(/�|\?{2,}/)
        }
      }
    }
  })
})
