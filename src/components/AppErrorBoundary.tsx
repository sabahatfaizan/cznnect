import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean; detail: string }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, detail: '' }

  static getDerivedStateFromError(error: unknown): State {
    // Only the technical message (no family data) so a screenshot of this screen shows what broke.
    return { failed: true, detail: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : '' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostics local; do not send family data or credentials to third parties.
    console.error('Cznnect UI error:', error, info.componentStack)
    const where = (info.componentStack ?? '').trim().split('\n').slice(0, 4).map((l) => l.trim().replace(/^at /, '')).join(' < ')
    this.setState((s) => ({ detail: `${s.detail}${where ? `\nIn: ${where}` : ''}`.slice(0, 500) }))
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
          <section className="card">
            <h1 className="font-display text-2xl font-bold">Cznnect hit a snag</h1>
            <p className="mt-2 text-sm text-muted">The screen couldn't load correctly. Your account data has not been intentionally changed. Try reloading the app.</p>
            {this.state.detail && <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-muted">{this.state.detail}</pre>}
            <button className="btn btn-primary mt-5 w-full" onClick={() => window.location.reload()}>
              Reload Cznnect
            </button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
