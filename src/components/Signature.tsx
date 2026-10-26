import { useState } from 'react'

const NAME = 'Sabahat Faizan'

// "Made by Sabahat Faizan": the letters rise in one by one, shimmer in a slow wave, and bounce when tapped.
export default function Signature({ className = '' }: { className?: string }) {
  const [pops, setPops] = useState(0)

  function tap() {
    setPops((n) => n + 1)
    try {
      navigator.vibrate?.(12)
    } catch {
      // Not every phone can vibrate.
    }
  }

  return (
    <button type="button" className={'signature ' + className} onClick={tap} aria-label="Made by Sabahat Faizan. Tap for a little bounce.">
      <span className="signature-by" aria-hidden="true">Made by</span>
      <span key={pops} aria-hidden="true" className={'signature-name ' + (pops > 0 ? 'signature-pop' : '')}>
        {[...NAME].map((ch, i) => (
          <span key={i} className="signature-ch" style={{ ['--i' as string]: i }}>
            {ch === ' ' ? '\u00a0' : ch}
          </span>
        ))}
      </span>
    </button>
  )
}
