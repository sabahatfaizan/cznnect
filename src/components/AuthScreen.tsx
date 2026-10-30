import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import Logo from './Logo'

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

export default function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('up')
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
    <div className="auth-screen mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-3">
        <Logo />
        <h1 className="font-display text-3xl font-extrabold leading-tight">Stay connected.</h1>
      </div>

      <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
        <h2 className="font-display text-xl font-bold">
          {mode === 'in' ? 'Welcome back' : 'Create your account'}
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

        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">
              Password
            </label>
            <button
              type="button"
              className="min-h-8 px-1 text-sm font-bold text-accent-text underline underline-offset-2"
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </div>

        {msg && (
          <p role="status" className={`text-sm font-bold ${msg.kind === 'error' ? 'text-danger' : 'text-ok'}`}>
            {msg.text}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'in' ? 'Sign in' : 'Get started'}
        </button>
      </form>

      <button
        type="button"
        className="link"
        onClick={() => {
          setMode(mode === 'in' ? 'up' : 'in')
          setMsg(null)
        }}
      >
        {mode === 'in' ? 'New to Cznnect? Join Cznnect' : 'Already a member? Sign in'}
      </button>
    </div>
  )
}
