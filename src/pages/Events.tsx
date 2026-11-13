import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import Sheet from '../components/Sheet'
import { Icon } from '../components/Icons'
import QrCode from '../components/QrCode'
import QrScanner from '../components/QrScanner'
import { whenText } from '../lib/gatherings'
import {
  checkIn, createEvent, deleteEvent, inviteText, joinEvent, leaveEvent, loadEvents, loadGuests, readInvite, readTicket, ticketText,
  type EventRow, type Guest,
} from '../lib/events'

const pad = (n: number) => String(n).padStart(2, '0')
const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Events: anyone can host one, guests join with a code or QR and show a ticket QR at the door, the host scans it to mark
// them present (everyone else who joined stays absent). The app owner can see and manage every event.
export default function Events({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [myName, setMyName] = useState('')

  const load = useCallback(async () => {
    const r = await loadEvents()
    if (r.ok) { setEvents(r.data); setError('') } else setError(r.message)
    setLoaded(true)
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    void supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle().then((r: { data: { display_name?: string } | null }) => setMyName(r.data?.display_name ?? ''))
  }, [userId])

  const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(''), 4000) }
  const hosting = events.filter((e) => e.host_id === userId)
  const attending = events.filter((e) => e.host_id !== userId && !isOwner)
  const others = isOwner ? events.filter((e) => e.host_id !== userId) : []
  const open = events.find((e) => e.id === openId) ?? null

  const row = (e: EventRow, tag?: string) => (
    <li key={e.id}>
      <button type="button" className="flex w-full items-center gap-3 py-2.5 text-left" onClick={() => setOpenId(e.id)}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{e.title}</p>
          <p className="text-sm text-muted">{whenText(e.starts_at)}{e.place ? ` · ${e.place}` : ''}</p>
          {tag && <p className="text-xs text-muted">{tag}</p>}
        </div>
        <span aria-hidden="true" className="menu-chevron">›</span>
      </button>
    </li>
  )
  const section = (title: string, list: EventRow[], empty: string, tag?: (e: EventRow) => string) => (
    <section className="card flex flex-col gap-2" aria-label={title}>
      <h2 className="eyebrow">{title}</h2>
      {list.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <ul className="flex flex-col divide-y divide-[var(--line)]">{list.map((e) => row(e, tag?.(e)))}</ul>}
    </section>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <div className="flex gap-2">
          <button type="button" className="btn btn-plain !min-h-9 !px-3 !text-xs" onClick={() => setJoining(true)}>Join</button>
          <button type="button" className="btn btn-primary !min-h-9 gap-1.5 !px-3 !text-xs" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Host</button>
        </div>
      </div>
      {notice && <p role="status" className="text-sm font-semibold">{notice}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {loaded && !error && (
        <>
          {section('Hosting', hosting, 'You are not hosting anything yet. Tap Host to start one.')}
          {!isOwner && section('Going to', attending, 'Nothing yet. Tap Join and enter a code or scan an invite QR.', (e) => `Hosted by ${e.host_name || 'someone'}`)}
          {isOwner && section('All other events (you supervise these)', others, 'No one else has hosted an event yet.', (e) => `Hosted by ${e.host_name || 'someone'}`)}
        </>
      )}

      {creating && <HostSheet userId={userId} name={myName} onClose={() => setCreating(false)} onDone={() => { setCreating(false); flash('Event created.'); void load() }} />}
      {joining && <JoinSheet onClose={() => setJoining(false)} onJoined={(id) => { setJoining(false); void load().then(() => setOpenId(id)) }} />}
      {open && (
        <EventSheet
          event={open}
          userId={userId}
          isOwner={isOwner}
          onClose={() => setOpenId(null)}
          onGone={(m) => { setOpenId(null); flash(m); void load() }}
        />
      )}
    </div>
  )
}

function HostSheet({ userId, name, onClose, onDone }: { userId: string; name: string; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [details, setDetails] = useState('')
  const [date, setDate] = useState(() => dateInput(new Date(Date.now() + 86400_000)))
  const [time, setTime] = useState('18:00')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    setErr('')
    const startsAt = new Date(`${date}T${time}`)
    if (!title.trim()) { setErr('Give the event a name.'); return }
    if (Number.isNaN(startsAt.getTime())) { setErr('Pick a date and time.'); return }
    setBusy(true)
    const r = await createEvent(userId, name, { title, place, details, startsAt })
    setBusy(false)
    if (!r.ok) { setErr(r.message); return }
    onDone()
  }
  return (
    <Sheet title="Host an event" onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <label className="label" htmlFor="ev-title">Event name</label>
        <input id="ev-title" className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="ev-date">Date</label>
            <input id="ev-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="ev-time">Time</label>
            <input id="ev-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <label className="label" htmlFor="ev-place">Where? (optional)</label>
        <input id="ev-place" className="input" maxLength={120} value={place} onChange={(e) => setPlace(e.target.value)} />
        <label className="label" htmlFor="ev-details">Details (optional)</label>
        <textarea id="ev-details" className="input" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button type="submit" className="btn btn-primary !min-h-11 !text-sm" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button>
      </form>
    </Sheet>
  )
}

