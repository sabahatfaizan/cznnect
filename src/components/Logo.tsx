import { useId } from 'react'

// Cznnect's mark: an O and a Z in one square. The sharp, thick frame is the O, the diagonal bisector is
// the Z, and the diagonal joins two opposite corners, so "Czn" and "connect" read as one shape.
// The colours are a gradient taken from the chosen app icon (see appIcon.ts).
// With loop, the square keeps spinning and slows to rest; as it rests the diagonal connects, then it spins on.
export function Mark({ className = '', loop = false }: { className?: string; loop?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className + (loop ? ' mark-loop' : '')} fill="none">
      <defs>
        <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="4" y1="4" x2="60" y2="60">
          <stop offset="0" style={{ stopColor: 'var(--logo-a, #5aa9ff)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-b, #1f3fd0)' }} />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <rect x="4" y="4" width="56" height="56" />
        </clipPath>
      </defs>
      <path d="M4 4H60V60H4Z M15 15V49H49V15Z" fillRule="evenodd" fill={`url(#g${id})`} />
      <g clipPath={`url(#c${id})`}>
        <path d="M0 64L64 0" pathLength={1} className="mark-bar" stroke={`url(#g${id})`} strokeWidth="11" strokeLinecap="butt" />
      </g>
    </svg>
  )
}

// The wordmark reads C_nnect, where the mark stands in for the "z": Cznnect and Connect in one word.
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={'wordmark ' + className} role="img" aria-label="Cznnect">
      <span aria-hidden="true" className="wordmark-c">C</span>
      <Mark className="wordmark-mark" />
      <span aria-hidden="true">nnect</span>
    </span>
  )
}

export default function Logo({ big = false }: { big?: boolean }) {
  return <Wordmark className={'font-display font-extrabold ' + (big ? 'text-4xl' : 'text-xl')} />
}
