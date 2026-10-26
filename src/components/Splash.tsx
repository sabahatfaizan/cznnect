import { Mark } from './Logo'
import '@fontsource/cinzel/latin-600.css'

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Just the logo, spinning for as long as the app is loading. Each turn slows to a rest, the diagonal
// connects, and the spin carries on. With reduced motion it is a still, connected logo.
export default function Splash() {
  const calm = prefersReducedMotion()

  return (
    <div role="status" aria-label="Loading Cznnect" className="splash relative flex min-h-full flex-col items-center justify-center px-6">
      <div className={'splash-mark ' + (calm ? 'splash-mark-still' : '')}>
        <Mark loop={!calm} className="splash-logo h-40 w-40" />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <p className="motto">
          <span aria-hidden="true" className="motto-rule" />
          Sic Parvis Magna
          <span aria-hidden="true" className="motto-rule" />
        </p>
        <p className="copyright">© 2026 Sabahat Faizan. All rights reserved.</p>
      </div>
    </div>
  )
}
