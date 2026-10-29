import { useState, type FormEvent } from 'react'
import { HORIZONS, type BucketItem, type Horizon, type Difficulty, DIFFICULTIES, difficultyPoints } from '../lib/plans'
import type { ItemValues } from '../lib/plansApi'

export type Who = { id: string; name: string }

// Add or edit one bucket-list item.
export default function ItemForm({
  initial,
  members,
  existing,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ItemValues>
  members: Who[]
  existing: BucketItem[]
  submitLabel: string
  onSubmit: (values: ItemValues) => Promise<string | null>
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [horizon, setHorizon] = useState<Horizon>(initial?.horizon ?? 'life')
  const [due, setDue] = useState(initial?.due_date ?? '')
  const [who, setWho] = useState(initial?.assigned_to ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const t = title.trim().toLowerCase()
  const clash = t.length > 0 ? existing.find((i) => i.horizon === horizon && i.title.trim().toLowerCase() === t) : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please enter what you want to do.')
      return
    }
    setBusy(true)
    setError('')
    const problem = await onSubmit({ title, notes, horizon, due_date: due, assigned_to: who, difficulty })
    setBusy(false)
    if (problem) setError(problem)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="bi-title">
          What do you want to do?
        </label>
        <input
          id="bi-title"
          className="input"
          value={title}
          maxLength={120}
          autoComplete="off"
          placeholder="e.g. Trip to Sajek"
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        {clash && !clash.done && <p className="mt-1 text-sm font-bold text-danger">That is already on this list.</p>}
      </div>

      <div>
        <span className="label">List</span>
        <div className="grid grid-cols-3 gap-2">
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-pressed={horizon === h.id}
              className={`seg !min-h-11 items-center ${horizon === h.id ? 'seg-on' : ''}`}
              onClick={() => setHorizon(h.id)}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Difficulty and reward</span>
        <div className="grid grid-cols-2 gap-2">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} type="button" aria-pressed={difficulty === d.id}
              className={`seg !min-h-11 items-center ${difficulty === d.id ? 'seg-on' : ''}`}
              onClick={() => setDifficulty(d.id)}>
              {d.label} · {difficultyPoints(d.id)} pts
            </button>
          ))}
        </div>
        <p className="mt-1 text-sm text-muted">Points are awarded once when a cousin marks this plan done.</p>
      </div>

      <div>
        <span className="label">Difficulty and reward</span>
        <div className="grid grid-cols-2 gap-2">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} type="button" aria-pressed={difficulty === d.id}
              className={`seg !min-h-11 items-center ${difficulty === d.id ? 'seg-on' : ''}`}
              onClick={() => setDifficulty(d.id)}>
              {d.label} · {difficultyPoints(d.id)} pts
            </button>
          ))}
        </div>
        <p className="mt-1 text-sm text-muted">Points are awarded once when a cousin marks this plan done.</p>
      </div>

      <div>
        <label className="label" htmlFor="bi-due">
          Deadline (optional)
        </label>
        <input id="bi-due" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="bi-who">
          Who will organise it? (optional)
        </label>
        <select id="bi-who" className="input" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Nobody yet</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="bi-notes">
          Notes (optional)
        </label>
        <textarea id="bi-notes" className="input" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-plain" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
