import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QrCode from './QrCode'
import { personPayload, readableCode } from '../lib/irl'
import { myCode, type MyCode } from '../lib/irlApi'

// Your personal QR code. It holds a random handle and a code that changes every 5 minutes,
// so it never shows your name, email or account id, and an old screenshot stops working.
export default function IrlMyCode({ familyId }: { familyId: string }) {
  const [code, setCode] = useState<MyCode | null>(null)
  const [endsAt, setEndsAt] = useState(0)
  const [left, setLeft] = useState(0)
  const [error, setError] = useState('')
  const [big, setBig] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    window.clearTimeout(timer.current)
    const r = await myCode(familyId)
    if (!r.ok) {
      setError(r.message)
      timer.current = window.setTimeout(load, 15000)
      return
    }
    setError('')
    setCode(r.data)
    setEndsAt(Date.now() + r.data.seconds_left * 1000)
    // Fetch the next code just after this one runs out.
    timer.current = window.setTimeout(load, Math.max(5000, r.data.seconds_left * 1000 + 1500))
  }, [familyId])

  useEffect(() => {
    load()
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  useEffect(() => {
    if (!endsAt) return
    const tick = () => setLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [endsAt])

  useEffect(() => {
    if (!big) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBig(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [big])

  if (error && !code) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
        <button className="btn btn-plain" onClick={load}>
          Try again
        </button>
      </div>
    )
  }

  if (!code) return <p className="py-10 text-center text-muted">Making your code...</p>

  const payload = personPayload(code.handle, code.code)
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="flex flex-col items-center gap-3">
      <button type="button" onClick={() => setBig(true)} aria-label="Enlarge your link code" className="flex flex-col items-center gap-1">
        <QrCode text={payload} size={200} label="Your personal QR code. Another cousin can scan it." />
        <span className="text-xs font-bold uppercase tracking-widest text-muted">Tap to enlarge</span>
      </button>
      <p className="select-all text-center font-mono text-sm font-semibold tracking-wider text-accent-text">{readableCode(payload)}</p>
      <p className="text-center text-sm text-muted">
        New code in {mm}:{ss}
      </p>
      {error && (
        <p role="status" className="text-center text-sm font-bold text-danger">
          {error}
        </p>
      )}
      {big &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your link code"
            className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto px-6 pb-8 pt-4"
            style={{
              background: 'color-mix(in srgb, var(--page) 84%, transparent)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              color: 'var(--ink)',
            }}
          >
            <div className="w-full">
              <button
                type="button"
                onClick={() => setBig(false)}
                aria-label="Back"
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--ink) 12%, transparent)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-display mt-6 text-4xl font-extrabold">Link code</h2>
              <p className="mt-3 text-center text-muted">Scan with another device to link</p>
            </div>
            <div className="mt-8 w-full max-w-[360px]">
              <QrCode text={payload} size={360} label="Your personal QR code, enlarged. Another cousin can scan it." />
            </div>
            <p className="mt-6 select-all text-center font-mono text-lg font-bold tracking-wider">{readableCode(payload)}</p>
            <p className="mt-2 text-center text-sm text-muted">
              New code in {mm}:{ss}
            </p>
          </div>,
          document.body,
        )}
    </div>
  )
}
