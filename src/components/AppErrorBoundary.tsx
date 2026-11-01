import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostics local; do not send family data or credentials to third parties.
    console.error('Cznnect UI error:', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
          <section className="card">
            <h1 className="font-display text-2xl font-bold">Cznnect hit a snag</h1>
            <p className="mt-2 text-sm text-muted">The screen couldn't load correctly. Your account data has not been intentionally changed. Try reloading the app.</p>
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
