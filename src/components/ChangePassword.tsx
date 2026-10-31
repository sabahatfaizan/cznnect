import { useState } from 'react'
import { supabase } from '../supabase'

// Change the sign-in password. The current password is checked first, so a phone left unlocked can't be used to take over the account.
export default function ChangePassword({ email, onDone }: { email: string; onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (next.length < 6) return setError('The new password needs at least 6 characters.')
    if (next !== again) return setError('The two new passwords do not match.')
    if (next === current) return setError('Pick a password different from the current one.')
    setBusy(true)
    const check = await supabase.auth.signInWithPassword({ email, password: current })
    if (check.error) {
      setBusy(false)
      return setError('The current password is not right.')
    }
    const { error: err } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (err) return setError(err.message)
    setDone(true)
    setCurrent(''); setNext(''); setAgain('')
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="font-semibold">Your password was changed.</p>
        <button className="btn btn-primary" onClick={onDone}>Done</button>
      </div>
    )
  }

  const type = show ? 'text' : 'password'
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
      <div>
        <label className="label" htmlFor="pw-cur">Current password</label>
        <input id="pw-cur" type={type} className="input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </div>
      <div>
        <label className="label" htmlFor="pw-new">New password</label>
        <input id="pw-new" type={type} className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
      </div>
      <div>
        <label className="label" htmlFor="pw-again">New password again</label>
        <input id="pw-again" type={type} className="input" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" minLength={6} required />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show passwords
      </label>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <button className="btn btn-primary" disabled={busy || !email}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  )
}
