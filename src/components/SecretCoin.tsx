import { useEffect, useRef, useState } from 'react'
import { isThemeUnlocked, onUnlocksChanged, unlockTheme } from '../theme'
import CoinMark from './CoinMark'

const TAPS_NEEDED = 7
const RING = 2 * Math.PI * 37

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not every phone can vibrate.
  }
}

// The pirate coin at the top of the Uncharted home screen. Tap it seven times, one tap after another,
// to unlock the Red Dead theme. From the third tap a ring fills and a quiet hint counts down.
export default function SecretCoin() {
  const [taps, setTaps] = useState(0)
  const [bump, setBump] = useState(0)
  const [flip, setFlip] = useState(false)
  const [hint, setHint] = useState('')
  const [unlocked, setUnlocked] = useState(() => isThemeUnlocked('rdr2'))
  const reset = useRef<number>()
  const hintTimer = useRef<number>()

  useEffect(() => onUnlocksChanged(() => setUnlocked(isThemeUnlocked('rdr2'))), [])
  useEffect(
    () => () => {
      window.clearTimeout(reset.current)
      window.clearTimeout(hintTimer.current)
    },
    [],
  )

  function say(text: string, ms = 1800) {
    setHint(text)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(''), ms)
  }

  function tap() {
    setBump((n) => n + 1)
    if (unlocked) {
      buzz(8)
      say('Red Dead is already unlocked')
      return
    }
    const next = taps + 1
    // The taps have to follow each other: pause for a couple of seconds and the count starts over.
    window.clearTimeout(reset.current)
    reset.current = window.setTimeout(() => {
      setTaps(0)
      setHint('')
    }, 2000)
    if (next >= TAPS_NEEDED) {
      window.clearTimeout(reset.current)
      setTaps(0)
      setHint('')
      setFlip(true)
      window.setTimeout(() => setFlip(false), 1100)
      buzz([20, 50, 20])
      unlockTheme('rdr2')
      return
    }
    buzz(8)
    setTaps(next)
    if (next >= 3) say(`${TAPS_NEEDED - next} more…`, 2000)
  }

  return (
    <button type="button" className="brand-coin coin-easter-egg" aria-label="Pirate coin" onClick={tap}>
      <span key={bump} className={`coin-body ${bump ? 'coin-bump' : ''} ${flip ? 'coin-flip' : ''}`}>
        <CoinMark />
      </span>
      <svg className="coin-ring" viewBox="0 0 80 80" aria-hidden="true" style={{ opacity: taps >= 2 || flip ? 1 : 0 }}>
        <circle cx="40" cy="40" r="37" fill="none" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={RING} strokeDashoffset={RING * (1 - (flip ? 1 : taps / TAPS_NEEDED))} transform="rotate(-90 40 40)" />
      </svg>
      {hint && <span className="coin-hint" role="status">{hint}</span>}
    </button>
  )
}
