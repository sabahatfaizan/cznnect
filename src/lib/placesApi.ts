// Every change to places and ratings goes through here, so errors always come back as
// plain sentences the screens can show.
import { supabase } from '../supabase'
import { withTimeout } from './net'
import type { PlaceKind, PlaceStatus } from './places'

export type PlaceValues = {
  name: string
  kind: PlaceKind
  cuisine: string
  status: PlaceStatus
  address: string
  notes: string
  visited_on: string // '' when unknown
  lat: number
  lng: number
  album_url?: string // only sent when given, so saving still works before supabase/26_place_visits.sql is run
  clear_album?: boolean
}

type DbError = { message: string; code?: string }

function friendly(e: DbError): string {
  if (e.code === '23505') return 'That place is already saved at this spot.'
  if (e.code === '42501') return 'You do not have permission to do that.'
  if (e.code === '23514') return 'Please check the details. A name is required, and some fields have a length limit.'
  if (e.code === 'PGRST205' || e.code === '42P01') {
    return 'The places tables are not set up yet. In Supabase, run supabase/05_places.sql.'
  }
  return e.message
}

const ALBUM_SETUP =
  'The photo album link needs one more setup step: in Supabase, open SQL Editor, paste supabase/26_place_visits.sql and press Run. Until then, clear the album box to save the rest.'

// Saving a link before that file was run fails with a missing-column or permission error: say what to do instead.
function albumAware(err: string | null, v: PlaceValues): string | null {
  if (!err) return err
  const touched = Boolean(v.album_url?.trim()) || Boolean(v.clear_album)
  if (/album_url/.test(err) || (touched && /do not have permission/.test(err))) return ALBUM_SETUP
  return err
}

async function run<T>(
  fn: () => PromiseLike<{ data: T | null; error: DbError | null }>,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const r = await withTimeout(fn())
    return { data: r.data, error: r.error ? friendly(r.error) : null }
  } catch {
    return { data: null, error: 'Could not reach the server. Check your connection and try again.' }
  }
}

function clean(v: PlaceValues) {
  const restaurant = v.kind === 'restaurant'
  return {
    name: v.name.trim(),
    kind: v.kind,
    cuisine: restaurant ? v.cuisine.trim() || null : null,
    status: v.status,
    address: v.address.trim() || null,
    notes: v.notes.trim() || null,
    visited_on: v.status === 'been' ? v.visited_on || null : null,
    lat: v.lat,
    lng: v.lng,
    ...(v.album_url?.trim() ? { album_url: v.album_url.trim() } : v.clear_album ? { album_url: null } : {}),
  }
}

export async function addPlace(familyId: string, v: PlaceValues): Promise<{ id: string | null; error: string | null }> {
  const r = await run<{ id: string }>(() =>
    supabase.from('places').insert({ family_id: familyId, ...clean(v) }).select('id').single(),
  )
  return { id: r.data?.id ?? null, error: albumAware(r.error, v) }
}

export async function updatePlace(id: string, v: PlaceValues): Promise<string | null> {
  const r = await run<{ id: string }[]>(() => supabase.from('places').update(clean(v)).eq('id', id).select('id'))
  if (r.error) return albumAware(r.error, v)
  return (r.data?.length ?? 0) === 0 ? 'Could not save. This place may have been removed.' : null
}

export async function deletePlace(id: string): Promise<string | null> {
  const r = await run<{ id: string }[]>(() => supabase.from('places').delete().eq('id', id).select('id'))
  if (r.error) return r.error
  return (r.data?.length ?? 0) === 0 ? 'Only the owner or the person who added this can remove it.' : null
}

export async function ratePlace(placeId: string, stars: number, comment: string): Promise<string | null> {
  const r = await run<null>(() => supabase.rpc('rate_place', { pid: placeId, stars_in: stars, comment_in: comment }))
  return r.error
}

export async function removeRating(placeId: string, userId: string): Promise<string | null> {
  const r = await run<{ place_id: string }[]>(() =>
    supabase.from('place_ratings').delete().eq('place_id', placeId).eq('user_id', userId).select('place_id'),
  )
  return r.error
}

export type Found = { label: string; lat: number; lng: number }

// Looks a name or address up on OpenStreetMap's free search (Nominatim). It is only called
// when someone presses Search, which keeps well inside its fair-use limit.
export async function searchPlace(query: string): Promise<{ results: Found[]; error: string | null }> {
  const q = query.trim()
  if (q.length < 2) return { results: [], error: null }
  try {
    const res = await withTimeout(
      fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`, {
        headers: { Accept: 'application/json' },
      }),
      15000,
    )
    if (!res.ok) return { results: [], error: 'The search service is busy. Try again in a moment.' }
    const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[]
    const results = rows
      .map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    return { results, error: null }
  } catch {
    return { results: [], error: 'Could not search. Check your connection, or pick the spot on the map instead.' }
  }
}

// "I've been here": add or change your own visit. Needs supabase/26_place_visits.sql.
export async function markVisited(placeId: string, date: string): Promise<string | null> {
  const r = await run<null>(() => supabase.rpc('mark_place_visited', { pid: placeId, on_date: date || null }))
  if (r.error && /mark_place_visited|schema cache/.test(r.error)) return 'This needs supabase/26_place_visits.sql to be run in Supabase first.'
  return r.error
}

// Takes your own visit back. Row rules mean only your own row can ever be removed.
export async function removeMyVisit(placeId: string): Promise<string | null> {
  const r = await run<{ place_id: string }[]>(() => supabase.from('place_visits').delete().eq('place_id', placeId).select('place_id'))
  return r.error
}
