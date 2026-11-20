import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import QrCode from './QrCode'
import { whenText } from '../lib/gatherings'
import { guestTicketUrl, joinEvent } from '../lib/events'
import {
  eventInfo, readPublicLink, rsvp, saveTicket, savedTicket, setPendingJoin, ticketInfo,
  type PublicEvent as Info, type PublicTicket,
} from '../lib/publicEvent'

// The page a plain QR scan opens (?join=CODE). No account and no app needed: a person with no account leaves a name and a
// way to reach them and gets a ticket. A person who is already signed in joins with one tap.
// Colours are fixed (white page) so it reads the same on every phone and every theme.
const shell = 'fixed inset-0 z-50 overflow-y-auto'
const colors = { background: '#ffffff', color: '#111111' }
const muted = { color: '#555555' }
const field = 'w-full rounded-xl border px-3 py-3 text-base'
const fieldStyle = { borderColor: '#cfcfcf', background: '#ffffff', color: '#111111' }
const primary = 'w-full rounded-xl px-4 py-3 text-base font-bold disabled:opacity-60'
const primaryStyle = { background: '#111111', color: '#ffffff' }

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className={shell} style={colors}>
      <div className="mx-auto flex max-w-md flex-col gap-5 p-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <p className="text-sm font-bold tracking-widest" style={muted}>CZNNECT</p>
        {children}
      </div>
    </div>
  )
}

function EventHeader({ title, when, place, host, details }: { title: string; when: string; place: string | null; host?: string; details?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold leading-tight">{title}</h1>
      <p className="font-semibold">{when}{place ? ` · ${place}` : ''}</p>
      {host && <p className="text-sm" style={muted}>Hosted by {host}</p>}
      {details && <p className="mt-2 whitespace-pre-wrap text-sm">{details}</p>}
    </div>
  )
}

function TicketView({ code, guestId, name, checkedIn, event }: { code?: string; guestId: string; name: string; checkedIn: boolean; event: { title: string; place: string | null; starts_at: string } }) {
  return (
    <Frame>
      <EventHeader title={event.title} when={whenText(event.starts_at)} place={event.place} />
      <div className="flex flex-col items-center gap-3 rounded-2xl border p-5" style={{ borderColor: '#dddddd' }}>
        <p className="text-sm font-bold tracking-widest" style={muted}>{checkedIn ? 'CHECKED IN' : "YOU'RE IN"}</p>
        <p className="text-xl font-bold">{name}</p>
        <QrCode plain text={guestTicketUrl(guestId)} size={240} label={`Ticket for ${name}`} />
        <p className="text-center text-sm" style={muted}>
          {checkedIn ? 'The host has marked you present.' : 'Show this code at the door. Take a screenshot or save this page so you can find it again.'}
        </p>
      </div>
      {code && <p className="text-center text-xs" style={muted}>You can close this page now.</p>}
    </Frame>
  )
}

function Problem({ message }: { message: string }) {
  return <Frame><p role="alert" className="text-base font-semibold" style={{ color: '#b00020' }}>{message}</p></Frame>
}

// Opens a guest's own ticket from its link (?ticket=ID).
function TicketPage({ guestId }: { guestId: string }) {
  const [t, setT] = useState<PublicTicket | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    void ticketInfo(guestId).then((r) => (r.ok ? setT(r.data) : setErr(r.message)))
  }, [guestId])
  if (err) return <Problem message={err} />
  if (!t) return <Frame><p style={muted}>Loading…</p></Frame>
  return <TicketView guestId={guestId} name={t.guest_name} checkedIn={t.checked_in} event={t} />
}

