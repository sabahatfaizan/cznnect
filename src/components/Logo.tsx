// The Cznnect mark: a "C" made of three connected people. The wordmark highlights CZN.
export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className} fill="currentColor">
      <path
        d="M46.14 17.86A20 20 0 1 0 46.14 46.14"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="46.14" cy="17.86" r="7" />
      <circle cx="12" cy="32" r="7" />
      <circle cx="46.14" cy="46.14" r="7" />
    </svg>
  )
}

export default function Logo({ big = false }: { big?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 font-display font-extrabold ${big ? 'text-4xl' : 'text-xl'}`}
      aria-label="Cznnect"
    >
      <Mark className="size-[1.15em] flex-none text-accent-text" />
      <span aria-hidden="true">
        <span className="text-accent-text">CZN</span>nect
      </span>
    </div>
  )
}
