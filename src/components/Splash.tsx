import { useLayoutEffect } from 'react'
import type { CSSProperties } from 'react'
import { Mark } from './Logo'
import { appName } from '../lib/appName'
import { effectiveIcon, iconLogoVars } from '../appIcon'

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Just the logo, dead centre. It keeps turning (each turn slows to a rest, the diagonal connects, and the spin
// carries on) for as long as the app is still loading, like a real loading screen.
// With reduced motion it is a still, connected logo.
export default function Splash() {
  const calm = prefersReducedMotion()
  // An account with Cznnect+ that picked a coloured app icon sees the loading logo in that icon's colours.
  const iconVars = iconLogoVars(effectiveIcon()) as CSSProperties | undefined
  // Tells the Moon Knight theme this is the loading screen, which keeps its moon standing on the edge. Everywhere else
  // the moon is turned into a smile.
  useLayoutEffect(() => {
    document.documentElement.classList.add('on-splash')
    return () => document.documentElement.classList.remove('on-splash')
  }, [])

  return (
    <div role="status" aria-label={`Loading ${appName()}`} className="splash flex items-center justify-center px-6">
      <div className={'splash-mark ' + (calm ? 'splash-mark-still' : '')} style={iconVars}>
        <Mark loop={!calm} className="splash-logo h-40 w-40" />
      </div>
      <p className="copyright absolute inset-x-0 bottom-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
        &copy; 2026 Sabahat Faizan. All rights reserved.
      </p>
    </div>
  )
}
