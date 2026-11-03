import { useOffline, isOffline, onBackOnline, whenOffline } from './lib/offline'
import { clearFamilies, readStoredUser, type StoredUser } from './lib/offlineSession'
import { clearSavedData, setSavedDataOwner } from './lib/savedData'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { SUPABASE_URL, configured } from './config'
import AuthScreen from './components/AuthScreen'
import PasswordRecoveryScreen from './components/PasswordRecoveryScreen'
import Splash, { prefersReducedMotion } from './components/Splash'
import Logo from './components/Logo'
import { Icon } from './components/Icons'
import Authed from './Authed'
import { isOwnerEmail } from './owner'
import { isPasswordRecoveryEvent } from './lib/auth'
import { LATEST_APK_URL, isInstalledWebApp, isNativeApp, parseSettings, thisBuild, type AppSettings } from './lib/appSettings'
import { deviceKind, mustUpdate } from './lib/updateGate'

const SPLASH_MS = 4500
const MAINTENANCE_PIN = '4124'
const LOGO_TAPS_FOR_PIN = 7

function withTimeout<T>(promise: PromiseLike<T>, ms = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms)
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

// A stand-in login for opening the app with no internet: just who the person is, no access token. Live data
// stays unavailable until the phone is online and the real login has been refreshed.
function offlineSession(user: StoredUser): Session {
  return { access_token: '', refresh_token: '', expires_in: 0, token_type: 'bearer', user: { id: user.id, email: user.email } } as unknown as Session
}

// A floating notice for the screens outside the app proper (sign-in, splash and so on). Inside the app the
// offline notice sits in the page itself (OfflineBanner).
function NetworkStatus() {
  const offline = useOffline()
  if (!offline) return null
  return (
    <div role="status" className="pointer-events-none fixed inset-x-3 top-[max(.75rem,env(safe-area-inset-top))] z-[100] mx-auto max-w-md rounded-xl border border-amber-500/40 bg-neutral-950 px-4 py-3 text-sm font-semibold text-white shadow-xl">
      You're offline. Most features won't work until you're back online.
    </div>
  )
}

// A plain white page that explains how to get the new app. Colours are fixed so it stays white in every theme.
function InstallHelp({ onClose, focus = 'android' }: { onClose: () => void; focus?: 'android' | 'ios' }) {
  const step = 'flex gap-3'
  const num = 'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-sm font-bold text-white'
  const android = (
    <div key="android">
      <h2 className="mt-8 text-lg font-bold">Android phone or tablet</h2>
      <ol className="mt-3 flex flex-col gap-3">
        <li className={step}><span className={num}>1</span><span>Go back and tap the download button.</span></li>
        <li className={step}><span className={num}>2</span><span>If you already have Cznnect, uninstall it first. This is only needed once, and your data is kept online.</span></li>
        <li className={step}><span className={num}>3</span><span>Open the downloaded file. If Android asks, allow your browser to install apps, then tap <b>Install</b>.</span></li>
        <li className={step}><span className={num}>4</span><span>Open Cznnect. Later updates install over the top.</span></li>
      </ol>
    </div>
  )
  const ios = (
    <div key="ios">
      <h2 className="mt-8 text-lg font-bold">iPhone or iPad</h2>
      <p className="mt-2" style={{ color: '#555555' }}>Apple devices cannot install the Android file. Add the website to your Home Screen and it works like an app:</p>
      <ol className="mt-3 flex flex-col gap-3">
        <li className={step}><span className={num}>1</span><span>Open the Cznnect website in <b>Safari</b>.</span></li>
        <li className={step}><span className={num}>2</span><span>Tap the <b>Share</b> button.</span></li>
        <li className={step}><span className={num}>3</span><span>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
      </ol>
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#ffffff', color: '#111111' }}>
      <div className="mx-auto max-w-md p-6 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="mb-6 flex items-center gap-1 text-sm font-semibold underline underline-offset-4" style={{ color: '#111111' }}>
          <Icon name="back" size={18} />
          Back
        </button>
        <h1 className="font-display text-2xl font-bold">How to get the app</h1>
        <p className="mt-2" style={{ color: '#555555' }}>Follow the steps for your device.</p>

        {focus === 'ios' ? [ios, android] : [android, ios]}

        <h2 className="mt-8 text-lg font-bold">Trouble installing?</h2>
        <ul className="mt-3 list-disc pl-5" style={{ color: '#333333' }}>
          <li>“App not installed”: uninstall the old Cznnect, then try again.</li>
          <li>Download opens an old file: check your Downloads folder for the newest one.</li>
        </ul>
      </div>
    </div>
  )
}

