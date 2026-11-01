import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { configured } from './config'
import AuthScreen from './components/AuthScreen'
import Splash, { prefersReducedMotion } from './components/Splash'
import Logo from './components/Logo'
import { Icon } from './components/Icons'
import Authed from './Authed'
import { isOwnerEmail } from './owner'

const SPLASH_MS = 4500
const MAINTENANCE_PIN = '4124'
// Always the newest APK: the build workflow republishes it under this fixed name on every push to main.
const LATEST_APK_URL = 'https://github.com/sabahatfaizan/cznnect/releases/download/latest-apk/cznnect.apk'

// A plain white page that explains how to get the new app. Colours are fixed so it stays white in every theme.
function InstallHelp({ onClose }: { onClose: () => void }) {
  const step = 'flex gap-3'
  const num = 'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-sm font-bold text-white'
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#ffffff', color: '#111111' }}>
      <div className="mx-auto max-w-md p-6 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="mb-6 flex items-center gap-1 text-sm font-semibold underline underline-offset-4" style={{ color: '#111111' }}>
          <Icon name="back" size={18} />
          Back
        </button>
        <h1 className="font-display text-2xl font-bold">How to get the new app</h1>
        <p className="mt-2" style={{ color: '#555555' }}>Cznnect is being updated. Follow the steps for your device.</p>

        <h2 className="mt-8 text-lg font-bold">Android phone or tablet</h2>
        <ol className="mt-3 flex flex-col gap-3">
          <li className={step}><span className={num}>1</span><span>Go back and tap <b>Download the new app</b>.</span></li>
          <li className={step}><span className={num}>2</span><span>If you already have Cznnect, uninstall it first. This is only needed once, and your data is kept online.</span></li>
          <li className={step}><span className={num}>3</span><span>Open the downloaded file. If Android asks, allow your browser to install apps, then tap <b>Install</b>.</span></li>
          <li className={step}><span className={num}>4</span><span>Open Cznnect. Later updates install over the top.</span></li>
        </ol>

        <h2 className="mt-8 text-lg font-bold">iPhone or iPad</h2>
        <p className="mt-2" style={{ color: '#555555' }}>Apple devices cannot install the Android file. Use the web app instead:</p>
        <ol className="mt-3 flex flex-col gap-3">
          <li className={step}><span className={num}>1</span><span>Open the Cznnect website in <b>Safari</b>.</span></li>
          <li className={step}><span className={num}>2</span><span>Tap the <b>Share</b> button.</span></li>
          <li className={step}><span className={num}>3</span><span>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
        </ol>

        <h2 className="mt-8 text-lg font-bold">Trouble installing?</h2>
        <ul className="mt-3 list-disc pl-5" style={{ color: '#333333' }}>
          <li>“App not installed”: uninstall the old Cznnect, then try again.</li>
          <li>Download opens an old file: check your Downloads folder for the newest one.</li>
        </ul>
      </div>
    </div>
  )
}

function ServiceNotice({ message, onUnlock, showApk = false }: { message: string; onUnlock?: () => void; showApk?: boolean }) {
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [showPinUnlock, setShowPinUnlock] = useState(false)
  const [logoTaps, setLogoTaps] = useState(0)
  const [showHelp, setShowHelp] = useState(false)

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

  if (showHelp) return <InstallHelp onClose={() => setShowHelp(false)} />

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <button type="button" className="mx-auto block cursor-default rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" aria-label="Cznnect logo" onClick={handleLogoTap}>
        <Logo big />
      </button>
      <div className="card">
        <h1 className="font-display text-2xl font-bold">Cznnect is getting an update</h1>
        <p className="mt-3 text-muted">{message}</p>
        {showApk && (
          <div className="mt-5">
            <a
              className="flex items-center gap-4 rounded-2xl border border-line p-4 no-underline transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              href={LATEST_APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              download="cznnect.apk"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink"><Icon name="download" size={24} /></span>
              <span className="font-bold">Download the new app</span>
            </a>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-accent-text underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Icon name="info" size={16} />
              Learn more
            </button>
          </div>
        )}
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
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string; apk: boolean } | null>(null)
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
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
      if (alive && data) setMaintenance({ enabled: Boolean(data.maintenance_enabled), message: data.maintenance_message || 'We’re improving Cznnect. Please check back soon.', apk: data.apk_download_enabled !== false })
    }
    void load()
    const channel = supabase.channel('app-maintenance-status').on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
      const row = payload.new as { maintenance_enabled?: boolean; maintenance_message?: string; apk_download_enabled?: boolean }
      if (alive && typeof row.maintenance_enabled === 'boolean') setMaintenance({ enabled: row.maintenance_enabled, message: row.maintenance_message || 'We’re improving Cznnect. Please check back soon.', apk: row.apk_download_enabled !== false })
    }).subscribe()
    const poll = setInterval(load, 20000)
    return () => { alive = false; clearInterval(poll); void supabase.removeChannel(channel) }
  }, [])

  if (!configured) return <ServiceNotice message="Cznnect is not configured yet. Please check back later." />
  if (!ready || held) return <Splash />
  const isOwner = isOwnerEmail(session?.user.email)
  if (maintenance?.enabled && !isOwner && !pinUnlocked) {
    return <ServiceNotice message={maintenance.message} showApk={maintenance.apk} onUnlock={() => setPinUnlocked(true)} />
  }
  if (!session) return <AuthScreen />
  return <Authed userId={session.user.id} email={session.user.email ?? ''} />
}
