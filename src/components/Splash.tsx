import { Mark } from './Logo'
import mw4Logo from '../assets/mw4-logo.svg'

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Just the logo, dead centre. It turns twice: each turn slows to a rest, the diagonal connects, and the
// spin carries on; after the second turn the app opens (App.tsx holds this screen for those two turns).
// With reduced motion it is a still, connected logo.
export default function Splash() {
  const calm = prefersReducedMotion()

  return (
    <div role="status" aria-label="Loading Cznnect" className="splash flex items-center justify-center px-6">
      <div className={'splash-mark ' + (calm ? 'splash-mark-still' : '')}>
        <Mark loop={!calm} className="splash-logo h-40 w-40" />
        <img src={mw4Logo} alt="" className="splash-brand-mw4" draggable={false} />
      </div>
      <p className="copyright absolute inset-x-0 bottom-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
        &copy; 2026 Sabahat Faizan. All rights reserved.
      </p>
    </div>
  )
}
