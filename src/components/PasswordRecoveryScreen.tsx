import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import Logo from './Logo'

export default function PasswordRecoveryScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    if (password.length < 6) {
      setMessage({ kind: 'error', text: 'Your password must be at least 6 characters.' })
      return
    }
    if (password !== confirmPassword) {
      setMessage({ kind: 'error', text: 'The passwords do not match.' })
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setMessage({ kind: 'error', text: error.message })
        return
      }
      setMessage({ kind: 'success', text: 'Your password has been updated. Returning to sign in…' })
      await supabase.auth.signOut()
      onComplete()
    } catch {
      setMessage({ kind: 'error', text: 'Could not update your password. Please request a fresh recovery email and try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-3">
        <Logo />
        <h1 className="font-display text-3xl font-extrabold leading-tight">Choose a new password.</h1>
        <p className="text-muted">Enter and confirm the new password for your Cznnect account.</p>
      </div>

      <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
        <div>
          <label className="label" htmlFor="recovery-password">New password</label>
          <input
            id="recovery-password"
            className="input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="recovery-confirm-password">Confirm new password</label>
          <input
            id="recovery-confirm-password"
            className="input"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          Show password
        </label>
        {message && (
          <p role="status" className={`text-sm font-bold ${message.kind === 'error' ? 'text-danger' : 'text-ok'}`}>
            {message.text}
          </p>
        )}
        <button className="btn btn-primary w-full" type="submit" disabled={busy}>
          {busy ? 'Updating password…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
