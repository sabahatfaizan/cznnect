import { useEffect, useState } from 'react'
import Logo from './Logo'
import { setEntryMode, unlockAdmin } from '../lib/entryMode'

const ADMIN_CODE = '4124'
const MAX_TRIES = 5
const LOCK_SECONDS = 30

// Asked before the Administrator view opens. Five wrong tries pause it for 30 seconds.
export default function AdminCodeGate() {
  const [code, setCode] = useState('')
  const [tries, setTries] = useState(0)
  const [wait, setWait] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  function submit(value: string) {
    if (wait > 0 || value.length < ADMIN_CODE.length) return
    if (value === ADMIN_CODE) {
      unlockAdmin()
      return
    }
    const next = tries + 1
    setCode('')
    if (next >= MAX_TRIES) {
      setTries(0)
      setWait(LOCK_SECONDS)
      setMessage('Too many tries.')
    } else {
      setTries(next)
      setMessage('That code is not right.')
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 p-6">
      <Logo />
      <h1 className="font-display text-2xl font-extrabold leading-tight">Administrator code</h1>
      <input
        className="input text-center text-2xl tracking-[0.5em]"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        maxLength={ADMIN_CODE.length}
        aria-label="Administrator code"
        value={code}
        disabled={wait > 0}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, ADMIN_CODE.length)
          setCode(v)
          setMessage('')
          if (v.length === ADMIN_CODE.length) submit(v)
        }}
      />
      <p role="status" className="min-h-5 text-center text-sm font-semibold text-danger">
        {wait > 0 ? `${message} Try again in ${wait}s.` : message}
      </p>
      <button type="button" className="btn btn-plain" onClick={() => setEntryMode(null)}>Back</button>
    </div>
  )
}
