import { useState, type FormEvent } from 'react'
import { searchPlace, type Found } from '../lib/placesApi'

// Step 1 of adding a place: where is it? Search by name or address, use the phone's
// location, or tap the spot on the map.
export default function PlaceFinder({
  onFound,
  onPickOnMap,
  onCancel,
}: {
  onFound: (spot: Found) => void
  onPickOnMap: () => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Found[] | null>(null)
  const [error, setError] = useState('')

  async function search(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = await searchPlace(q)
    setBusy(false)
    setResults(r.results)
    if (r.error) setError(r.error)
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share your location. Search, or pick the spot on the map.')
      return
    }
    setBusy(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        onFound({ label: '', lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setBusy(false)
        setError('Could not get your location. Allow location for this site, or search instead.')
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={search} className="flex flex-col gap-2">
        <label className="label" htmlFor="pf-search">
          Search by name or address
        </label>
        <div className="flex gap-2">
          <input
            id="pf-search"
            className="input"
            value={q}
            placeholder="e.g. Star Kabab, Dhanmondi"
            autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-primary !px-4" disabled={busy || q.trim().length < 2}>
            Search
          </button>
        </div>
      </form>

      {busy && <p className="text-muted">Looking...</p>}
      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}

      {results && !busy && (
        <ul className="divide-y divide-line rounded-[var(--radius-ctl)] border border-line bg-surface px-3">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" className="min-h-14 w-full py-2 text-left" onClick={() => onFound(r)}>
                <span className="block font-semibold">{r.label.split(',')[0]}</span>
                <span className="block text-sm text-muted">{r.label.split(',').slice(1, 4).join(',').trim()}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="py-3 text-muted">Nothing found. Try fewer words, or pick it on the map.</li>}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-plain" disabled={busy} onClick={useMyLocation}>
          Use my location
        </button>
        <button type="button" className="btn btn-plain" onClick={onPickOnMap}>
          Pick on the map
        </button>
      </div>
      <button type="button" className="link self-start" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
