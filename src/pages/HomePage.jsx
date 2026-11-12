import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AnimatedTrace from '@/components/ui/AnimatedTrace'

const MODULES = [
  {
    path:    '/concepts',
    titleKey:'nav.concepts',
    descKey: 'concepts.intro',
    icon:    '🧠',
    tag:     'Foundation',
    color:   '#00D4FF',
  },
  {
    path:    '/montages',
    titleKey:'nav.montages',
    descKey: 'montages.subtitle',
    icon:    '⚡',
    tag:     'Interactive',
    color:   '#00FFB0',
  },
  {
    path:    '/atlas',
    titleKey:'nav.atlas',
    descKey: 'atlas.subtitle',
    icon:    'EEG',
    tag:     'Reference',
    color:   '#7B5EA7',
  },
  {
    path:    '/artifacts',
    titleKey:'nav.artifacts',
    descKey: 'artifacts.subtitle',
    icon:    '⚠️',
    tag:     'Artifacts',
    color:   '#FF6B35',
  },
  {
    path:    '/reading-algorithm',
    titleKey:'nav.reading_algorithm',
    descKey: 'reading_algorithm.subtitle',
    icon:    '01→10',
    tag:     'Workflow',
    color:   '#00D4FF',
  },
  {
    path:    '/report-builder',
    titleKey:'nav.report_builder',
    descKey: 'report_builder.subtitle',
    icon:    '▤',
    tag:     'Interactive',
    color:   '#00FFB0',
  },
  {
    path:    '/sandbox',
    titleKey:'nav.sandbox',
    descKey: 'sandbox.subtitle',
    icon:    '🧪',
    tag:     'Sandbox',
    color:   '#FFD166',
  },
  {
    path:    '/quiz',
    titleKey:'nav.quiz',
    descKey: 'quiz.subtitle',
    icon:    '✅',
    tag:     'Assessment',
    color:   '#00FFB0',
  },
]

export default function HomePage() {
  useLocale()
  const { t } = useTranslation()

  return (
    <div className="min-h-full">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-eeg-border">
        {/* Background EEG paper grid */}
        <div className="absolute inset-0 eeg-paper opacity-60" />

        {/* Decorative animated traces */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <AnimatedTrace />
        </div>

        <div className="relative px-12 py-16">
          <div className="max-w-2xl">
            <span className="label-tag mb-4 inline-block">{t('home.hero_tag')}</span>
            <h1 className="font-display font-extrabold text-5xl text-eeg-text leading-tight mt-3 mb-4">
              {t('home.hero_title')}
            </h1>
            <p className="font-body text-eeg-muted text-lg leading-relaxed mb-8 max-w-xl">
              {t('home.hero_subtitle')}
            </p>
            <div className="flex gap-3">
              <Link to="/concepts" className="btn-primary">{t('home.cta_start')}</Link>
              <Link to="/sandbox"  className="btn-ghost">{t('home.cta_sandbox')}</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modules grid ──────────────────────────────────────────────────── */}
      <div className="px-12 py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-eeg-muted mb-6">
          {t('home.modules')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MODULES.map(mod => (
            <Link
              key={mod.path}
              to={mod.path}
              className="card p-6 hover:border-opacity-60 transition-all duration-200
                         hover:-translate-y-0.5 hover:shadow-lg group"
              style={{ '--hover-border': mod.color }}
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-2xl">{localize(mod.icon)}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded border"
                  style={{ color: mod.color, borderColor: `${mod.color}44`, background: `${mod.color}11` }}>
                  {localize(mod.tag)}
                </span>
              </div>
              <h3 className="font-display font-semibold text-eeg-text mb-2">
                {t(mod.titleKey)}
              </h3>
              <p className="font-body text-sm text-eeg-muted leading-relaxed line-clamp-2">
                {t(mod.descKey)}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-mono transition-colors"
                style={{ color: mod.color }}>
                {t('common.learn_more')}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
