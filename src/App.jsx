import { useLocale } from '@/i18n/localize'
import React, { Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { pageLoaders } from '@/routeLoaders'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

// Lazy-loaded pages for code splitting
const HomePage       = React.lazy(pageLoaders['/'])
const ConceptsPage   = React.lazy(pageLoaders['/concepts'])
const MontagesPage   = React.lazy(pageLoaders['/montages'])
const WaveformsPage  = React.lazy(pageLoaders['/waveforms'])
const FindingsPage   = React.lazy(pageLoaders['/findings'])
const AtlasPage      = React.lazy(pageLoaders['/atlas'])
const SandboxPage    = React.lazy(pageLoaders['/sandbox'])
const QuizPage       = React.lazy(pageLoaders['/quiz'])
const ArtifactsPage  = React.lazy(pageLoaders['/artifacts'])
const ReadingAlgorithmPage = React.lazy(pageLoaders['/reading-algorithm'])
const ReportBuilderPage = React.lazy(pageLoaders['/report-builder'])

export default function App() {
  useLocale()
  useEffect(() => {
    let active = true
    const warm = () => import('@/engine/eegProcessor').then(module => {
      if (active) module.prewarmEEGWorker()
    }).catch(() => {})
    const timer = window.setTimeout(warm, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [])
  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/"           element={<HomePage />} />
            <Route path="/concepts"   element={<ConceptsPage />} />
            <Route path="/montages"   element={<MontagesPage />} />
            <Route path="/atlas"      element={<AtlasPage />} />
            <Route path="/atlas/:entryId" element={<AtlasPage />} />
            <Route path="/waveforms"  element={<WaveformsPage />} />
            <Route path="/findings"   element={<FindingsPage />} />
            <Route path="/artifacts"  element={<ArtifactsPage />} />
            <Route path="/reading-algorithm" element={<ReadingAlgorithmPage />} />
            <Route path="/report-builder" element={<ReportBuilderPage />} />
            <Route path="/sandbox"    element={<SandboxPage />} />
            <Route path="/quiz"       element={<QuizPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  )
}
