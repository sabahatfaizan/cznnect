import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { configured } from './config'
import AuthScreen from './components/AuthScreen'
import Splash, { prefersReducedMotion } from './components/Splash'
import Logo from './components/Logo'
import Authed from './Authed'
import { isOwnerEmail } from './owner'

const SPLASH_MS = 4500
const MAINTENANCE_PIN = '4124'

function ServiceNotice({ message, onUnlock }: { message: string; onUnlock?: () => void }) {
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [showPinUnlock, setShowPinUnlock] = useState(false)
  const [logoTaps, setLogoTaps] = useState(0)

  function handleLogoTap() {
    if (!onUnlock || showPinUnlock) return
    const next = logoTaps + 1
    setLogoTaps(next)
    if (next >= 5) setShowPinUnlock(true)
  }

  function submitPin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pin === MAINTENANCE_PIN) {
      setPinError('')
      onUnlock?.()
    } else {
      setPinError('Incorrect PIN. Please try again.')
      setPin('')
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <button type="button" className="mx-auto block cursor-default rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" aria-label="Cznnect logo" onClick={handleLogoTap}>
        <Logo big />
      </button>
      <div className="card">
        <h1 className="font-display text-2xl font-bold">Cznnect is getting an update</h1>
        <p className="mt-3 text-muted">{message}</p>
        {onUnlock && showPinUnlock && (
          <form className="mt-5 flex flex-col gap-3" onSubmit={submitPin}>
            <label className="label" htmlFor="maintenance-pin">Have an access PIN?</label>
            <input
              id="maintenance-pin"
              className="input text-center tracking-[0.45em]"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="off"
              aria-describedby={pinError ? 'maintenance-pin-error' : undefined}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
              placeholder="••••"
              required
            />
            {pinError && <p id="maintenance-pin-error" role="alert" className="text-sm text-danger">{pinError}</p>}
            <button className="btn btn-primary w-full" type="submit">Unlock Cznnect</button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [held, setHeld] = useState(true)
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null)
  const [pinUnlocked, setPinUnlocked] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setHeld(false), prefersReducedMotion() ? 1200 : SPLASH_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!configured) return
    const timer = setTimeout(() => setReady(true), 8000)
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => {}).finally(() => {
      clearTimeout(timer)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => { clearTimeout(timer); data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!configured) return
    let alive = true
    const load = async () => {
      const { data } = await supabase.from('app_settings').select('maintenance_enabled, maintenance_message').eq('id', 1).maybeSingle()
      if (alive && data) setMaintenance({ enabled: Boolean(data.maintenance_enabled), message: data.maintenance_message || 'We’re improving Cznnect. Please check back soon.' })
    }
    void load()
    const channel = supabase.channel('app-maintenance-status').on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
      const row = payload.new as { maintenance_enabled?: boolean; maintenance_message?: string }
      if (alive && typeof row.maintenance_enabled === 'boolean') setMaintenance({ enabled: row.maintenance_enabled, message: row.maintenance_message || 'We’re improving Cznnect. Please check back soon.' })
    }).subscribe()
    const poll = setInterval(load, 20000)
    return () => { alive = false; clearInterval(poll); void supabase.removeChannel(channel) }
  }, [])

  if (!configured) return <ServiceNotice message="Cznnect is not configured yet. Please check back later." />
  if (!ready || held) return <Splash />
  const isOwner = isOwnerEmail(session?.user.email)
  if (maintenance?.enabled && !isOwner && !pinUnlocked) {
    return <ServiceNotice message={maintenance.message} onUnlock={() => setPinUnlocked(true)} />
  }
  if (!session) return <AuthScreen />
  return <Authed userId={session.user.id} email={session.user.email ?? ''} />
}
