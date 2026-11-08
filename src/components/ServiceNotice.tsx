import { useState } from 'react'
import Logo from './Logo'
import { Icon } from './Icons'
import ApkStatus from './ApkStatus'
import { APK_BACKUP_URL, LATEST_APK_URL, isNativeApp, thisBuild } from '../lib/appSettings'
import { deviceKind } from '../lib/updateGate'
import { useApkDownload } from '../lib/apkDownload'

export const MAINTENANCE_REASSURANCE = 'Hang tight. This only takes a little while, and there is nothing you need to do. Your data is safe.'
const MAINTENANCE_PIN = '4124'
const LOGO_TAPS_FOR_PIN = 7

// A plain white page that explains how to get the new app. Colours are fixed so it stays white in every theme.
export function InstallHelp({ onClose, focus = 'android' }: { onClose: () => void; focus?: 'android' | 'ios' }) {
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

export function ServiceNotice({ message, requiredBuild, onUnlock, onContinue, building = false, showApk = false, showIos = false, installLabel = 'Install', title = 'Cznnect is getting an update', preview = false, reassurance }: { message: string; requiredBuild?: number; onUnlock?: () => void; onContinue?: () => void; building?: boolean; showApk?: boolean; showIos?: boolean; installLabel?: string; title?: string; preview?: boolean; reassurance?: string }) {
  const [help, setHelp] = useState<null | 'android' | 'ios'>(null)
  const apk = useApkDownload()
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
    if (preview || !onUnlock || showPinUnlock) return
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

  const started = apk.state.phase !== 'idle' && apk.state.phase !== 'failed'
  const current = thisBuild()

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col p-6">
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="flex items-center gap-4">
          <button type="button" className="shrink-0 cursor-default rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" aria-label="Cznnect logo" onClick={handleLogoTap}>
            <Logo big />
          </button>
          <span aria-hidden="true" className="h-12 w-px shrink-0 bg-line" />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold leading-tight">Cznnect</h1>
            <p className="text-sm text-muted">{title}</p>
          </div>
        </div>

        <p className="text-sm text-muted">{message}</p>

        {reassurance && (
          <p role="status" className="flex items-center gap-2.5 rounded-xl border border-line px-4 py-3 text-sm font-semibold">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-accent" />
            {reassurance}
          </p>
        )}

        {androidCard && building && (
          <p role="status" className="text-sm font-semibold">The new app is being prepared. Please wait a few minutes.</p>
        )}

        {androidCard && !building && !started && (
          <a
            className="btn btn-primary !min-h-12 w-full no-underline"
            href={LATEST_APK_URL}
            {...(isNativeApp() ? {} : { target: '_blank', rel: 'noopener noreferrer', download: 'cznnect.apk' })}
            onClick={(e) => {
              if (preview) { e.preventDefault(); return }
              if (!isNativeApp()) return
              // Inside the app, Android's download manager does the download; the plain link is the fallback.
              e.preventDefault()
              void apk.start(LATEST_APK_URL)
            }}
          >
            {installLabel}
          </a>
        )}
        {androidCard && <ApkStatus apk={apk} />}
        {androidCard && !building && apk.state.phase === 'failed' && (
          <a
            className="mx-auto text-sm text-muted underline underline-offset-4"
            href={APK_BACKUP_URL}
            {...(isNativeApp() ? {} : { target: '_blank', rel: 'noopener noreferrer', download: 'cznnect.apk' })}
            onClick={(e) => {
              if (!isNativeApp()) return
              e.preventDefault()
              void apk.start(APK_BACKUP_URL)
            }}
          >
            Try the backup link
          </a>
        )}

        {iosCard && (
          <button type="button" className="btn btn-primary !min-h-12 w-full" onClick={() => setHelp('ios')}>
            Add to Home Screen
          </button>
        )}

        {(androidCard || iosCard) && !started && (
          <button
            type="button"
            onClick={() => setHelp(androidCard ? 'android' : 'ios')}
            className="mx-auto rounded-lg px-2 py-1 text-sm text-muted underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Need help?
          </button>
        )}

        {onContinue && !started && (
          <button type="button" onClick={preview ? undefined : onContinue} className="btn btn-plain !min-h-11 w-full !text-sm">
            Continue on the web
          </button>
        )}

        {onUnlock && showPinUnlock && (
          <form className="flex flex-col gap-3" onSubmit={submitPin}>
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

      <p className="pt-6 pb-[max(3.5rem,calc(env(safe-area-inset-bottom)+1rem))] text-center text-xs tabular-nums text-muted">
        {requiredBuild ? `Your build ${current ?? 'unknown'} · Required build ${requiredBuild}` : current ? `Build ${current}` : ''}
      </p>
    </div>
  )
}

