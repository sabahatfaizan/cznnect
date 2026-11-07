import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QrCode from './QrCode'
import { personPayload, readableCode } from '../lib/irl'
import { myCode, refreshCode, type MyCode } from '../lib/irlApi'
import { Icon } from './Icons'
import { useBackClose } from '../lib/backStack'

// Your personal QR code. It holds a random handle and a code that changes every 5 minutes,
// so it never shows your name, email or account id, and an old screenshot stops working.
export default function IrlMyCode({ familyId }: { familyId: string }) {
  const [code, setCode] = useState<MyCode | null>(null)
  const [endsAt, setEndsAt] = useState(0)
  const [left, setLeft] = useState(0)
  const [error, setError] = useState('')
  const [big, setBig] = useState(false)
  const [closing, setClosing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  // Closes the enlarged code with a short fade, unless the person asked their phone to reduce motion.
  const closeBig = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setBig(false); return }
    setClosing(true)
    window.setTimeout(() => { setBig(false); setClosing(false) }, 200)
  }, [])
  useBackClose(closeBig, big)

  const load = useCallback(async (fresh = false) => {
    window.clearTimeout(timer.current)
    // Refresh asks for a brand new code. If the server has not been updated for that yet, the normal code is shown.
    let r = fresh ? await refreshCode(familyId) : await myCode(familyId)
    if (fresh && !r.ok) r = await myCode(familyId)
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

  async function refresh() {
    if (refreshing) return
    setRefreshing(true)
    await load(true)
    setRefreshing(false)
  }

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
      if (e.key === 'Escape') closeBig()
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
        <button className="btn btn-plain" onClick={() => void load()}>
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
        <span key={payload} className="qr-swap"><QrCode text={payload} size={200} label="Your personal QR code. Another cousin can scan it." /></span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted">Tap to enlarge</span>
      </button>
      <p className="select-all text-center font-mono text-sm font-semibold tracking-wider text-accent-text">{readableCode(payload)}</p>
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>New code in {mm}:{ss}</span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-label="Get a new code now"
          title="Get a new code now"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-2 text-current transition hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
        >
          <span className={refreshing ? 'animate-spin' : ''}><Icon name="refresh" size={18} /></span>
        </button>
      </div>
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
            onClick={closeBig}
            className={`qr-zoom-scrim fixed inset-0 z-[100] ${closing ? 'is-closing' : ''} flex items-center justify-center overflow-y-auto px-6 py-16`}
            style={{
              background: 'color-mix(in srgb, var(--page) 88%, transparent)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              color: 'var(--ink)',
            }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); closeBig() }}
              aria-label="Back"
              className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in srgb, var(--ink) 12%, transparent)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="qr-zoom-body flex w-full max-w-[320px] flex-col items-center text-center">
              <h2 className="font-display text-lg font-bold">Link code</h2>
              <p className="mt-1 text-sm text-muted">Scan with another device to link</p>
              <div key={payload} className="qr-swap mt-5 w-full" onClick={(e) => e.stopPropagation()}>
                <QrCode text={payload} size={320} label="Your personal QR code, enlarged. Another cousin can scan it." />
              </div>
              <p className="mt-5 select-all font-mono text-base font-bold tracking-wider" onClick={(e) => e.stopPropagation()}>{readableCode(payload)}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted" onClick={(e) => e.stopPropagation()}>
                <span>New code in {mm}:{ss}</span>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={refreshing}
                  aria-label="Get a new code now"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-current disabled:opacity-60"
                >
                  <span className={refreshing ? 'animate-spin' : ''}><Icon name="refresh" size={18} /></span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
