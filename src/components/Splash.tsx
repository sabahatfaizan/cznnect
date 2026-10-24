import { useEffect, useState } from 'react'
import { Mark } from './Logo'

// A figure-eight loop traces itself, starting from its right-hand end, two dots chase each other round it, then the name
// appears. Shown for about six seconds when the app opens (a tap on Skip ends it sooner,
// once the app is ready). With "reduce motion" on, nothing moves.
const LOOP =
  'M185 50C185 90 130 90 100 50C70 10 15 10 15 50C15 90 70 90 100 50C130 10 185 10 185 50Z'

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
    <div
      role="status"
      aria-label="Loading Cznnect"
      className="splash flex min-h-full flex-col items-center justify-center gap-6 px-6"
    >
      <svg viewBox="0 0 200 100" className="w-64 max-w-[80%] overflow-visible" aria-hidden="true">
        <path d={LOOP} pathLength={100} className={`splash-loop ${calm ? 'splash-still' : ''}`} fill="none" strokeWidth="12" strokeLinecap="round" />
        {calm ? (
          <>
            <circle cx="40" cy="25" r="10" className="fill-ink" />
            <circle cx="160" cy="75" r="10" className="fill-accent" />
          </>
        ) : (
          <>
            <circle r="10" className="fill-ink stroke-page" strokeWidth="3" opacity="0">
              <set attributeName="opacity" to="1" begin="2.6s" fill="freeze" />
              <animateMotion dur="3s" begin="2.6s" repeatCount="indefinite" path={LOOP} />
            </circle>
            <circle r="10" className="fill-accent stroke-page" strokeWidth="3" opacity="0">
              <set attributeName="opacity" to="1" begin="2.6s" fill="freeze" />
              <animateMotion dur="3s" begin="1.9s" repeatCount="indefinite" path={LOOP} />
            </circle>
          </>
        )}
      </svg>

      <div className={`flex flex-col items-center gap-2 ${calm ? '' : 'splash-name'}`}>
        <div className="inline-flex items-center gap-2 font-display text-4xl font-extrabold">
          <Mark className="size-[1.15em] flex-none text-accent-text" />
          <span>
            <span className="text-accent-text">Czn</span>nect
          </span>
        </div>
        <p className="text-sm text-muted">Stay connected.</p>
      </div>

      <div className="splash-track" aria-hidden="true">
        <div className={`splash-bar ${calm ? 'splash-still' : ''}`} />
      </div>

      <div className="flex h-11 flex-col items-center justify-start gap-1">
        {onSkip && showSkip ? (
          <button className="link" onClick={onSkip}>
            Skip
          </button>
        ) : null}
      </div>
      <p className="text-xs tracking-wide opacity-60">Made by Sabahat Faizan</p>
    </div>
  )
}
