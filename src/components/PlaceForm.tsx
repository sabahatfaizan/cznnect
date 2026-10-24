import { useState, type FormEvent } from 'react'
import { similarPlaces, type Place } from '../lib/places'
import type { PlaceValues } from '../lib/placesApi'

// Step 2 of adding a place (and the edit form). While adding, places that look like the
// same one are shown first, so the family does not save the same restaurant twice.
export default function PlaceForm({
  initial,
  places,
  editingId,
  submitLabel,
  onSubmit,
  onCancel,
  onUseExisting,
}: {
  initial: Partial<PlaceValues> & { lat: number; lng: number }
  places: Place[]
  editingId?: string
  submitLabel: string
  onSubmit: (values: PlaceValues) => Promise<string | null>
  onCancel: () => void
  onUseExisting?: (place: Place) => void
}) {
  const [name, setName] = useState(initial.name ?? '')
  const [kind, setKind] = useState<PlaceValues['kind']>(initial.kind ?? 'place')
  const [cuisine, setCuisine] = useState(initial.cuisine ?? '')
  const [status, setStatus] = useState<PlaceValues['status']>(initial.status ?? 'been')
  const [visited, setVisited] = useState(initial.visited_on ?? '')
  const [address, setAddress] = useState(initial.address ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const similar = editingId ? [] : similarPlaces(places, name, initial.lat, initial.lng)
  const today = new Date().toISOString().slice(0, 10)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a name.')
      return
    }
    setBusy(true)
    setError('')
    const problem = await onSubmit({
      name,
      kind,
      cuisine,
      status,
      address,
      notes,
      visited_on: visited,
      lat: initial.lat,
      lng: initial.lng,
    })
    setBusy(false)
    if (problem) setError(problem)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="pl-name">
          Name
        </label>
        <input
          id="pl-name"
          className="input"
          value={name}
          maxLength={80}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {similar.length > 0 && (
        <div className="rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3" role="status">
          <p className="text-sm font-bold">Already saved?</p>
          <ul className="mt-1 divide-y divide-line">
            {similar.slice(0, 3).map((p) => (
              <li key={p.id} className="flex min-h-12 items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                {onUseExisting && (
                  <button type="button" className="link" onClick={() => onUseExisting(p)}>
                    Open it
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-muted">If this is somewhere different, carry on and save it.</p>
        </div>
      )}

      <div>
        <span className="label">Type</span>
        <div className="grid grid-cols-2 gap-2">
          {(['place', 'restaurant'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              className={`seg !min-h-11 items-center ${kind === k ? 'seg-on' : ''}`}
              onClick={() => setKind(k)}
            >
              {k === 'place' ? 'Place' : 'Restaurant'}
            </button>
          ))}
        </div>
      </div>

      {kind === 'restaurant' && (
        <div>
          <label className="label" htmlFor="pl-cuisine">
            Kind of food (optional)
          </label>
          <input
            id="pl-cuisine"
            className="input"
            value={cuisine}
            maxLength={40}
            placeholder="e.g. Bengali, Chinese, Burgers"
            onChange={(e) => setCuisine(e.target.value)}
          />
        </div>
      )}

      <div>
        <span className="label">Status</span>
        <div className="grid grid-cols-2 gap-2">
          {(['been', 'want'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              className={`seg !min-h-11 items-center ${status === s ? 'seg-on' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s === 'been' ? 'Been there' : 'Want to go'}
            </button>
          ))}
        </div>
      </div>

      {status === 'been' && (
        <div>
          <label className="label" htmlFor="pl-date">
            When (optional)
          </label>
          <input id="pl-date" type="date" className="input" value={visited} max={today} onChange={(e) => setVisited(e.target.value)} />
        </div>
      )}

      <div>
        <label className="label" htmlFor="pl-address">
          Address (optional)
        </label>
        <input id="pl-address" className="input" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="pl-notes">
          Notes (optional)
        </label>
        <textarea id="pl-notes" className="input" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
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