function ServiceNotice({ message, detail, onUnlock, onContinue, showApk = false, showIos = false, androidLabel = 'Download the new app', title = 'Cznnect is getting an update' }: { message: string; detail?: string; onUnlock?: () => void; onContinue?: () => void; showApk?: boolean; showIos?: boolean; androidLabel?: string; title?: string }) {
  const [help, setHelp] = useState<null | 'android' | 'ios'>(null)
  // An iPhone cannot install the Android file and an Android phone has no use for the iPhone steps, so each phone
  // only sees the card that can work for it. Computers see both.
  const device = deviceKind(typeof navigator === 'undefined' ? '' : navigator.userAgent)
  const androidCard = showApk && device !== 'ios'
  const iosCard = showIos && device !== 'android'
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [showPinUnlock, setShowPinUnlock] = useState(false)
  const [logoTaps, setLogoTaps] = useState(0)

  // Tapping the logo 7 times shows a PIN box. The right PIN skips this screen and goes to sign-in.
  function handleLogoTap() {
    if (!onUnlock || showPinUnlock) return
    const next = logoTaps + 1
    setLogoTaps(next)
    if (next >= LOGO_TAPS_FOR_PIN) setShowPinUnlock(true)
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

  if (help) return <InstallHelp focus={help} onClose={() => setHelp(null)} />

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <button type="button" className="mx-auto block cursor-default rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" aria-label="Cznnect logo" onClick={handleLogoTap}>
        <Logo big />
      </button>
      <div className="card">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-muted">{message}</p>
        {detail && <p className="mt-2 text-sm font-bold tabular-nums">{detail}</p>}
        {(androidCard || iosCard) && (
          <div className="mt-5 flex flex-col gap-3">
            {androidCard && (
              <a
                className="flex items-center gap-4 rounded-2xl border border-line p-4 no-underline transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                href={LATEST_APK_URL}
                {...(isNativeApp() ? {} : { target: '_blank', rel: 'noopener noreferrer', download: 'cznnect.apk' })}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink"><Icon name="download" size={24} /></span>
                <span className="font-bold">{androidLabel}</span>
              </a>
            )}
            {iosCard && (
              <button
                type="button"
                onClick={() => setHelp('ios')}
                className="flex items-center gap-4 rounded-2xl border border-line p-4 text-left transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink"><Icon name="phone" size={24} /></span>
                <span className="font-bold">Install on iPhone</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setHelp(androidCard ? 'android' : 'ios')}
              className="mx-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-accent-text underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Icon name="info" size={16} />
              Learn more
            </button>
          </div>
        )}
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            className="mt-5 w-full rounded-xl border border-line px-4 py-3 text-center font-semibold transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Continue on the web
          </button>
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
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [ready, setReady] = useState(false)
  const [held, setHeld] = useState(true)
  const [maintenance, setMaintenance] = useState<AppSettings | null>(null)
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [iosHelp, setIosHelp] = useState(false) // the iPhone icon on the sign-in screen
  // Someone who chose to carry on in the browser is not asked again on this device.
  const [webContinue, setWebContinue] = useState(() => {
    try { return localStorage.getItem('cznnect-web-continue') === '1' } catch { return false }
  })
  const continueOnWeb = () => {
    setWebContinue(true)
    try { localStorage.setItem('cznnect-web-continue', '1') } catch { /* private window: it only lasts this visit */ }
  }

  useEffect(() => {
    const id = setTimeout(() => setHeld(false), prefersReducedMotion() ? 1200 : SPLASH_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!configured) { setReady(true); return }
    const timer = setTimeout(() => setReady(true), 8000)

    // The saved copy of the last-viewed data belongs to whoever is signed in, so say who before any screen asks.
    const applySession = (next: Session | null) => {
      setSavedDataOwner(next?.user.id ?? null)
      setSession(next)
    }

    // Subscribe before reading the initial session so a recovery callback cannot be
    // missed while the app is booting. Supabase processes the PKCE/hash callback
    // and emits PASSWORD_RECOVERY when the recovery session is established.
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') { clearFamilies(localStorage); clearSavedData() }
      // Offline, a saved login that needs refreshing comes back empty. That is not a sign-out: keep the person in.
      const saved = !s && event !== 'SIGNED_OUT' && isOffline() ? readStoredUser(localStorage, SUPABASE_URL) : null
      if (saved) {
        applySession(offlineSession(saved))
        return
      }
      applySession(s)
      if (isPasswordRecoveryEvent(event)) setRecoveryMode(true)
    })

    // Back online: refresh the login right away, so the app swaps from the saved copy to live data.
    const stopOnline = onBackOnline(() => { void supabase.auth.getSession() })

    // Offline, refreshing an old login would keep retrying for half a minute. So as soon as the app knows it is
    // offline it opens from the saved login instead of waiting.
    const useSaved = () => {
      if (!isOffline()) return
      const saved = readStoredUser(localStorage, SUPABASE_URL)
      if (saved) applySession(offlineSession(saved))
    }
    Promise.race([
      withTimeout(supabase.auth.getSession(), 12000),
      whenOffline().then(() => 'offline' as const),
    ]).then((r) => {
      if (r === 'offline') useSaved()
      else if (r.data.session) applySession(r.data.session)
      else useSaved()
    }).catch(useSaved).finally(() => {
      clearTimeout(timer)
      setReady(true)
    })
    return () => { clearTimeout(timer); stopOnline(); data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!configured) return
    let alive = true
    const load = async () => {
      try {
        const { data } = await withTimeout(supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(), 10000)
        if (alive && data) setMaintenance(parseSettings(data))
      } catch {
        // Keep the last known settings; a temporary network failure must not block the app.
      }
    }
    void load()
    const channel = supabase.channel('app-maintenance-status').on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
      const row = payload.new as Record<string, unknown>
      if (alive && typeof row.maintenance_enabled === 'boolean') setMaintenance(parseSettings(row))
    }).subscribe()
    const poll = setInterval(load, 20000)
    return () => { alive = false; clearInterval(poll); void supabase.removeChannel(channel) }
  }, [])

  if (!configured) return <><ServiceNotice message="Cznnect is not configured yet. Please check back later." /><NetworkStatus /></>
  if (!ready || held) return <><Splash /><NetworkStatus /></>
  const isOwner = isOwnerEmail(session?.user.email)
  if (recoveryMode) return <><PasswordRecoveryScreen onComplete={() => setRecoveryMode(false)} /><NetworkStatus /></>
  if (maintenance?.maintenanceEnabled && !isOwner && !pinUnlocked) {
    return <><ServiceNotice message={maintenance.maintenanceMessage} showApk={maintenance.androidDownloadEnabled} onUnlock={() => setPinUnlocked(true)} /><NetworkStatus /></>
  }
  // With the download option on, people on the plain website (not the Android app, not the home-screen web app)
  // see the download page instead of signing in. The owner account and anyone with the access PIN still get through.
  if (
    maintenance?.apkDownloadEnabled && !isNativeApp() && !isInstalledWebApp() && !isOwner && !pinUnlocked &&
    !(webContinue && maintenance.webContinueEnabled)
  ) {
    return (
      <><ServiceNotice
        title="Get the Cznnect app"
        message="Cznnect works best as an app. Get it for your phone below, or carry on in your browser."
        showApk={maintenance.androidDownloadEnabled}
        showIos={maintenance.iosInstallEnabled}
        androidLabel="Download for Android"
        onContinue={maintenance.webContinueEnabled ? continueOnWeb : undefined}
        onUnlock={() => setPinUnlocked(true)}
      /><NetworkStatus /></>
    )
  }
  // Old Android apps must update before they can be used, the owner's phone included. The website is never forced,
  // so the owner can always sign in there to change the required build. The database refuses old apps too
  // (supabase/10_enforce_min_build.sql).
  if (maintenance && mustUpdate({ minBuild: maintenance.minBuild, build: thisBuild(), native: isNativeApp() })) {
    return <><ServiceNotice title="Update required" message="This version of Cznnect is out of date. Download the new app to keep using it." detail={`Your version: build ${thisBuild() ?? 'unknown'} · Required: build ${maintenance.minBuild}`} showApk /><NetworkStatus /></>
  }
  // On the website there is always a way to get the app from the sign-in screen, even after "Continue on the web".
  const canOfferApp = Boolean(
    maintenance && maintenance.loginDownloadButtonEnabled && !isNativeApp() && !isInstalledWebApp() &&
    (maintenance.androidDownloadEnabled || maintenance.iosInstallEnabled),
  )
  if (!session && iosHelp) return <><InstallHelp focus="ios" onClose={() => setIosHelp(false)} /><NetworkStatus /></>
  if (!session) {
    const apps = canOfferApp && maintenance
      ? { android: maintenance.androidDownloadEnabled, ios: maintenance.iosInstallEnabled, onIos: () => setIosHelp(true) }
      : undefined
    return <><AuthScreen apps={apps} /><NetworkStatus /></>
  }
  // live = a real login. The saved one used for opening offline has no access token.
  return <Authed userId={session.user.id} email={session.user.email ?? ''} live={Boolean(session.access_token)} />
}
