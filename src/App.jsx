import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import LoadingScreen from '@/components/ui/LoadingScreen'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

// Lazy-loaded pages for code splitting
const HomePage       = React.lazy(() => import('@/pages/HomePage'))
const ConceptsPage   = React.lazy(() => import('@/pages/ConceptsPage'))
const MontagesPage   = React.lazy(() => import('@/pages/MontagesPage'))
const WaveformsPage  = React.lazy(() => import('@/pages/WaveformsPage'))
const FindingsPage   = React.lazy(() => import('@/pages/FindingsPage'))
const SandboxPage    = React.lazy(() => import('@/pages/SandboxPage'))
const QuizPage       = React.lazy(() => import('@/pages/QuizPage'))
const ArtifactsPage  = React.lazy(() => import('@/pages/ArtifactsPage'))

export default function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/"           element={<HomePage />} />
            <Route path="/concepts"   element={<ConceptsPage />} />
            <Route path="/montages"   element={<MontagesPage />} />
            <Route path="/waveforms"  element={<WaveformsPage />} />
            <Route path="/findings"   element={<FindingsPage />} />
            <Route path="/sandbox"    element={<SandboxPage />} />
            <Route path="/quiz"       element={<QuizPage />} />
            <Route path="/artifacts"  element={<ArtifactsPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  )
}
