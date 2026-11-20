import { supabase } from '../supabase'
import { withTimeout } from './net'

// The public side of Events: what a person sees after scanning an invite QR with any camera app, with or without an account.
// Everything goes through a few database functions that anyone may call (supabase/28_event_public_join.sql).
export type PublicEvent = { title: string; place: string | null; details: string | null; starts_at: string; host_name: string }
export type PublicTicket = { guest_name: string; checked_in: boolean; title: string; place: string | null; starts_at: string }
type Res<T> = { ok: true; data: T } | { ok: false; message: string }

const OFFLINE = 'Could not reach the server. Check your connection and try again.'
const NOT_SET_UP = 'This invite is not ready yet. Ask the host to try again later.'

function friendly(e: { message: string; code?: string }): string {
  if (e.code === 'PGRST202' || e.code === '42883') return NOT_SET_UP
  return e.message
}

// Which public page the address asks for: ?join=CODE (an invite) or ?ticket=ID (a guest's own ticket).
export function readPublicLink(search = typeof location === 'undefined' ? '' : location.search): { join: string } | { ticket: string } | null {
  const q = new URLSearchParams(search)
  const join = q.get('join')
  if (join && /^[A-Za-z0-9]{4,12}$/.test(join)) return { join: join.toUpperCase() }
  const ticket = q.get('ticket')
  if (ticket && /^[0-9a-f-]{36}$/i.test(ticket)) return { ticket: ticket.toLowerCase() }
  return null
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Res<T>> {
  try {
    const r = await withTimeout(supabase.rpc(fn, args))
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: r.data as T }
  } catch {
    return { ok: false, message: OFFLINE }
  }
}

export async function eventInfo(code: string): Promise<Res<PublicEvent>> {
  const r = await rpc<PublicEvent | null>('public_event_info', { p_code: code })
  if (!r.ok) return r
  return r.data ? { ok: true, data: r.data } : { ok: false, message: 'This invite link is no longer valid.' }
}

export type Rsvp = { name: string; phone: string; email: string; note: string }
export const rsvp = (code: string, d: Rsvp) =>
  rpc<string>('public_event_join', { p_code: code, p_name: d.name, p_phone: d.phone || null, p_email: d.email || null, p_note: d.note || null })

export async function ticketInfo(guestId: string): Promise<Res<PublicTicket>> {
  const r = await rpc<PublicTicket | null>('public_event_ticket', { p_guest: guestId })
  if (!r.ok) return r
  return r.data ? { ok: true, data: r.data } : { ok: false, message: 'This ticket could not be found.' }
}

// Remember a ticket on this phone, so reopening the link later still shows it.
const KEY = 'cznnect-guest-tickets'
export function savedTicket(code: string): string | null {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>)[code] ?? null } catch { return null }
}
export function saveTicket(code: string, guestId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>
    all[code] = guestId
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch { /* private window: the ticket page link still works */ }
}

// A person with an account who scanned the QR: after they sign in, the app joins them to this event.
const PENDING = 'cznnect-pending-join'
export const setPendingJoin = (code: string) => { try { localStorage.setItem(PENDING, code) } catch { /* ignore */ } }
export function takePendingJoin(): string | null {
  try {
    const c = localStorage.getItem(PENDING)
    if (c) localStorage.removeItem(PENDING)
    return c
  } catch { return null }
}
