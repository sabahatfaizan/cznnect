import { useState } from 'react'
import Sheet from './Sheet'
import PlaceForm from './PlaceForm'
import { averageStars, kindLabel, mapsLink, starText, statusLabel, type Place, type Rating } from '../lib/places'
import { deletePlace, ratePlace, removeRating, updatePlace } from '../lib/placesApi'

type Mode = 'view' | 'edit' | 'delete'

// One place: details, everyone's ratings, your own rating, edit and remove.
export default function PlaceSheet({
  place,
  places,
  ratings,
  names,
  userId,
  isOwner,
  onClose,
  onChanged,
  onNotice,
}: {
  place: Place
  places: Place[]
  ratings: Rating[]
  names: Map<string, string>
  userId: string
  isOwner: boolean
  onClose: () => void
  onChanged: () => Promise<void> | void
  onNotice: (message: string) => void
}) {
  const mine = ratings.find((r) => r.user_id === userId)
  const [mode, setMode] = useState<Mode>('view')
  const [stars, setStars] = useState(mine?.stars ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const avg = averageStars(ratings)
  const canRemove = place.created_by === userId || isOwner
  const when = place.visited_on ? ` · ${place.visited_on}` : ''

  async function saveRating() {
    if (stars < 1) {
      setError('Tap the stars to choose a rating.')
      return
    }
    setBusy(true)
    setError('')
    const problem = await ratePlace(place.id, stars, comment)
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    await onChanged()
    onNotice('Rating saved')
  }

  async function clearRating() {
    setBusy(true)
    setError('')
    const problem = await removeRating(place.id, userId)
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    setStars(0)
    setComment('')
    await onChanged()
    onNotice('Rating removed')
  }

  async function remove() {
    setBusy(true)
    const problem = await deletePlace(place.id)
    setBusy(false)
    if (problem) {
      setError(problem)
      setMode('view')
      return
    }
    await onChanged()
    onClose()
    onNotice('Removed')
  }

  if (mode === 'edit') {
    return (
      <Sheet title="Edit place" onClose={() => setMode('view')}>
        <PlaceForm
          initial={{ ...place, cuisine: place.cuisine ?? '', address: place.address ?? '', notes: place.notes ?? '', visited_on: place.visited_on ?? '' }}
          places={places}
          editingId={place.id}
          submitLabel="Save"
          onCancel={() => setMode('view')}
          onSubmit={async (v) => {
            const problem = await updatePlace(place.id, v)
            if (problem) return problem
            await onChanged()
            setMode('view')
            onNotice('Saved')
            return null
          }}
        />
      </Sheet>
    )
  }

  if (mode === 'delete') {
    return (
      <Sheet title="Remove this place?" onClose={() => setMode('view')}>
        <p className="mb-4">
          <b>{place.name}</b> and everyone’s ratings for it will be removed for the whole family. This cannot be undone.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-plain" onClick={() => setMode('view')}>
            Keep it
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={remove}>
            {busy ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={place.name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-semibold">
            {kindLabel(place)} · {statusLabel(place.status)}
            {when}
          </p>
          {place.address && <p className="text-muted">{place.address}</p>}
          <p className="mt-1 font-bold" aria-label={avg === null ? 'No ratings yet' : `Average ${avg} out of 5`}>
            {avg === null ? (
              <span className="text-muted">No ratings yet</span>
            ) : (
              <>
                <span aria-hidden="true">{starText(avg)}</span> {avg} <span className="font-semibold text-muted">({ratings.length})</span>
              </>
            )}
          </p>
        </div>

        {place.notes && <p className="whitespace-pre-wrap">{place.notes}</p>}

        <a className="btn btn-plain" href={mapsLink(place.lat, place.lng)} target="_blank" rel="noopener noreferrer">
          Open in Maps
        </a>

        <section className="card flex flex-col gap-3">
          <h3 className="font-display text-lg font-bold">Your rating</h3>
          <div role="radiogroup" aria-label="Your rating" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                className="flex size-12 items-center justify-center text-3xl"
                style={{ color: n <= stars ? 'var(--accent)' : 'var(--muted)' }}
                onClick={() => setStars(n)}
              >
                {n <= stars ? '★' : '☆'}
              </button>
            ))}
          </div>
          <textarea
            className="input"
            aria-label="Comment (optional)"
            placeholder="What did you think? (optional)"
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          )}
          <div className={`grid gap-3 ${mine ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {mine && (
              <button className="btn btn-plain" disabled={busy} onClick={clearRating}>
                Remove mine
              </button>
            )}
            <button className="btn btn-primary" disabled={busy} onClick={saveRating}>
              {busy ? 'Saving...' : mine ? 'Update rating' : 'Save rating'}
            </button>
          </div>
        </section>

        {ratings.length > 0 && (
          <section>
            <h3 className="eyebrow mb-1">Family ratings</h3>
            <ul className="divide-y divide-line">
              {ratings.map((r) => (
                <li key={r.user_id} className="py-2">
                  <p className="font-semibold">
                    {names.get(r.user_id) ?? 'A cousin'}
                    {r.user_id === userId ? ' (you)' : ''} <span aria-hidden="true">{starText(r.stars)}</span>
                    <span className="sr-only">{r.stars} out of 5</span>
                  </p>
                  {r.comment && <p className="text-muted">{r.comment}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className={`grid gap-3 ${canRemove ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button className="btn btn-plain" onClick={() => setMode('edit')}>
            Edit
          </button>
          {canRemove && (
            <button className="btn btn-plain" onClick={() => setMode('delete')}>
              Remove
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
