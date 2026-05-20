import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          <div className="card p-8 max-w-lg text-center">
            <div className="w-12 h-12 rounded-full bg-eeg-warn bg-opacity-15 border border-eeg-warn border-opacity-30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-eeg-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="font-display font-bold text-lg text-eeg-text mb-2">Something went wrong</h2>
            <p className="font-body text-sm text-eeg-muted mb-4 leading-relaxed">
              An unexpected error occurred while loading this page. Try refreshing, or navigate back home.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary text-sm"
              >
                Refresh Page
              </button>
              <a href="/" className="btn-ghost text-sm">
                Go Home
              </a>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="font-mono text-xs text-eeg-muted cursor-pointer">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-eeg-surface border border-eeg-border rounded text-xs font-mono text-eeg-warn overflow-auto max-h-48">
                  {this.state.error.toString()}
                  {'\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
