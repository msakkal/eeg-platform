import { translateDisplay as localize, useLocale } from '@/i18n/localize'
import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '@/i18n/i18n'

export default function LanguageSwitcher() {
  useLocale()
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const triggerRef = useRef(null)

  const language = i18n.resolvedLanguage || i18n.language?.split('-')[0]
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  function select(code) {
    i18n.changeLanguage(code)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('common.language')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-eeg-muted
                   hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-50 transition-all"
      >
        <span className="text-base leading-none">{localize(current.flag)}</span>
        <span className="flex-1 text-start font-body">{current.label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 right-0 bg-eeg-card border border-eeg-border
                        rounded-lg shadow-xl overflow-hidden z-50 animate-slide-up"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              lang={lang.code}
              dir={lang.dir}
              onClick={() => select(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors
                ${
                  lang.code === language
                    ? 'text-eeg-accent bg-eeg-accent bg-opacity-10'
                    : 'text-eeg-muted hover:text-eeg-text hover:bg-eeg-border hover:bg-opacity-40'
                }`}
            >
              <span className="text-base leading-none">{localize(lang.flag)}</span>
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
