import { Mark } from './Logo'

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Just the logo, dead centre. It turns twice: each turn slows to a rest, the diagonal connects, and the
// spin carries on; after the second turn the app opens (App.tsx holds this screen for those two turns).
// Once the app is ready the logo flies toward you and dissolves while the app settles in behind it
// (App.tsx sets `leaving`). With reduced motion it is a still, connected logo and the app simply appears.
export default function Splash({ leaving = false }: { leaving?: boolean }) {
  const calm = prefersReducedMotion()

  return (
    <div role="status" aria-label="Loading Cznnect" className={'splash flex items-center justify-center px-6 ' + (leaving ? 'splash-leave' : '')}>
      <div className="splash-zoom">
        <div className={'splash-mark ' + (calm ? 'splash-mark-still' : '')}>
          <Mark loop={!calm} className="splash-logo h-40 w-40" />
        </div>
      </div>
      <p className="copyright absolute inset-x-0 bottom-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
        &copy; 2026 Sabahat Faizan. All rights reserved.
      </p>
    </div>
  )
}
