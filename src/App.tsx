import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { configured } from './config'
import AuthScreen from './components/AuthScreen'
import Splash, { prefersReducedMotion } from './components/Splash'
import Logo from './components/Logo'
import Authed from './Authed'

const SPLASH_MS = 6000

function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <Logo big />
      <div className="card">
        <p className="eyebrow">Service notice</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Cznnect is under maintenance</h1>
        <p className="mt-3 text-muted">
          We’re working on updates to improve your experience. Please check back later.
        </p>
        <p className="mt-4 text-sm text-muted">
          Thanks for your patience.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  // The opening animation plays for a set time, even if the app is ready sooner.
  const [held, setHeld] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setHeld(false), prefersReducedMotion() ? 1200 : SPLASH_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!configured) return
    // If the session check hangs, show the sign-in screen after 8 seconds instead of a blank page.
    const timer = setTimeout(() => setReady(true), 8000)
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer)
        setReady(true)
      })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => {
      clearTimeout(timer)
      data.subscription.unsubscribe()
    }
  }, [])

  if (!configured) return <SetupNeeded />
  if (!ready || held) return <Splash onSkip={ready ? () => setHeld(false) : undefined} />
  if (!session) return <AuthScreen />
  return <Authed userId={session.user.id} />
}
