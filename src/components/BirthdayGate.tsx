import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../supabase'
import Logo from './Logo'
import Splash from './Splash'
import { BIRTHDAY_MIN, checkBirthday, todayISO } from '../lib/birthdayInput'
import { friendlyError } from '../lib/offline'

// Everyone must have a birthday on their profile. New accounts give it when they sign up; this is for anyone who signed in
// without one (an account from before this rule), who is asked once, before anything else. If the check cannot be made
// (no internet, an older database) nobody is locked out.
export default function BirthdayGate({ userId, live, children }: { userId: string; live: boolean; children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'missing' | 'ok'>(live ? 'checking' : 'ok')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!live) { setState('ok'); return }
    let alive = true
    ;(async () => {
      try {
        const r = await supabase.from('profiles').select('birthday').eq('id', userId).maybeSingle()
        if (!alive) return
        setState(!r.error && r.data && !r.data.birthday ? 'missing' : 'ok')
      } catch {
        if (alive) setState('ok')
      }
    })()
    return () => { alive = false }
  }, [userId, live])

  async function save(e: FormEvent) {
    e.preventDefault()
    const problem = checkBirthday(value)
    if (problem) { setError(problem); return }
    setBusy(true)
    setError('')
    try {
      const r = await supabase.from('profiles').update({ birthday: value }).eq('id', userId)
      if (r.error) setError(friendlyError(r.error.message))
      else setState('ok')
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err)))
    }
    setBusy(false)
  }

  if (state === 'checking') return <Splash />
  if (state === 'ok') return <>{children}</>
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-5 py-10">
      <div className="flex justify-center"><Logo /></div>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-xl font-bold">When is your birthday?</h1>
          <p className="mt-1 text-sm text-muted">Cznnect uses it to tell your family and to send you a birthday wish. It is needed to carry on.</p>
        </div>
        <div>
          <label className="label" htmlFor="gate-birthday">Birthday</label>
          <input id="gate-birthday" type="date" className="input" value={value} min={BIRTHDAY_MIN} max={todayISO()} onChange={(e) => setValue(e.target.value)} required />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Saving...' : 'Continue'}</button>
        <button type="button" className="btn btn-plain w-full !text-sm" onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </form>
    </main>
  )
}
