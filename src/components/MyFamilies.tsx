import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import Sheet from './Sheet'
import { Icon } from './Icons'
import { useBackClose } from '../lib/backStack'
import { MAX_FAMILIES } from '../lib/families'
import type { Family } from '../types'

// The "Your families" part of the menu: the families this account is in (up to three), a tap to switch, and a way to
// join or start another. The family open when the app closes is the one it opens in next time.
// The menu shows just one row, "Your families". The list itself opens in a box over a blurred page, so a long family
// name can never stretch the menu.
export function FamiliesButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="menu-item" onClick={onOpen} aria-haspopup="dialog">
      <span className="menu-item-label"><Icon name="family" size={22} />Your families</span>
      <span aria-hidden="true" className="menu-chevron">›</span>
    </button>
  )
}

export function FamiliesModal({
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
  useBackClose(onClose, true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-5" role="dialog" aria-modal="true" aria-label="Your families">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl border border-line bg-surface p-5 shadow-2xl">
        <p className="font-display text-xl font-extrabold">Your families</p>
        <p className="mt-1 text-sm text-muted">Tap one to open it. The app opens in the one you used last.</p>
        <ul className="mt-4 grid gap-2">
          {families.map((f) => {
            const on = f.id === activeId
            return (
              <li key={f.id}>
                <button
                  type="button"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => { if (!on) onSwitch(f.id); onClose() }}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left ${on ? 'border-accent bg-accent-soft' : 'border-line'}`}
                >
                  <span className={`min-w-0 flex-1 truncate font-semibold ${on ? 'text-accent-text' : ''}`}>{f.name}</span>
                  {on && <span className="shrink-0 text-xs font-bold text-accent-text">Open</span>}
                </button>
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn btn-plain mt-3 w-full" onClick={onAdd}>
          + Add a family <span className="ml-1 text-muted">{families.length}/{MAX_FAMILIES}</span>
        </button>
      </div>
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
