import { useId } from 'react'

// Cznnect's mark: an O and a Z in one square. The sharp, thick frame is the O, the diagonal bisector is
// the Z, and the diagonal joins two opposite corners, so "Czn" and "connect" read as one shape.
// It is a gradient with a dark outline around every edge (outside and around the inner opening) and a
// thin light rim just inside them. The colours come from the chosen app icon (see appIcon.ts).
// With loop, the square spins and slows to rest; as it rests the diagonal connects, then it spins on.
export function Mark({ className = '', loop = false }: { className?: string; loop?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className + (loop ? ' mark-loop' : '')} fill="none">
      <defs>
        <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="58">
          <stop offset="0" style={{ stopColor: 'var(--logo-hi, #9fd0ff)' }} />
          <stop offset="0.38" style={{ stopColor: 'var(--logo-a, #5aa9ff)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-b, #1f3fd0)' }} />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <rect x="6" y="6" width="52" height="52" />
        </clipPath>
        {/* Outline: the shape grown by 1.5 and flooded dark. Rim: a light band just inside every edge. */}
        <filter id={`f${id}`} filterUnits="userSpaceOnUse" x="0" y="0" width="64" height="64" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="grow" />
          <feFlood style={{ floodColor: 'var(--logo-edge, #0b1a5c)' }} result="edge" />
          <feComposite in="edge" in2="grow" operator="in" result="outline" />
          <feMorphology in="SourceAlpha" operator="erode" radius="1.4" result="shrunk" />
          <feComposite in="SourceAlpha" in2="shrunk" operator="out" result="band" />
          <feFlood floodColor="#ffffff" floodOpacity="0.6" result="white" />
          <feComposite in="white" in2="band" operator="in" result="rim" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="rim" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#f${id})`}>
        <path d="M6 6H58V58H6Z M16 16V48H48V16Z" fillRule="evenodd" fill={`url(#g${id})`} />
        {/* A recessed channel running round the frame, between the two borders. */}
        <path d="M9 9H55V55H9Z M13 13V51H51V13Z" fillRule="evenodd" fill="#000" fillOpacity="0.2" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.5" />
        <g clipPath={`url(#c${id})`}>
          <path d="M0 64L64 0" pathLength={1} className="mark-bar" stroke={`url(#g${id})`} strokeWidth="10" strokeLinecap="butt" />
        </g>
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
