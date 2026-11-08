import { LATEST_APK_URL } from '../lib/appSettings'
import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import Logo from './Logo'
import { nextAuthMode, type AuthMode } from '../lib/auth'

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
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'up') {
        const { data, error } = await withTimeout(
          supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { display_name: name.trim() } },
          }),
        )
        if (error) setMsg({ kind: 'error', text: error.message })
        else if (!data.session)
          setMsg({ kind: 'info', text: 'Account created. Check your email to confirm it, then sign in.' })
      } else if (mode === 'reset') {
        const redirectTo = new URL('.', window.location.href).toString()
        const { error } = await withTimeout(
          supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo }),
        )
        if (error) setMsg({ kind: 'error', text: error.message })
        else setMsg({ kind: 'info', text: 'Password reset email sent. Open the newest email on this device to choose a new password.' })
      } else {
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({ email: email.trim(), password }),
        )
        if (error) setMsg({ kind: 'error', text: error.message })
      }
    } catch {
      // The request never finished. Show it instead of spinning forever.
      setMsg({
        kind: 'error',
        text: 'Could not reach the server. Check your connection and try again. If you were creating an account, try signing in, because it may have worked.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col p-6">
      <div className="flex flex-1 flex-col justify-center gap-5">
      <div className="flex flex-col gap-2">
        <Logo />
        <h1 className="font-display text-3xl font-extrabold leading-tight">Stay connected.</h1>
      </div>

      <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
        <h2 className="font-display text-xl font-bold">
          {mode === 'in' ? 'Welcome back' : mode === 'reset' ? 'Reset your password' : 'Create your account'}
        </h2>

        {mode === 'up' && (
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        {mode !== 'reset' && <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="input pr-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {showPassword ? (
                  <>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4.1M6.6 6.6A16.6 16.6 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 4.2-1" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </>
                ) : (
                  <>
                    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>}

        {mode === 'in' && (
          <button type="button" className="link self-start text-sm" onClick={() => { setMode('reset'); setMsg(null) }}>
            Forgot password?
          </button>
        )}

        {msg && (
          <p role="status" className={`text-sm font-bold ${msg.kind === 'error' ? 'text-danger' : 'text-ok'}`}>
            {msg.text}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'in' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : 'Get started'}
        </button>
      </form>

      <button
        type="button"
        className="btn btn-plain !min-h-11 w-full !text-sm"
        onClick={() => {
          setMode(nextAuthMode(mode))
          setMsg(null)
        }}
      >
        {mode === 'up' ? 'Already a member? Sign in' : mode === 'reset' ? 'Back to sign in' : 'New to Cznnect? Join Cznnect'}
      </button>

      {apps && (apps.android || apps.ios) && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs text-muted">Get the app</p>
          <div className={`grid gap-3 ${apps.android && apps.ios ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {apps.android && (
              <a href={LATEST_APK_URL} download className="btn btn-plain !min-h-11 gap-2 !text-sm no-underline" aria-label="Get the Android app">
                <AndroidIcon />
                <span>Android</span>
              </a>
            )}
            {apps.ios && (
              <button type="button" onClick={apps.onIos} className="btn btn-plain !min-h-11 gap-2 !text-sm" aria-label="iPhone: add Cznnect to your Home Screen">
                <AppleIcon />
                <span>iPhone</span>
              </button>
            )}
          </div>
        </div>
      )}
      </div>

      <p className="pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-muted">© 2026 Sabahat Faizan. All rights reserved.</p>
    </div>
  )
}
