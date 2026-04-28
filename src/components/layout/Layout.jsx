import React, { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useI18n } from '@/hooks/useI18n'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

const NAV_ITEMS = [
  { path: '/',           key: 'home',      icon: HomeIcon   },
  { path: '/concepts',   key: 'concepts',  icon: BookIcon   },
  { path: '/montages',   key: 'montages',  icon: GridIcon   },
  { path: '/waveforms',  key: 'waveforms', icon: WaveIcon   },
  { path: '/findings',   key: 'findings',  icon: ScopeIcon  },
  { path: '/artifacts',  key: 'artifacts', icon: ArtifactIcon },
  { path: '/sandbox',    key: 'sandbox',   icon: BeakerIcon },
  { path: '/quiz',       key: 'quiz',      icon: QuizIcon   },
]

export default function Layout({ children }) {
  const { t }    = useTranslation()
  const { dir }  = useI18n()
  const location = useLocation()

  // Apply RTL direction to the document
  useEffect(() => {
    document.documentElement.dir  = dir
    document.documentElement.lang = document.documentElement.lang || 'en'
  }, [dir])

  return (
    <div className="flex h-screen overflow-hidden bg-eeg-bg" dir={dir}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-eeg-border bg-eeg-surface">

        {/* Logo */}
        <div className="px-5 py-6 border-b border-eeg-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-eeg-accent bg-opacity-15 border border-eeg-accent border-opacity-30 flex items-center justify-center">
              <BrainIcon className="w-4 h-4 text-eeg-accent" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-eeg-text leading-tight">NeuroLearn</p>
              <p className="font-mono text-xs text-eeg-muted leading-tight">EEG Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ path, key, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group
                ${isActive
                  ? 'bg-eeg-accent bg-opacity-10 text-eeg-accent border border-eeg-accent border-opacity-20 font-medium'
                  : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-50'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-body">{t(`nav.${key}`)}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: Language switcher */}
        <div className="px-3 py-4 border-t border-eeg-border">
          <LanguageSwitcher />
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>

    </div>
  )
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

function BrainIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9.5 2C7 2 5 4 5 6.5c0 .9.2 1.7.6 2.4C4 9.7 3 11.2 3 13c0 2.8 2.2 5 5 5h.5v2h7v-2H16c2.8 0 5-2.2 5-5 0-1.8-1-3.3-2.6-4.1.4-.7.6-1.5.6-2.4C19 4 17 2 14.5 2c-1.2 0-2.3.5-3.1 1.2C10.7 2.5 10.1 2 9.5 2z"/>
    </svg>
  )
}

function HomeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  )
}

function BookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  )
}

function GridIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )
}

function WaveIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12h2l2-6 3 12 3-10 2 4h2l2-4 2 4h2"/>
    </svg>
  )
}

function ScopeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  )
}

function BeakerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 3h6v8l3.5 6.5a1 1 0 01-.9 1.5H6.4a1 1 0 01-.9-1.5L9 11V3z"/>
      <line x1="6" y1="14" x2="18" y2="14"/>
    </svg>
  )
}

function QuizIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )
}

function ArtifactIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12h3l2-7 3 14 3-10 2 5 2-3 2 3h3"/>
      <circle cx="18" cy="6" r="2" fill="currentColor" opacity="0.6"/>
    </svg>
  )
}
