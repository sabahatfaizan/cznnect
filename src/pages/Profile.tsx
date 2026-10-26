import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'

export default function Profile({ userId }: { userId: string }) {
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('display_name, birthday')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setMsg({ kind: 'error', text: error.message })
          return
        }
        setName(data.display_name ?? '')
        setBirthday(data.birthday ?? '')
      })
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [userId])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), birthday: birthday || null })
      .eq('id', userId)
    setBusy(false)
    setMsg(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Saved' })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">My Profile</h1>

      <form onSubmit={save} className="card flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold">Details</h2>
        <div>
          <label className="label" htmlFor="p-name">
            Name
          </label>
          <input
            id="p-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="p-birthday">
            Birthday
          </label>
          <input
            id="p-birthday"
            type="date"
            className="input"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
          <p className="mt-1 text-sm text-muted">Shown to your family on the Birthdays page.</p>
        </div>
        <div>
          <p className="label">Email</p>
          <p className="break-all">{email}</p>
        </div>
        {msg && (
          <p role="status" className={`text-sm font-bold ${msg.kind === 'error' ? 'text-danger' : 'text-ok'}`}>
            {msg.text}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Saving...' : 'Save'}
        </button>
      </form>

      <button className="btn btn-plain w-full" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  )
}
