import { supabase } from '../supabase'
import { withTimeout } from './net'

export type Gathering = { id: string; host_id: string; title: string; place: string | null; starts_at: string }

const NOT_SET_UP = 'Gatherings are not set up yet. In Supabase, run supabase/24_gatherings.sql.'

function friendly(e: { message: string; code?: string }): string {
  if (e.code === 'PGRST205' || e.code === '42P01') return NOT_SET_UP
  if (e.code === '42501') return 'You do not have permission to do that.'
  return e.message
}

// Upcoming gatherings, soonest first. One that started a few hours ago still shows, so it does not vanish mid-party.
export async function upcomingGatherings(familyId: string): Promise<{ ok: true; data: Gathering[] } | { ok: false; message: string }> {
  try {
    const since = new Date(Date.now() - 3 * 3600_000).toISOString()
    const r = await withTimeout(
      supabase.from('gatherings').select('id, host_id, title, place, starts_at').eq('family_id', familyId).gte('starts_at', since).order('starts_at').limit(20),
    )
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: (r.data ?? []) as Gathering[] }
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection and try again.' }
  }
}

export async function addGathering(familyId: string, userId: string, g: { title: string; place: string; startsAt: Date }): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const r = await withTimeout(
      supabase.from('gatherings').insert({ family_id: familyId, host_id: userId, title: g.title.trim(), place: g.place.trim() || null, starts_at: g.startsAt.toISOString() }),
    )
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection and try again.' }
  }
}

export async function removeGathering(id: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const r = await withTimeout(supabase.from('gatherings').delete().eq('id', id))
    return r.error ? { ok: false, message: friendly(r.error) } : { ok: true }
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection and try again.' }
  }
}

export function whenText(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

// Tells the whole family. It goes out the same way as a chat message, so it also shows in the family chat.
export async function announceGathering(familyId: string, g: { title: string; place: string; startsAt: Date }): Promise<{ ok: boolean; message?: string }> {
  const text = `Gathering: ${g.title.trim()}, ${whenText(g.startsAt.toISOString())}${g.place.trim() ? ` at ${g.place.trim()}` : ''}`.slice(0, 200)
  try {
    const { data, error } = await supabase.functions.invoke('send-push', { body: { body: text, family_id: familyId } })
    if (data?.error) return { ok: false, message: String(data.error) }
    if (error) return { ok: false, message: 'The notification could not be sent.' }
    return { ok: true }
  } catch {
    return { ok: false, message: 'The notification could not be sent.' }
  }
}
