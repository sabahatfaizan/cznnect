import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import Sheet from './Sheet'
import { MAX_FAMILIES } from '../lib/families'
import type { Family } from '../types'

// The "Your families" part of the menu: the families this account is in (up to three), a tap to switch, and a way to
// join or start another. The family open when the app closes is the one it opens in next time.
export function FamilyList({
  families,
  activeId,
  onSwitch,
  onAdd,
  onClose,
}: {
  families: Family[]
  activeId: string
  onSwitch: (id: string) => void
  onAdd: () => void
  onClose: () => void
}) {
  return (
    <div className="grid gap-1" aria-label="Your families">
      <p className="eyebrow px-3 pb-1">Your families</p>
      {families.map((f) => {
        const on = f.id === activeId
        return (
          <button
            key={f.id}
            type="button"
            className={`menu-item ${on ? 'menu-item-on' : ''}`}
            aria-current={on ? 'true' : undefined}
            onClick={() => { if (!on) onSwitch(f.id); onClose() }}
          >
            <span className="menu-item-label"><span className="truncate">{f.name}</span></span>
            {on ? <span className="text-xs font-bold text-accent-text">Open</span> : <span aria-hidden="true" className="menu-chevron">›</span>}
          </button>
        )
      })}
      <button type="button" className="menu-item" onClick={onAdd} aria-haspopup="dialog">
        <span className="menu-item-label"><span aria-hidden="true" className="text-xl leading-none">+</span>Add a family</span>
        <span className="text-xs text-muted">{families.length}/{MAX_FAMILIES}</span>
      </button>
    </div>
  )
}

// The sheet for joining or starting another family. It lives outside the menu panel so it can cover the whole screen.
export default function AddFamilySheet({ count, onAdded, onClose }: { count: number; onAdded: (id: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'' | 'create' | 'join'>('')
  const [error, setError] = useState('')
  const full = count >= MAX_FAMILIES

  async function run(kind: 'create' | 'join', e: FormEvent) {
    e.preventDefault()
    if (full) { setError(`You can be in up to ${MAX_FAMILIES} families. Leave one first.`); return }
    setBusy(kind)
    setError('')
    const { data, error: err } = kind === 'create'
      ? await supabase.rpc('create_family', { family_name: name })
      : await supabase.rpc('join_family', { code })
    setBusy('')
    if (err) { setError(err.message); return }
    onClose()
    if (typeof data === 'string') onAdded(data)
  }

  return (
    <Sheet title="Add a family" onClose={onClose}>
      {full ? (
        <p className="text-sm">You are in {MAX_FAMILIES} families, which is the most one account can be in. Leave one in its Settings to add another.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
          <form onSubmit={(e) => void run('join', e)} className="flex flex-col gap-2">
            <label className="label" htmlFor="add-family-code">Join with an invite code</label>
            <input id="add-family-code" className="input font-mono uppercase tracking-widest" placeholder="A1B2C3D4" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" required />
            <button className="btn btn-primary" disabled={busy !== ''}>{busy === 'join' ? 'Joining…' : 'Join'}</button>
          </form>
          <form onSubmit={(e) => void run('create', e)} className="flex flex-col gap-2">
            <label className="label" htmlFor="add-family-name">Or start a new family</label>
            <input id="add-family-name" className="input" placeholder="The Rahman Cousins" value={name} onChange={(e) => setName(e.target.value)} required />
            <button className="btn btn-plain" disabled={busy !== ''}>{busy === 'create' ? 'Creating…' : 'Create'}</button>
          </form>
        </div>
      )}
    </Sheet>
  )
}
