import { useEffect, useState } from 'react'
import { Mark } from './Logo'

// The mark draws once, then settles. The dots stay detached from the thick rounded arcs;
// nothing loops forever, so the loading animation always reaches a calm finished state.
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export default function Splash({ onSkip }: { onSkip?: () => void }) {
  const calm = prefersReducedMotion()
  const [showSkip, setShowSkip] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setShowSkip(true), 2500)
    return () => clearTimeout(id)
  }, [])

  return (
    <div role="status" aria-label="Loading Cznnect" className="splash flex min-h-full flex-col items-center justify-center gap-6 px-6">
      <div className={'splash-mark ' + (calm ? 'splash-mark-still' : '')} aria-hidden="true">
        <Mark className="h-32 w-32 text-accent-text" />
      </div>
      <div className={'flex flex-col items-center gap-2 ' + (calm ? '' : 'splash-name')}>
        <div className="inline-flex items-center gap-2 font-display text-4xl font-extrabold">
          <Mark className="size-[1.15em] flex-none text-accent-text" />
          <span><span className="text-accent-text">Czn</span>nect</span>
        </div>
        <p className="text-sm text-muted">Stay connected.</p>
      </div>
      <div className="splash-track" aria-hidden="true">
        <div className={'splash-bar ' + (calm ? 'splash-still' : '')} />
      </div>
      <div className="flex h-11 flex-col items-center justify-start gap-1">
        {onSkip && showSkip ? <button className="link" onClick={onSkip}>Skip</button> : null}
      </div>
      <p className="text-xs tracking-wide opacity-60">Made by Sabahat Faizan</p>
    </div>
  )
}
