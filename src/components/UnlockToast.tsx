import { useEffect, useRef, useState } from 'react'
import { getThemePref, onThemeUnlocked, setThemePref, type ExclusiveTheme } from '../theme'
import { themeLabel } from '../themes/catalog'

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
        later(dismiss, 3000)
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
    later(dismiss, 900)
  }

  return (
    <div className="unlock-layer" role="status" aria-live="polite">
      <button
        type="button"
        className={`card unlock-toast ${leaving ? 'unlock-leave' : ''}`}
        onClick={equipped ? dismiss : equipNow}
        aria-label={`${label} unlocked. ${equipped ? 'Dismiss' : 'Tap to use it now'}`}
      >
        <span className="unlock-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M12 2.5l2.7 6.2 6.8.6-5.1 4.5 1.5 6.6L12 16.9 6.1 20.4l1.5-6.6L2.5 9.3l6.8-.6z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="eyebrow block">Cznnect · Theme unlocked</span>
          <span className="font-display block truncate text-base font-extrabold leading-tight">{label}</span>
          <span className="block truncate text-xs text-muted">{equipped ? 'Equipped' : 'Tap to use it now'}</span>
        </span>
      </button>
    </div>
  )
}
