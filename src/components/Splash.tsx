import { Mark } from './Logo'
import Signature from './Signature'

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
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
        <Signature />
      </div>
    </div>
  )
}
