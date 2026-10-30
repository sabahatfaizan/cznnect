import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import Logo from './Logo'

// Shown once, right after sign-up: start a family space or join one with an invite code.
export default function FamilySetup({ onDone }: { onDone: () => void }) {
  const [familyName, setFamilyName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'' | 'create' | 'join'>('')
  const [error, setError] = useState('')

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy('create')
    setError('')
    const { error } = await supabase.rpc('create_family', { family_name: familyName })
    setBusy('')
    if (error) setError(error.message)
    else onDone()
  }

  async function join(e: FormEvent) {
    e.preventDefault()
    setBusy('join')
    setError('')
    const { error } = await supabase.rpc('join_family', { code })
    setBusy('')
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Logo />
        <h1 className="font-display text-2xl font-extrabold leading-tight">Set up your family space</h1>
        <p className="text-muted">Start a new space, or join one you have been invited to.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}

      <form onSubmit={create} className="card flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-bold">Start a family space</h2>
        <div>
          <label className="label" htmlFor="family-name">
            Family name
          </label>
          <input
            id="family-name"
            className="input"
            placeholder="The Rahman Cousins"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary w-full" disabled={busy !== ''}>
          {busy === 'create' ? 'Creating...' : 'Create space'}
        </button>
      </form>

      <form onSubmit={join} className="card flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-bold">Join with an invite code</h2>
        <div>
          <label className="label" htmlFor="code">
            Invite code
          </label>
          <input
            id="code"
            className="input font-mono uppercase tracking-widest"
            placeholder="A1B2C3D4"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            required
          />
        </div>
        <button className="btn btn-plain w-full" disabled={busy !== ''}>
          {busy === 'join' ? 'Joining...' : 'Join'}
        </button>
      </form>

      <button type="button" className="link" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  )
}
