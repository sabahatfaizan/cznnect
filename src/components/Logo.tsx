// Cznnect's mark: an O and a Z in one square. The frame is the O, the diagonal bisector is the Z,
// and the diagonal joins two opposite corners, so "Czn" and "connect" read as one shape.
// With animated, the square spins and slows to rest while the diagonal draws across to the far corner.
export function Mark({ className = '', animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className + (animated ? ' mark-spin' : '')} fill="none">
      <rect x="8" y="8" width="48" height="48" rx="2" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
      <path
        d="M8 56L56 8"
        pathLength={1}
        className={animated ? 'mark-bar' : undefined}
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  )
}

// The wordmark reads C_nnect, where the mark stands in for the "z": Cznnect and Connect in one word.
export function Wordmark({ className = '', animated = false }: { className?: string; animated?: boolean }) {
  return (
    <span className={'wordmark ' + className} role="img" aria-label="Cznnect">
      <span aria-hidden="true" className="text-accent-text">C</span>
      <Mark animated={animated} className="wordmark-mark text-accent-text" />
      <span aria-hidden="true">nnect</span>
    </span>
  )
}

export default function Logo({ big = false }: { big?: boolean }) {
  return <Wordmark className={'font-display font-extrabold ' + (big ? 'text-4xl' : 'text-xl')} />
}
