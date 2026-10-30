import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import type { Family, Member } from '../types'
import {
  averageStars,
  filterPlaces,
  groupRatings,
  kindLabel,
  starText,
  statusLabel,
  validLatLng,
  type KindFilter,
  type Place,
  type Rating,
  type StatusFilter,
} from '../lib/places'
import { addPlace, type Found } from '../lib/placesApi'
import { withTimeout } from '../lib/net'
import PlaceMap from '../components/PlaceMap'
import PlaceSheet from '../components/PlaceSheet'
import PlaceFinder from '../components/PlaceFinder'
import PlaceForm from '../components/PlaceForm'
import Sheet from '../components/Sheet'

type View = 'map' | 'list'
type Flow =
  | { step: 'none' }
  | { step: 'where' }
  | { step: 'pick' }
  | { step: 'form'; lat: number; lng: number; name: string; address: string }

const KINDS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'place', label: 'Places' },
  { id: 'restaurant', label: 'Restaurants' },
]
const STATUSES: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'been', label: 'Been' },
  { id: 'want', label: 'Want to go' },
]

export default function Explore({ family, userId }: { family: Family; userId: string }) {
  const [places, setPlaces] = useState<Place[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [isOwner, setIsOwner] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('map')
  const [kind, setKind] = useState<KindFilter>('all')
  const [state, setState] = useState<StatusFilter>('all')
  const [visitedBy, setVisitedBy] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number; tick: number } | null>(null)
  const [flow, setFlow] = useState<Flow>({ step: 'none' })
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      const [p, r, m] = await withTimeout(
        Promise.all([
          supabase.from('places').select('*').eq('family_id', family.id),
          supabase.from('place_ratings').select('*').eq('family_id', family.id),
          supabase.from('family_members').select('user_id, role, profiles(display_name)').eq('family_id', family.id),
        ]),
      )
      const problem = p.error ?? r.error ?? m.error
      if (problem) {
        const missing = problem.code === 'PGRST205' || problem.code === '42P01' || /places|place_ratings/.test(problem.message)
        setError(
          missing
            ? 'The places tables are not set up yet. In Supabase, run supabase/05_places.sql, then come back and try again.'
            : problem.message,
        )
        setStatus('error')
        return
      }
      const members = (m.data ?? []) as unknown as Member[]
      setPlaces((p.data ?? []) as Place[])
      setRatings((r.data ?? []) as Rating[])
      setNames(new Map(members.map((x) => [x.user_id, x.profiles?.display_name ?? 'A cousin'])))
      setIsOwner(members.some((x) => x.user_id === userId && x.role === 'owner'))
      setStatus('ready')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setStatus('error')
    }
  }, [family.id, userId])

  useEffect(() => {
    load()
  }, [load])

  const say = useCallback((message: string) => {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3500)
  }, [])

  const byPlace = useMemo(() => groupRatings(ratings), [ratings])
  // A cousin's rating is the existing signal that they have personally been to a place.
  const shown = useMemo(() => {
    const filtered = filterPlaces(places, { kind, status: state, query })
    if (visitedBy === 'all') return filtered
    return filtered.filter((p) => byPlace.get(p.id)?.some((r) => r.user_id === visitedBy))
  }, [places, kind, state, query, visitedBy, byPlace])
  const selected = selectedId ? (places.find((p) => p.id === selectedId) ?? null) : null

  // If a place was removed by someone else while its card was open, close the card.
  useEffect(() => {
    if (status === 'ready' && selectedId && !places.some((p) => p.id === selectedId)) setSelectedId(null)
  }, [status, selectedId, places])

  function show(p: Place) {
    setView('map')
    setSelectedId(p.id)
    setFocus({ lat: p.lat, lng: p.lng, tick: Date.now() })
  }

  function found(f: Found) {
    if (!validLatLng(f.lat, f.lng)) return
    const parts = f.label.split(',').map((s) => s.trim())
    setFocus({ lat: f.lat, lng: f.lng, tick: Date.now() })
    setView('map')
    setFlow({ step: 'form', lat: f.lat, lng: f.lng, name: parts[0] ?? '', address: parts.slice(1, 4).join(', ') })
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">Explore</h1>
        <p className="text-muted">Loading places...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">Explore</h1>
        <div className="card flex flex-col gap-3">
          <p role="alert" className="font-semibold">
            {error}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setStatus('loading')
              load()
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const picking = flow.step === 'pick'
  const pin = flow.step === 'form' ? { lat: flow.lat, lng: flow.lng } : null
  const sorted = [...shown].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Explore</h1>
          <p className="text-sm text-muted">
            {places.length === 0 ? 'Nothing saved yet' : `${places.length} ${places.length === 1 ? 'place' : 'places'} saved`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setFlow({ step: 'where' })}>
          + Add place
        </button>
      </header>

      {notice && (
        <p role="status" className="rounded-[var(--radius-ctl)] bg-accent-soft px-3 py-2 text-sm font-bold text-accent-text">
          {notice}
        </p>
      )}

      {picking && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-[var(--radius-ctl)] bg-accent-soft px-3 py-2">
          <span className="font-bold text-accent-text">Tap the map where it is.</span>
          <button className="link" onClick={() => setFlow({ step: 'none' })}>
            Cancel
          </button>
        </div>
      )}

      {!picking && places.length > 0 && (
        <>
          <div>
            <label className="label" htmlFor="ex-search">
              Find a place
            </label>
            <input
              id="ex-search"
              className="input"
              placeholder="Name, food or address"
              value={query}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Show">
            {KINDS.map((k) => (
              <button
                key={k.id}
                aria-pressed={kind === k.id}
                className={`seg !min-h-11 items-center ${kind === k.id ? 'seg-on' : ''}`}
                onClick={() => setKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                aria-pressed={state === s.id}
                className={`seg !min-h-11 items-center ${state === s.id ? 'seg-on' : ''}`}
                onClick={() => setState(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div>
            <label className="label" htmlFor="ex-visited-by">See where a cousin has been</label>
            <select
              id="ex-visited-by"
              className="input"
              value={visitedBy}
              onChange={(e) => setVisitedBy(e.target.value)}
            >
              <option value="all">Everyone · all saved places</option>
              {[...names.entries()]
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([id, name]) => (
                  <option key={id} value={id}>{id === userId ? 'You' : name}</option>
                ))}
            </select>
            <p className="mt-1 text-xs text-muted">Shows places that cousin has rated, as a record of places they’ve been.</p>
          </div>

          <div role="tablist" aria-label="How to view places" className="grid grid-cols-2 gap-2">
            {(['map', 'list'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                className={`seg !min-h-11 items-center ${view === v ? 'seg-on' : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'map' ? 'Map' : 'List'}
              </button>
            ))}
          </div>
        </>
      )}

      {(view === 'map' || picking || places.length === 0) && (
        <>
          <PlaceMap
            places={picking ? places : shown}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            picking={picking}
            onPick={(lat, lng) => setFlow({ step: 'form', lat, lng, name: '', address: '' })}
            pin={pin}
            focus={focus}
          />
          <section className="card !p-3" aria-label="Map legend">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-extrabold">Map key</h2>
              <span className="text-xs text-muted">Your family, on the map</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <div className="flex items-center gap-2">
                <span className="pin pin-round pin-been !static !block shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium">Place visited</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="pin pin-sq pin-been !static !block shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium">Restaurant visited</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="pin pin-round pin-want !static !block shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium">Place to explore</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="pin pin-sq pin-want !static !block shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium">Restaurant to try</span>
              </div>
            </div>
            {places.length > 0 && shown.length === 0 && (
              <p className="mt-3 border-t border-line pt-3 text-sm font-semibold text-muted">No places match these filters. Try changing your selection.</p>
            )}
          </section>
        </>
      )}

      {view === 'list' && !picking && places.length > 0 && (
        <section className="card">
          {sorted.length === 0 ? (
            <p className="text-muted">Nothing matches your filters.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sorted.map((p) => {
                const avg = averageStars(byPlace.get(p.id))
                return (
                  <li key={p.id}>
                    <button type="button" className="flex min-h-14 w-full items-center gap-3 py-1 text-left" onClick={() => setSelectedId(p.id)}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                        <span className="block truncate text-sm text-muted">
                          {kindLabel(p)} · {statusLabel(p.status)}
                        </span>
                      </span>
                      <span className="flex-none text-sm font-bold text-accent-text" aria-label={avg === null ? 'No ratings' : `${avg} out of 5`}>
                        {avg === null ? '' : `${starText(avg)} ${avg}`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {places.length === 0 && !picking && (
        <div className="card">
          <p className="font-semibold">No places yet.</p>
        </div>
      )}

      {flow.step === 'where' && (
        <Sheet title="Where is it?" onClose={() => setFlow({ step: 'none' })}>
          <PlaceFinder onFound={found} onPickOnMap={() => setFlow({ step: 'pick' })} onCancel={() => setFlow({ step: 'none' })} />
        </Sheet>
      )}

      {flow.step === 'form' && (
        <Sheet title="Add a place" onClose={() => setFlow({ step: 'none' })}>
          <PlaceForm
            key={`${flow.lat},${flow.lng}`}
            initial={{ lat: flow.lat, lng: flow.lng, name: flow.name, address: flow.address }}
            places={places}
            submitLabel="Save place"
            onCancel={() => setFlow({ step: 'none' })}
            onUseExisting={(p) => {
              setFlow({ step: 'none' })
              show(p)
            }}
            onSubmit={async (v) => {
              const r = await addPlace(family.id, v)
              if (r.error || !r.id) return r.error ?? 'Could not save that place.'
              await load()
              setFlow({ step: 'none' })
              setFocus({ lat: v.lat, lng: v.lng, tick: Date.now() })
              setSelectedId(r.id)
              say('Saved')
              return null
            }}
          />
        </Sheet>
      )}

      {selected && (
        <PlaceSheet
          key={selected.id}
          place={selected}
          places={places}
          ratings={byPlace.get(selected.id) ?? []}
          names={names}
          userId={userId}
          isOwner={isOwner}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onNotice={say}
        />
      )}
    </div>
  )
}
