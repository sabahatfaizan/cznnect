import { useEffect, useRef, useState } from 'react'
import { getThemePref, onThemeUnlocked, setThemePref, type ExclusiveTheme } from '../theme'
import { themeLabel } from '../themes/catalog'

const BURST = Array.from({ length: 10 }, (_, i) => i)

// A small celebration whenever an exclusive theme is unlocked, from a code or from the secret coin.
// It offers to switch right away, or confirms the theme is already equipped.
export default function UnlockToast() {
  const [theme, setTheme] = useState<ExclusiveTheme | null>(null)
  const [equipped, setEquipped] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timers = useRef<number[]>([])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  const clearTimers = () => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
  }

  function dismiss() {
    clearTimers()
    setLeaving(true)
    later(() => setTheme(null), 240)
  }

  useEffect(
    () =>
      onThemeUnlocked((t) => {
        clearTimers()
        setLeaving(false)
        setTheme(t)
        // A redeem may equip the theme just after unlocking it, so look once that has happened.
        later(() => setEquipped(getThemePref() === t), 0)
        later(dismiss, 9000)
      }),
    [],
  )
  useEffect(() => clearTimers, [])

  if (!theme) return null
  const label = themeLabel(theme)

  function equipNow() {
    if (!theme) return
    setThemePref(theme)
    setEquipped(true)
    clearTimers()
    later(dismiss, 1500)
  }

  return (
    <div className="unlock-layer" role="status" aria-live="polite">
      <div className={`card unlock-toast ${leaving ? 'unlock-leave' : ''}`}>
        <div className="unlock-burst" aria-hidden="true">
          {BURST.map((i) => (
            <span key={i} style={{ ['--a' as string]: `${i * 36}deg`, ['--d' as string]: `${i % 2 ? 46 : 62}px` }} />
          ))}
        </div>
        <div className="unlock-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M12 2.5l2.7 6.2 6.8.6-5.1 4.5 1.5 6.6L12 16.9 6.1 20.4l1.5-6.6L2.5 9.3l6.8-.6z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Theme unlocked</p>
          <p className="font-display text-xl font-extrabold leading-tight">{label}</p>
          <p className="text-sm text-muted">
            {equipped ? 'Equipped. Enjoy the new look.' : 'Find it any time in Settings, under Appearance.'}
          </p>
          <div className="mt-3 flex gap-2">
            {!equipped && (
              <button type="button" className="btn btn-primary !min-h-0 !px-4 !py-2 text-sm" onClick={equipNow}>
                Use it now
              </button>
            )}
            <button type="button" className="btn btn-plain !min-h-0 !px-4 !py-2 text-sm" onClick={dismiss}>
              {equipped ? 'Nice' : 'Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
