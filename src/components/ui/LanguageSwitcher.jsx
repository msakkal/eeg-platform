import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '@/i18n/i18n'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [open, setOpen]     = useState(false)
  const ref                 = useRef(null)

  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)
    ?? SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(code) {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-eeg-muted
                   hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-50 transition-all"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="flex-1 text-left font-body">{current.label}</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-eeg-card border border-eeg-border
                        rounded-lg shadow-xl overflow-hidden z-50 animate-slide-up">
          {SUPPORTED_LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => select(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors
                ${lang.code === i18n.language
                  ? 'text-eeg-accent bg-eeg-accent bg-opacity-10'
                  : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                }`}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span className="font-body">{lang.label}</span>
              {lang.dir === 'rtl' && (
                <span className="ms-auto text-xs font-mono text-eeg-muted opacity-60">RTL</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
