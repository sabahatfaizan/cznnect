import { LATEST_APK_URL } from '../lib/appSettings'
import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import Logo from './Logo'
import { nextAuthMode, type AuthMode } from '../lib/auth'
import { WEB_APP_URL, isNative } from '../lib/native'
import PromoEmailsCheck from './PromoEmailsCheck'
import { BIRTHDAY_MIN, checkBirthday, todayISO } from '../lib/birthdayInput'

// Gives up after 20 seconds so the button never stays stuck.
function withTimeout<T>(p: PromiseLike<T>, ms = 20000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms)
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(id)
        resolve(v)
      },
      (err) => {
        clearTimeout(id)
        reject(err)
      },
    )
  })
}

// apps is given on the website (not inside the app) when there is an app to offer: the Android icon downloads the
// app, the iPhone icon opens the "Add to Home Screen" steps.
export type GetApps = { android: boolean; ios: boolean; onIos: () => void }

// The Android robot head, in Android green.
function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#3DDC84" aria-hidden="true">
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0004.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  )
}

export default function AuthScreen({ apps }: { apps?: GetApps }) {
  const [mode, setMode] = useState<AuthMode>('up')
  const [step, setStep] = useState<1 | 2>(1)
  const [birthday, setBirthday] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [eligible, setEligible] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function changeMode(next: AuthMode) { setMode(next); setStep(1); setMsg(null) }

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null)
    if (mode === 'up' && step === 1) { setStep(2); return }
    if (mode === 'up') {
      const problem = checkBirthday(birthday)
      if (problem) { setMsg({ kind: 'error', text: problem }); return }
      if (!terms || !privacy || !eligible) { setMsg({ kind: 'error', text: 'Please accept all three required confirmations.' }); return }
    }
    setBusy(true)
    try {
      if (mode === 'up') {
        const { data, error } = await withTimeout(supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: name.trim(), birthday, terms_accepted: true, privacy_accepted: true, eligibility_confirmed: true, legal_version: '2026-11-23' } },
        }))
        if (error) setMsg({ kind: 'error', text: error.message })
        else if (!data.session) {
          const again = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }))
          if (again.error) setMsg({ kind: 'info', text: /confirm/i.test(again.error.message) ? 'Account created. Please verify your email, then sign in.' : 'Account created. Please sign in.' })
        }
      } else if (mode === 'reset') {
        const redirectTo = isNative() ? WEB_APP_URL : new URL('.', window.location.href).toString()
        const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo }))
        if (error) setMsg({ kind: 'error', text: error.message })
        else setMsg({ kind: 'info', text: 'Password reset email sent. Open the newest email to choose a new password.' })
      } else {
        const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }))
        if (error) setMsg({ kind: 'error', text: error.message })
      }
    } catch {
      setMsg({ kind: 'error', text: 'Could not reach the server. Check your connection and try again. If account creation may have succeeded, try signing in.' })
    } finally { setBusy(false) }
  }

  const signup = mode === 'up'
  return (
    <main className="auth-viewport mx-auto flex w-full max-w-md flex-col justify-between px-5">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
        <div className="flex flex-col gap-1"><Logo /><h1 className="font-display text-3xl font-extrabold leading-tight">Stay connected.</h1></div>
        <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold">{mode === 'in' ? 'Welcome back' : mode === 'reset' ? 'Reset your password' : step === 1 ? 'Create your account' : 'A little about you'}</h2>
            {signup && <span className="text-xs font-semibold text-muted">Step {step} of 2</span>}
          </div>
          {(!signup || step === 1) && <>
            {signup && <div><label className="label" htmlFor="display-name">Name</label><input id="display-name" type="text" className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={80} required /></div>}
            <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></div>
            {mode !== 'reset' && <div><label className="label" htmlFor="password">Password</label><div className="relative">
              <input id="password" type={showPassword ? 'text' : 'password'} className="input pr-12" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required />
              <button type="button" className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div></div>}
          </>}
          {signup && step === 2 && <>
            <div><label className="label" htmlFor="birthday">Birthday</label><input id="birthday" type="date" className="input" value={birthday} min={BIRTHDAY_MIN} max={todayISO()} onChange={e => setBirthday(e.target.value)} autoComplete="bday" required /><p className="mt-1 text-xs text-muted">Your birthday is visible to members of your family on Cznnect.</p></div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={terms} onChange={e => setTerms(e.target.checked)} /><span>I agree to the <a className="link inline min-h-0" href={import.meta.env.BASE_URL + 'terms.html'}>Terms &amp; Conditions</a>.</span></label>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={privacy} onChange={e => setPrivacy(e.target.checked)} /><span>I have read the <a className="link inline min-h-0" href={import.meta.env.BASE_URL + 'privacy.html'}>Privacy Policy</a>.</span></label>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={eligible} onChange={e => setEligible(e.target.checked)} /><span>I confirm my information is accurate and I am eligible to use Cznnect.</span></label>
            </div>
            <PromoEmailsCheck />
          </>}
          {mode === 'in' && <button type="button" className="link self-start text-sm" onClick={() => changeMode('reset')}>Forgot password?</button>}
          {msg && <p role="status" className={'text-sm font-bold ' + (msg.kind === 'error' ? 'text-danger' : 'text-ok')}>{msg.text}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Please wait...' : signup ? step === 1 ? 'Continue' : 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
          {signup && step === 2 && <button type="button" className="btn btn-plain w-full !min-h-10" onClick={() => { setStep(1); setMsg(null) }}>Back</button>}
        </form>
        <button type="button" className="btn btn-plain !min-h-10 w-full !text-sm" onClick={() => changeMode(nextAuthMode(mode))}>{mode === 'up' ? 'Already a member? Sign in' : mode === 'reset' ? 'Back to sign in' : 'New to Cznnect? Join Cznnect'}</button>
      </div>
      <footer className="mt-auto flex flex-col gap-3 pb-1 pt-4">
        {apps && (apps.android || apps.ios) && (
          <div className="flex flex-col gap-2">
            <p className="text-center text-xs text-muted">Get the app</p>
            <div className={`grid gap-3 ${apps.android && apps.ios ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {apps.android && <a href={LATEST_APK_URL} download className="btn btn-plain !min-h-11 gap-2 !text-sm no-underline" aria-label="Get the Android app"><AndroidIcon /><span>Android</span></a>}
              {apps.ios && <button type="button" onClick={apps.onIos} className="btn btn-plain !min-h-11 gap-2 !text-sm" aria-label="iPhone: add Cznnect to your Home Screen"><AppleIcon /><span>iPhone</span></button>}
            </div>
          </div>
        )}
        <p className="text-center text-xs text-muted">© 2026 Sabahat Faizan. All rights reserved.</p>
      </footer>
    </main>
  )
}
