import { useCallback, useEffect, useState } from 'react'
import Sheet from './Sheet'
import { Icon } from './Icons'
import { addGathering, announceGathering, removeGathering, upcomingGatherings, whenText, type Gathering } from '../lib/gatherings'
import { familyProfiles, type ProfileLite } from '../lib/profiles'

const pad = (n: number) => String(n).padStart(2, '0')
const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Planned events in Convoy. Anyone in the family can add one; everyone else gets a notification.
export default function IrlGatherings({ familyId, userId }: { familyId: string; userId: string }) {
  const [list, setList] = useState<Gathering[]>([])
  const [names, setNames] = useState<Map<string, ProfileLite>>(new Map())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [date, setDate] = useState(() => dateInput(new Date(Date.now() + 86400_000)))
  const [time, setTime] = useState('18:00')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [r, pm] = await Promise.all([upcomingGatherings(familyId), familyProfiles(familyId)])
    setNames(pm)
    if (r.ok) { setList(r.data); setError('') } else setError(r.message)
  }, [familyId])

  useEffect(() => { void load() }, [load])

  async function create() {
    setFormError('')
    const startsAt = new Date(`${date}T${time}`)
    if (!title.trim()) { setFormError('Give the gathering a name.'); return }
    if (Number.isNaN(startsAt.getTime())) { setFormError('Pick a date and time.'); return }
    if (startsAt.getTime() < Date.now()) { setFormError('Pick a time in the future.'); return }
    setBusy(true)
    const g = { title, place, startsAt }
    const r = await addGathering(familyId, userId, g)
    if (!r.ok) { setFormError(r.message); setBusy(false); return }
    const n = await announceGathering(familyId, g)
    setBusy(false)
    setOpen(false)
    setTitle('')
    setPlace('')
    setNotice(n.ok ? 'Gathering added. Everyone has been notified.' : `Gathering added, but nobody was notified: ${n.message ?? 'try again later.'}`)
    window.setTimeout(() => setNotice(''), 5000)
    void load()
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this gathering?')) return
    const r = await removeGathering(id)
    if (!r.ok) { setNotice(r.message ?? 'Could not remove it.'); return }
    void load()
  }

  return (
    <section className="card flex flex-col gap-1.5 !p-3" aria-label="Gatherings">
      <div className="flex items-center justify-between gap-2">
        <h2 className="eyebrow">Gatherings</h2>
        <button type="button" className="btn btn-plain !min-h-7 gap-1 !px-2 !text-[11px]" onClick={() => { setFormError(''); setOpen(true) }}>
          <Icon name="plus" size={14} />
          New
        </button>
      </div>

      {notice && <p role="status" className="text-xs font-semibold">{notice}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {!error && list.length === 0 && <p className="text-xs text-muted">Nothing planned yet.</p>}

      {list.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--line)]">
          {list.slice(0, 2).map((g) => (
            <li key={g.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold leading-tight">{g.title}</p>
                <p className="truncate text-xs text-muted">{whenText(g.starts_at)}{g.place ? ` · ${g.place}` : ''} · {g.host_id === userId ? 'you' : names.get(g.host_id)?.name ?? 'a cousin'}</p>
              </div>
              {g.host_id === userId && (
                <button type="button" className="rounded-lg px-1.5 py-1 text-[11px] font-bold text-muted underline underline-offset-4" onClick={() => void remove(g.id)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Sheet title="New gathering" onClose={() => setOpen(false)}>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void create() }}>
            <label className="label" htmlFor="gath-title">What is it?</label>
            <input id="gath-title" className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eid dinner" autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="label" htmlFor="gath-date">Date</label>
                <input id="gath-date" className="input" type="date" value={date} min={dateInput(new Date())} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="label" htmlFor="gath-time">Time</label>
                <input id="gath-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <label className="label" htmlFor="gath-place">Where? (optional)</label>
            <input id="gath-place" className="input" maxLength={120} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Grandma's house" />
            {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
            <p className="text-xs text-muted">Everyone in the family gets a notification, and it also shows in the family chat.</p>
            <button type="submit" className="btn btn-primary !min-h-11 !text-sm" disabled={busy}>{busy ? 'Adding…' : 'Add and notify'}</button>
          </form>
        </Sheet>
      )}
    </section>
  )
}
