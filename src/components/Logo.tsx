import { useId, type CSSProperties } from 'react'
import { appName, useCachedPlus } from '../lib/appName'
import { MARK_HOLE, MARK_OUTER } from '../lib/markShape'

// Cznnect's mark: an O and a Z in one square. The softly rounded frame is the O, the diagonal bisector is
// the Z, and the diagonal joins two opposite corners, so "Czn" and "connect" read as one shape.
// It matches the app icon: one soft gradient (top to bottom), a lighter highlight at the top right and a
// gentle glow at the bottom. The colours come from the chosen theme (see index.css).
// With loop, the square spins and slows to rest; as it rests the diagonal connects, then it spins on.
const OUTER = MARK_OUTER
const HOLE = MARK_HOLE
export function Mark({ className = '', loop = false }: { className?: string; loop?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className + (loop ? ' mark-loop' : '')} fill="none">
      <defs>
        <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="58">
          <stop offset="0" style={{ stopColor: 'var(--logo-hi, #5b97ff)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--logo-a, #3f7ff5)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-b, #4a78f0)' }} />
        </linearGradient>
        <radialGradient id={`l${id}`} gradientUnits="userSpaceOnUse" cx="34" cy="62" r="30">
          <stop offset="0" style={{ stopColor: 'var(--logo-glow, #b7a6ff)', stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-glow, #b7a6ff)', stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={`h${id}`} gradientUnits="userSpaceOnUse" cx="54" cy="10" r="26">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`c${id}`}>
          <path d={OUTER} />
        </clipPath>
      </defs>
      <path d={OUTER + HOLE} fill={`url(#g${id})`} />
      <path d={OUTER + HOLE} fill={`url(#l${id})`} />
      <path d={OUTER + HOLE} fill={`url(#h${id})`} />
      <g clipPath={`url(#c${id})`}>
        <path d="M0 64L64 0" pathLength={1} className="mark-bar" stroke={`url(#g${id})`} strokeWidth="10" strokeLinecap="butt" />
        <path d="M0 64L64 0" pathLength={1} className="mark-bar" stroke={`url(#l${id})`} strokeWidth="10" strokeLinecap="butt" />
        <path d="M0 64L64 0" pathLength={1} className="mark-bar" stroke={`url(#h${id})`} strokeWidth="10" strokeLinecap="butt" />
      </g>
      {/* Theme extras. Hidden unless the matching theme is active (see index.css). */}
      <g className="mk-deco mk-rdr2">
        {([[11, 11], [53, 11], [11, 53], [53, 53]] as const).map(([x, y]) => (
          <circle key={x + '-' + y} cx={x} cy={y} r="1.6" fill="#f1dfb8" stroke="#120805" strokeWidth="0.8" />
        ))}
      </g>
    </svg>
  )
}

// The wordmark reads C_nnect, where the mark stands in for the "z": Cznnect and Connect in one word.
// plain: always the plain name, for things that advertise the app to people who do not have Cznnect+ (the share banner).
export function Wordmark({ className = '', style, plain = false }: { className?: string; style?: CSSProperties; plain?: boolean }) {
  const plus = useCachedPlus() && !plain // Cznnect+ adds a small + after the name
  return (
    <span className={'wordmark ' + className} style={style} role="img" aria-label={appName(plus)}>
      <span aria-hidden="true" className="wordmark-c">C</span>
      <Mark className="wordmark-mark" />
      <span aria-hidden="true">nnect</span>
      {plus && <span aria-hidden="true" className="wordmark-plus">+</span>}
    </span>
  )
}

export default function Logo({ big = false }: { big?: boolean }) {
  return <Wordmark className={'font-display font-extrabold ' + (big ? 'text-4xl' : 'text-xl')} />
}