function JoinPage({ code }: { code: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [err, setErr] = useState('')
  const [guestId, setGuestId] = useState<string | null>(() => savedTicket(code))
  const [signedIn, setSignedIn] = useState<{ name: string } | null>(null)
  const [joined, setJoined] = useState(false)
  const [d, setD] = useState({ name: '', phone: '', email: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState('')

  useEffect(() => {
    void eventInfo(code).then((r) => (r.ok ? setInfo(r.data) : setErr(r.message)))
    void supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id
      if (!uid) return
      const p = await supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle()
      setSignedIn({ name: (p.data as { display_name?: string } | null)?.display_name ?? 'your account' })
    }).catch(() => undefined)
  }, [code])

  if (err) return <Problem message={err} />
  if (!info) return <Frame><p style={muted}>Loading…</p></Frame>

  const header = <EventHeader title={info.title} when={whenText(info.starts_at)} place={info.place} host={info.host_name || undefined} details={info.details} />

  if (guestId) return <TicketView code={code} guestId={guestId} name={d.name || 'Your ticket'} checkedIn={false} event={info} />

  if (joined) {
    return (
      <Frame>
        {header}
        <p className="text-base font-semibold">You have joined. Open Cznnect, then Events, to see your ticket.</p>
        <a className={`${primary} block text-center`} style={primaryStyle} href={import.meta.env.BASE_URL}>Open Cznnect</a>
      </Frame>
    )
  }

  async function joinWithAccount() {
    setBusy(true)
    setFormErr('')
    const r = await joinEvent(code)
    setBusy(false)
    if (!r.ok) { setFormErr(r.message); return }
    setJoined(true)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormErr('')
    if (!d.name.trim()) { setFormErr('Please enter your name.'); return }
    if (!d.phone.trim() && !d.email.trim()) { setFormErr('Add a phone number or an email so the host can reach you.'); return }
    setBusy(true)
    const r = await rsvp(code, d)
    setBusy(false)
    if (!r.ok) { setFormErr(r.message); return }
    saveTicket(code, r.data)
    setGuestId(r.data)
  }

  return (
    <Frame>
      {header}
      {signedIn && (
        <div className="flex flex-col gap-2 rounded-2xl border p-4" style={{ borderColor: '#dddddd' }}>
          <p className="font-semibold">You are signed in as {signedIn.name}.</p>
          <button type="button" className={primary} style={primaryStyle} disabled={busy} onClick={() => void joinWithAccount()}>{busy ? 'Joining…' : 'Join this event'}</button>
        </div>
      )}
      <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)} noValidate>
        <p className="text-lg font-bold">{signedIn ? 'Or join as a guest' : 'Join this event'}</p>
        <p className="text-sm" style={muted}>No account or app needed. The host only sees what you enter here.</p>
        <label className="text-sm font-semibold" htmlFor="pe-name">Your name</label>
        <input id="pe-name" className={field} style={fieldStyle} maxLength={80} autoComplete="name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <label className="text-sm font-semibold" htmlFor="pe-phone">Phone</label>
        <input id="pe-phone" className={field} style={fieldStyle} type="tel" maxLength={40} autoComplete="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
        <label className="text-sm font-semibold" htmlFor="pe-email">Email</label>
        <input id="pe-email" className={field} style={fieldStyle} type="email" maxLength={120} autoComplete="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
        <p className="-mt-1 text-xs" style={muted}>Phone or email, at least one.</p>
        <label className="text-sm font-semibold" htmlFor="pe-note">Anything the host should know? (optional)</label>
        <textarea id="pe-note" className={field} style={fieldStyle} rows={2} maxLength={300} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
        {formErr && <p role="alert" className="text-sm font-semibold" style={{ color: '#b00020' }}>{formErr}</p>}
        <button type="submit" className={primary} style={primaryStyle} disabled={busy}>{busy ? 'Sending…' : 'Join as a guest'}</button>
      </form>
      {!signedIn && (
        <a className="text-center text-sm font-semibold underline underline-offset-4" href={import.meta.env.BASE_URL} onClick={() => setPendingJoin(code)}>
          I already have a Cznnect account
        </a>
      )}
    </Frame>
  )
}

export default function PublicEvent() {
  const link = readPublicLink()
  if (!link) return null
  return 'join' in link ? <JoinPage code={link.join} /> : <TicketPage guestId={link.ticket} />
}
