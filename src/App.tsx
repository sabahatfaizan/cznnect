import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { configured } from './config'
import AuthScreen from './components/AuthScreen'
import Splash, { prefersReducedMotion } from './components/Splash'
import Logo from './components/Logo'
import Authed from './Authed'

const SPLASH_MS = 6000
const OWNER_EMAIL = 'faizanplayz11@gmail.com'

function ServiceNotice({ message, onOwnerSignIn }: { message: string; onOwnerSignIn?: () => void }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <Logo big />
      <div className="card">
        <p className="eyebrow">Service notice</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Cznnect is getting an update</h1>
        <p className="mt-3 text-muted">{message}</p>
        <p className="mt-4 text-sm text-muted">Thanks for your patience.</p>
        {onOwnerSignIn && <button className="btn btn-plain mt-5 w-full" onClick={onOwnerSignIn}>Owner sign in</button>}
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [held, setHeld] = useState(true)
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null)
  const [ownerLogin, setOwnerLogin] = useState(false)

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
  if (!ready || held) return <Splash onSkip={ready ? () => setHeld(false) : undefined} />
  const isOwner = session?.user.email?.toLowerCase() === OWNER_EMAIL
  if (maintenance?.enabled && !isOwner && !ownerLogin) {
    return <ServiceNotice message={maintenance.message} onOwnerSignIn={() => setOwnerLogin(true)} />
  }
  if (!session) return <AuthScreen />
  return <Authed userId={session.user.id} />
}
