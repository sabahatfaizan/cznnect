// Cznnect's mark: two bold, rounded connection arcs with deliberately detached people-dots.
export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className} fill="none">
      <path d="M27 15C20 9 11 12 8 22C4 33 9 44 18 49C22 52 26 51 29 48" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M37 19C42 26 48 33 54 35C57 36 57 41 53 46C48 53 39 54 32 49" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35" cy="11" r="4.5" fill="currentColor" />
      <circle cx="34" cy="33" r="4.5" fill="currentColor" />
      <circle cx="29" cy="56" r="4.5" fill="currentColor" />
    </svg>
  )
}

export default function Logo({ big = false }: { big?: boolean }) {
  return (
    <div className={'inline-flex items-center gap-2 font-display font-extrabold ' + (big ? 'text-4xl' : 'text-xl')} aria-label="Cznnect">
      <Mark className="size-[1.15em] flex-none text-accent-text" />
      <span aria-hidden="true"><span className="text-accent-text">Czn</span>nect</span>
    </div>
  )
}
