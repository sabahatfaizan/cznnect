import { useEffect, useState } from 'react'
import Logo from './Logo'
import { Icon, type IconName } from './Icons'
import { signOut } from '../lib/push'
import { ADMIN_PIN, setEntryMode, takeWantAdmin, type EntryMode } from '../lib/entryMode'

const MAX_TRIES = 5
const LOCK_MS = 30_000

// Shown only to the owner after signing in: one email, two ways in. The Administrator side asks for a code first.
export default function EntryChooser() {
  const [askPin, setAskPin] = useState(() => takeWantAdmin())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [tries, setTries] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [, tick] = useState(0)

  const locked = Date.now() < lockedUntil
  useEffect(() => {
    if (!locked) return
    const id = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [locked])

  function choose(mode: EntryMode) {
    if (mode === 'admin') { setAskPin(true); return }
    setEntryMode('family')
  }

  function check(value: string) {
    if (locked) return
    if (value === ADMIN_PIN) { setEntryMode('admin'); return }
    const n = tries + 1
    setTries(n)
    setPin('')
    if (n >= MAX_TRIES) {
      setTries(0)
      setLockedUntil(Date.now() + LOCK_MS)
      setError('Too many tries. Wait 30 seconds.')
    } else {
      setError('Wrong code. Try again.')
    }
  }

  const options: Array<{ mode: EntryMode; icon: IconName; title: string; hint: string }> = [
    { mode: 'admin', icon: 'admin', title: 'Administrator', hint: 'Supervise and control the whole app' },
    { mode: 'family', icon: 'group', title: 'Family', hint: 'Use Cznnect as a family member' },
  ]

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col p-6">
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="flex flex-col gap-2">
          <Logo />
          <h1 className="font-display text-2xl font-extrabold leading-tight">{askPin ? 'Administrator code' : 'How do you want to enter?'}</h1>
          <p className="text-sm text-muted">{askPin ? 'Enter the 4-digit code to open the Administrator side.' : 'Same account, two ways in. You can switch later from the menu.'}</p>
        </div>

        {askPin ? (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); check(pin) }}>
            <label className="label" htmlFor="admin-entry-pin">Code</label>
            <input
              id="admin-entry-pin"
              className="input text-center tracking-[0.45em]"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="off"
              autoFocus
              disabled={locked}
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                setPin(v)
                setError('')
                if (v.length === 4) check(v)
              }}
              placeholder="••••"
              aria-describedby={error ? 'admin-entry-error' : undefined}
            />
            {error && <p id="admin-entry-error" role="alert" className="text-sm text-danger">{error}</p>}
            <button type="button" className="btn btn-plain !min-h-11 w-full !text-sm" onClick={() => { setAskPin(false); setPin(''); setError('') }}>Back</button>
          </form>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {options.map((o) => (
                <button key={o.mode} type="button" className="card flex items-center gap-4 text-left transition active:scale-[0.99]" onClick={() => choose(o.mode)}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text"><Icon name={o.icon} size={24} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-bold leading-tight">{o.title}</span>
                    <span className="block text-sm text-muted">{o.hint}</span>
                  </span>
                  <span aria-hidden="true" className="menu-chevron">›</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-plain !min-h-11 w-full !text-sm" onClick={() => void signOut()}>Sign out</button>
          </>
        )}
      </div>
      <p className="pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-muted">© 2026 Sabahat Faizan. All rights reserved.</p>
    </div>
  )
}
