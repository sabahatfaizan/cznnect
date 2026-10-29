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

// Tap the pirate coin seven times to unlock the Red Dead theme.
// The coin bounces on every tap and the outline quietly fills with progress.
export default function SecretCoin() {
  const [taps, setTaps] = useState(0)
  const [bump, setBump] = useState(0)
  const [flip, setFlip] = useState(false)
  const [unlocked, setUnlocked] = useState(() => isThemeUnlocked('rdr2'))
  const reset = useRef<number>()

  useEffect(() => onUnlocksChanged(() => setUnlocked(isThemeUnlocked('rdr2'))), [])
  useEffect(
    () => () => {
      window.clearTimeout(reset.current)
    },
    [],
  )

  function tap() {
    setBump((n) => n + 1)
    if (unlocked) {
      buzz(8)
      return
    }

    const next = taps + 1
    // Taps must follow one another; a pause resets the ring without a warning.
    window.clearTimeout(reset.current)
    reset.current = window.setTimeout(() => setTaps(0), 2000)

    if (next >= TAPS_NEEDED) {
      window.clearTimeout(reset.current)
      setTaps(0)
      setFlip(true)
      window.setTimeout(() => setFlip(false), 1100)
      buzz([20, 50, 20])
      unlockTheme('rdr2')
      return
    }

    buzz(8)
    setTaps(next)
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
    </button>
  )
}
