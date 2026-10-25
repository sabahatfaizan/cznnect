import { useEffect, useRef, type ReactNode } from 'react'

// A panel that slides up from the bottom, over the page. Closes on Escape or a tap outside.
export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  // Keep the newest onClose without re-running the effect below, which would steal focus.
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = before
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="sheet-scrim fixed inset-0 z-40 flex items-end justify-center bg-black/45" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="sheet-panel max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-[var(--radius-card)] border-t border-line bg-page p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold">{title}</h2>
          <button className="btn btn-plain !min-h-11 !px-4" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
