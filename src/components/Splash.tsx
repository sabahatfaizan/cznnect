import { Wordmark } from './Logo'

// The wordmark C_nnect appears with its square mark spinning to rest while the diagonal draws across.
// Nothing loops forever, so the loading animation always reaches a calm finished state.
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export default function Splash() {
  const calm = prefersReducedMotion()

  return (
    <div role="status" aria-label="Loading Cznnect" className="splash flex min-h-full flex-col items-center justify-center gap-6 px-6">
      <div className={'splash-mark ' + (calm ? 'splash-mark-still' : '')}>
        <Wordmark animated={!calm} className="font-display text-6xl font-extrabold" />
      </div>
      <p className={'text-sm text-muted ' + (calm ? '' : 'splash-name')}>Stay connected.</p>
      <div className="splash-track" aria-hidden="true">
        <div className={'splash-bar ' + (calm ? 'splash-still' : '')} />
      </div>
      <p className="text-xs tracking-wide opacity-60">Made by Sabahat Faizan</p>
    </div>
  )
}
