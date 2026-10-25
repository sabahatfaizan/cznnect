import { useCallback, useEffect, useRef, useState } from 'react'
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
      <QrCode text={payload} label="Your personal QR code. Another cousin can scan it." />
      <p className="select-all text-center font-mono text-sm font-semibold tracking-wider text-accent-text">{readableCode(payload)}</p>
      <p className="text-center text-sm text-muted">
        New code in {mm}:{ss}. It refreshes by itself, so keep this screen open while your cousin scans.
      </p>
      {error && (
        <p role="status" className="text-center text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
