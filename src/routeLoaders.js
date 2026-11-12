// Navigation intent starts fetching the same promise consumed by React.lazy.
// A failed speculative fetch can be retried by the actual navigation.
const memoize = (loader) => {
  let pending
  return () => {
    pending ??= loader().catch((error) => {
      pending = null
      throw error
    })
    return pending
  }
}

export const pageLoaders = {
  '/': memoize(() => import('./pages/HomePage')),
  '/concepts': memoize(() => import('./pages/ConceptsPage')),
  '/montages': memoize(() => import('./pages/MontagesPage')),
  '/atlas': memoize(() => import('./pages/AtlasPage')),
  '/waveforms': memoize(() => import('./pages/WaveformsPage')),
  '/findings': memoize(() => import('./pages/FindingsPage')),
  '/sandbox': memoize(() => import('./pages/SandboxPage')),
  '/quiz': memoize(() => import('./pages/QuizPage')),
  '/artifacts': memoize(() => import('./pages/ArtifactsPage')),
  '/reading-algorithm': memoize(() => import('./pages/ReadingAlgorithmPage')),
  '/report-builder': memoize(() => import('./pages/ReportBuilderPage')),
}

export function preloadRoute(path) {
  const section = `/${String(path).split(/[/?]/)[1] || ''}`
  pageLoaders[section]?.().catch(() => {})
}
