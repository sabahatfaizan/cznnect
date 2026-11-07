import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useBackClose } from '../lib/backStack'

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
  const [closing, setClosing] = useState(false)
  const leaving = useRef(false)
  // Slides the panel away first, then tells the page to close it. Skipped for people who reduce motion.
  const requestClose = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { close.current(); return }
    setClosing(true)
    window.setTimeout(() => close.current(), 200)
  }, [])
  useBackClose(requestClose)

  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = before
      window.removeEventListener('keydown', onKey)
    }
  }, [requestClose])

  return (
    <div className={`sheet-scrim fixed inset-0 z-40 flex items-end justify-center bg-black/45 ${closing ? 'is-closing' : ''}`} onClick={requestClose}>
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
          <button className="btn btn-plain !min-h-11 !px-4" onClick={requestClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
