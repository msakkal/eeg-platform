import { useLocale } from '@/i18n/localize'
import React from 'react'
import { useTranslation } from 'react-i18next'

export default function LoadingScreen() {
  useLocale()
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        {/* Animated EEG line */}
        <svg width="120" height="40" viewBox="0 0 120 40" className="text-eeg-signal">
          <polyline
            points="0,20 15,20 20,5 25,35 30,20 40,20 45,10 50,30 55,20 70,20 75,8 80,32 85,20 100,20 105,15 110,25 115,20 120,20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 300,
              strokeDashoffset: 300,
              animation: 'trace 1.5s linear infinite',
            }}
          />
        </svg>
        <p className="font-mono text-sm text-eeg-muted">{t('common.loading')}</p>
      </div>
    </div>
  )
}
