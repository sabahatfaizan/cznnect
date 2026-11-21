import { useId, type CSSProperties } from 'react'

// Cznnect's mark: an O and a Z in one square. The sharp, thick frame is the O, the diagonal bisector is
// the Z, and the diagonal joins two opposite corners, so "Czn" and "connect" read as one shape.
// It is shaded like polished enamel: a colour gradient, a bright top-left and deep bottom-right, a soft gloss, a lit
// rim and a shadow underneath. The colours come from the chosen app icon (see appIcon.ts).
// With loop, the square spins and slows to rest; as it rests the diagonal connects, then it spins on.
export function Mark({ className = '', loop = false }: { className?: string; loop?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ring = 'M6 6H58V58H6Z M16 16V48H48V16Z'
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className + (loop ? ' mark-loop' : '')} fill="none">
      <defs>
        <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="58">
          <stop offset="0" style={{ stopColor: 'var(--logo-hi, #9fd0ff)' }} />
          <stop offset="0.42" style={{ stopColor: 'var(--logo-a, #5aa9ff)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-b, #1f3fd0)' }} />
        </linearGradient>
        {/* Light from the top-left, shade to the bottom-right. */}
        <linearGradient id={`s${id}`} gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="58">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.46" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.54" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#050a28" stopOpacity="0.42" />
        </linearGradient>
        <radialGradient id={`r${id}`} gradientUnits="userSpaceOnUse" cx="20" cy="14" r="30">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`m${id}`} gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="58">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <rect x="6" y="6" width="52" height="52" />
        </clipPath>
        {/* The shape as a mask, so the shading is painted once and only on the mark (the diagonal moves with it). */}
        <mask id={`k${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <path d={ring} fillRule="evenodd" fill="#fff" />
          <g clipPath={`url(#c${id})`}>
            <path d="M0 64L64 0" pathLength={1} className="mark-bar" stroke="#fff" strokeWidth="10" strokeLinecap="butt" />
          </g>
        </mask>
        <filter id={`f${id}`} filterUnits="userSpaceOnUse" x="0" y="0" width="64" height="64" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.7" style={{ floodColor: 'var(--logo-edge, #0b1a5c)' }} floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#f${id})`}>
        <path d={ring} fillRule="evenodd" fill={`url(#g${id})`} />
        <g clipPath={`url(#c${id})`}>
          <path d="M0 64L64 0" pathLength={1} className="mark-bar" stroke={`url(#g${id})`} strokeWidth="10" strokeLinecap="butt" />
        </g>
      </g>
      <g mask={`url(#k${id})`}>
        <rect width="64" height="64" fill={`url(#s${id})`} />
        <rect width="64" height="64" fill={`url(#r${id})`} />
        <path d={ring} fillRule="evenodd" stroke={`url(#m${id})`} strokeWidth="2.6" />
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
export function Wordmark({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={'wordmark ' + className} style={style} role="img" aria-label="Cznnect">
      <span aria-hidden="true" className="wordmark-c">C</span>
      <Mark className="wordmark-mark" />
      <span aria-hidden="true">nnect</span>
    </span>
  )
}

export default function Logo({ big = false }: { big?: boolean }) {
  return <Wordmark className={'font-display font-extrabold ' + (big ? 'text-4xl' : 'text-xl')} />
}