function JoinSheet({ onClose, onJoined }: { onClose: () => void; onJoined: (id: string) => void }) {
  const [code, setCode] = useState('')
  const [scan, setScan] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  async function go(c: string) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setErr('')
    const r = await joinEvent(c)
    busyRef.current = false
    setBusy(false)
    if (!r.ok) { setErr(r.message); return }
    onJoined(r.data)
  }
  return (
    <Sheet title="Join an event" onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void go(code.trim()) }}>
        <label className="label" htmlFor="ev-code">Event code</label>
        <input id="ev-code" className="input uppercase" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} placeholder="A1B2C3" autoCapitalize="characters" />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button type="submit" className="btn btn-primary !min-h-11 !text-sm" disabled={busy || !code.trim()}>{busy ? 'Joining…' : 'Join'}</button>
        <button type="button" className="btn btn-plain !min-h-11 gap-2 !text-sm" onClick={() => setScan((s) => !s)}><Icon name="camera" size={18} />{scan ? 'Close camera' : 'Scan the invite QR'}</button>
        {scan && <QrScanner onText={(t) => { const c = readInvite(t); if (c) void go(c) }} />}
      </form>
    </Sheet>
  )
}

function EventSheet({ event, userId, isOwner, onClose, onGone }: { event: EventRow; userId: string; isOwner: boolean; onClose: () => void; onGone: (message: string) => void }) {
  const manage = event.host_id === userId || isOwner
  const [guests, setGuests] = useState<Guest[]>([])
  const [err, setErr] = useState('')
  const [scan, setScan] = useState(false)
  const [msg, setMsg] = useState('')
  const lastScan = useRef('')

  const refresh = useCallback(async () => {
    const r = await loadGuests(event.id)
    if (r.ok) { setGuests(r.data); setErr('') } else setErr(r.message)
  }, [event.id])
  useEffect(() => { void refresh() }, [refresh])

  const present = guests.filter((g) => g.checked_in_at).length
  const mine = guests.find((g) => g.user_id === userId)

  async function mark(uid: string, on: boolean) {
    const r = await checkIn(event.id, uid, on)
    if (!r.ok) { setMsg(r.message); return false }
    await refresh()
    return true
  }
  async function scanned(text: string) {
    const t = readTicket(text)
    if (!t || lastScan.current === text) return
    lastScan.current = text
    window.setTimeout(() => { lastScan.current = '' }, 3000)
    if (t.eventId !== event.id) { setMsg('That ticket is for a different event.'); return }
    const who = guests.find((g) => g.user_id === t.userId)?.guest_name || 'Guest'
    if (await mark(t.userId, true)) setMsg(`${who} is present.`)
  }
  async function remove() {
    if (!window.confirm('Delete this event and its guest list?')) return
    const r = await deleteEvent(event.id)
    if (!r.ok) { setMsg(r.message); return }
    onGone('Event deleted.')
  }
  async function leave() {
    if (!window.confirm('Leave this event?')) return
    const r = await leaveEvent(event.id, userId)
    if (!r.ok) { setMsg(r.message); return }
    onGone('You left the event.')
  }

  return (
    <Sheet title={event.title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-semibold">{whenText(event.starts_at)}{event.place ? ` · ${event.place}` : ''}</p>
          <p className="text-sm text-muted">Hosted by {event.host_id === userId ? 'you' : event.host_name || 'someone'}</p>
          {event.details && <p className="mt-2 whitespace-pre-wrap text-sm">{event.details}</p>}
        </div>
        {msg && <p role="status" className="text-sm font-semibold">{msg}</p>}
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}

        {mine && (
          <div className="flex flex-col items-center gap-2">
            <p className="eyebrow">Your ticket</p>
            <QrCode text={ticketText(event.id, userId)} label={`Ticket for ${event.title}`} size={220} />
            <p className="text-sm font-semibold">{mine.checked_in_at ? 'You are checked in.' : 'Show this at the door.'}</p>
          </div>
        )}

        {manage && (
          <>
            <div className="flex flex-col items-center gap-2">
              <p className="eyebrow">Invite guests</p>
              <QrCode text={inviteText(event.code)} label={`Invite to ${event.title}`} size={200} />
              <p className="text-sm text-muted">Or share the code <span className="font-bold tracking-widest text-current">{event.code}</span></p>
            </div>
            <button type="button" className="btn btn-primary !min-h-11 gap-2 !text-sm" onClick={() => setScan((s) => !s)}>
              <Icon name="camera" size={18} />{scan ? 'Close scanner' : 'Scan tickets at the door'}
            </button>
            {scan && <QrScanner onText={(t) => void scanned(t)} />}
            <div className="flex flex-col gap-2">
              <p className="eyebrow">Guests · {present} present, {guests.length - present} absent</p>
              {guests.length === 0 ? <p className="text-sm text-muted">No one has joined yet.</p> : (
                <ul className="flex flex-col divide-y divide-[var(--line)]">
                  {guests.map((g) => (
                    <li key={g.user_id} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1 truncate font-semibold">{g.guest_name || 'Guest'}</span>
                      <span className={`text-xs font-bold ${g.checked_in_at ? '' : 'text-muted'}`}>{g.checked_in_at ? 'Present' : 'Absent'}</span>
                      <button type="button" className="rounded-lg px-2 py-1 text-xs font-bold underline underline-offset-4" onClick={() => void mark(g.user_id, !g.checked_in_at)}>
                        {g.checked_in_at ? 'Undo' : 'Mark present'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" className="btn btn-plain !min-h-11 !text-sm text-danger" onClick={() => void remove()}>Delete event</button>
          </>
        )}
        {!manage && mine && <button type="button" className="btn btn-plain !min-h-11 !text-sm" onClick={() => void leave()}>Leave event</button>}
      </div>
    </Sheet>
  )
}
