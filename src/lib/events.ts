import { supabase } from '../supabase'
import { withTimeout } from './net'

export type EventRow = { id: string; host_id: string; host_name: string; title: string; place: string | null; details: string | null; starts_at: string; code: string }
export type Guest = { event_id: string; user_id: string; guest_name: string; joined_at: string; checked_in_at: string | null }
type Res<T> = { ok: true; data: T } | { ok: false; message: string }

const COLS = 'id, host_id, host_name, title, place, details, starts_at, code'

function friendly(e: { message: string; code?: string }): string {
  if (e.code === 'PGRST205' || e.code === '42P01' || e.code === 'PGRST202') return 'Events are not set up yet. In Supabase, run supabase/27_events.sql.'
  if (e.code === '42501') return 'You do not have permission to do that.'
  return e.message
}
const offline = 'Could not reach the server. Check your connection and try again.'

// QR texts. The invite QR carries the event code; a guest's ticket QR carries who they are for the door check-in.
export const inviteText = (code: string) => `cznnect-event:${code}`
export const ticketText = (eventId: string, userId: string) => `cznnect-ticket:${eventId}:${userId}`
export function readInvite(text: string): string | null {
  const m = /^cznnect-event:([A-Za-z0-9]{4,12})$/.exec(text.trim())
  return m ? m[1].toUpperCase() : null
}
export function readTicket(text: string): { eventId: string; userId: string } | null {
  const m = /^cznnect-ticket:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(text.trim())
  return m ? { eventId: m[1].toLowerCase(), userId: m[2].toLowerCase() } : null
}

// Every event this person hosts or has joined (the app owner gets all of them).
export async function loadEvents(): Promise<Res<EventRow[]>> {
  try {
    const r = await withTimeout(supabase.from('events').select(COLS).order('starts_at', { ascending: false }).limit(200))
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: (r.data ?? []) as EventRow[] }
  } catch { return { ok: false, message: offline } }
}

export async function createEvent(userId: string, hostName: string, e: { title: string; place: string; details: string; startsAt: Date }): Promise<Res<null>> {
  try {
    const r = await withTimeout(supabase.from('events').insert({
      host_id: userId, host_name: hostName, title: e.title.trim(), place: e.place.trim() || null, details: e.details.trim() || null, starts_at: e.startsAt.toISOString(),
    }))
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: null }
  } catch { return { ok: false, message: offline } }
}

export async function deleteEvent(id: string): Promise<Res<null>> {
  try {
    const r = await withTimeout(supabase.from('events').delete().eq('id', id))
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: null }
  } catch { return { ok: false, message: offline } }
}

export async function joinEvent(code: string): Promise<Res<string>> {
  try {
    const r = await withTimeout(supabase.rpc('join_event', { p_code: code }))
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: String(r.data) }
  } catch { return { ok: false, message: offline } }
}

export async function leaveEvent(eventId: string, userId: string): Promise<Res<null>> {
  try {
    const r = await withTimeout(supabase.from('event_guests').delete().eq('event_id', eventId).eq('user_id', userId))
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: null }
  } catch { return { ok: false, message: offline } }
}

export async function loadGuests(eventId: string): Promise<Res<Guest[]>> {
  try {
    const r = await withTimeout(supabase.from('event_guests').select('event_id, user_id, guest_name, joined_at, checked_in_at').eq('event_id', eventId).order('joined_at'))
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: (r.data ?? []) as Guest[] }
  } catch { return { ok: false, message: offline } }
}

export async function checkIn(eventId: string, userId: string, present: boolean): Promise<Res<null>> {
  try {
    const r = await withTimeout(supabase.rpc('check_in_guest', { p_event: eventId, p_user: userId, p_present: present }))
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: null }
  } catch { return { ok: false, message: offline } }
}
