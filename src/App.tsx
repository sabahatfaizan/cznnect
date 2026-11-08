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
import { ServiceNotice, InstallHelp, MAINTENANCE_REASSURANCE } from './components/ServiceNotice'
import Authed from './Authed'
import AdminApp from './AdminApp'
import EntryChooser from './components/EntryChooser'
import { setEntryMode, useEntryMode } from './lib/entryMode'
import { isOwnerEmail } from './owner'
import { isPasswordRecoveryEvent } from './lib/auth'
import { isInstalledWebApp, isNativeApp, parseSettings, thisBuild, type AppSettings } from './lib/appSettings'
import { mustUpdate } from './lib/updateGate'

const SPLASH_MS = 4500

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

export default function App() {
  const entryMode = useEntryMode()
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
      if (event === 'SIGNED_OUT') { clearFamilies(localStorage); clearSavedData(); setEntryMode(null) }
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
    return <><ServiceNotice title="Back soon" message={maintenance.maintenanceMessage} reassurance={MAINTENANCE_REASSURANCE} onUnlock={() => setPinUnlocked(true)} /><NetworkStatus /></>
  }
  // With the download option on, people on the plain website (not the Android app, not the home-screen web app)
  // see the download page instead of signing in. The owner account and anyone with the access PIN still get through.
  if (
    maintenance?.apkDownloadEnabled && !isNativeApp() && !isInstalledWebApp() && !isOwner && !pinUnlocked &&
    !(webContinue && maintenance.webContinueEnabled)
  ) {
    return (
      <><ServiceNotice
        title="Get the app"
        message="Cznnect works best as an app on your phone."
        showApk={maintenance.androidDownloadEnabled}
        building={maintenance.buildInProgress}
        showIos={maintenance.iosInstallEnabled}
        installLabel="Install"
        onContinue={maintenance.webContinueEnabled ? continueOnWeb : undefined}
        onUnlock={() => setPinUnlocked(true)}
      /><NetworkStatus /></>
    )
  }
  // Old Android apps must update before they can be used, the owner's phone included. The website is never forced,
  // so the owner can always sign in there to change the required build. The database refuses old apps too
  // (supabase/10_enforce_min_build.sql).
  if (maintenance && mustUpdate({ minBuild: maintenance.minBuild, build: thisBuild(), native: isNativeApp() })) {
    return <><ServiceNotice title="Update required" installLabel="Update" message={maintenance.buildInProgress ? "This version is out of date. The new version is being prepared, so please wait a few minutes and try again." : "This version is out of date. Update to keep using Cznnect."} building={maintenance.buildInProgress} requiredBuild={maintenance.minBuild} showApk /><NetworkStatus /></>
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
  // The owner chooses how to come in: as the Administrator or as a family member.
  if (isOwner && entryMode === null) return <><EntryChooser /><NetworkStatus /></>
  if (isOwner && entryMode === 'admin') return <><AdminApp userId={session.user.id} live={Boolean(session.access_token)} /><NetworkStatus /></>
  return <Authed userId={session.user.id} email={session.user.email ?? ''} live={Boolean(session.access_token)} />
}
