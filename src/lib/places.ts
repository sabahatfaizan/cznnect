// Pure helpers for places and ratings. No network and no screens in here, so they can be tested alone.

export type PlaceKind = 'place' | 'restaurant'
export type PlaceStatus = 'been' | 'want'

export type Place = {
  id: string
  family_id: string
  name: string
  kind: PlaceKind
  cuisine: string | null
  status: PlaceStatus
  lat: number
  lng: number
  address: string | null
  notes: string | null
  visited_on: string | null
  created_by: string | null
  created_at: string
}

export type Rating = {
  place_id: string
  user_id: string
  stars: number
  comment: string | null
  updated_at: string
}

export type KindFilter = 'all' | PlaceKind
export type StatusFilter = 'all' | PlaceStatus

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function groupRatings(ratings: Rating[]): Map<string, Rating[]> {
  const m = new Map<string, Rating[]>()
  for (const r of ratings) {
    const list = m.get(r.place_id)
    if (list) list.push(r)
    else m.set(r.place_id, [r])
  }
  return m
}

// Average of the family's stars, or null when nobody has rated yet.
export function averageStars(ratings: Rating[] | undefined): number | null {
  if (!ratings || ratings.length === 0) return null
  const sum = ratings.reduce((a, r) => a + r.stars, 0)
  return Math.round((sum / ratings.length) * 10) / 10
}

export function starText(n: number): string {
  const full = Math.max(0, Math.min(5, Math.round(n)))
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

export function filterPlaces(
  places: Place[],
  opts: { kind: KindFilter; status: StatusFilter; query: string },
): Place[] {
  const q = normalizeName(opts.query)
  return places.filter((p) => {
    if (opts.kind !== 'all' && p.kind !== opts.kind) return false
    if (opts.status !== 'all' && p.status !== opts.status) return false
    if (!q) return true
    const hay = normalizeName(`${p.name} ${p.cuisine ?? ''} ${p.address ?? ''}`)
    return hay.includes(q)
  })
}

// Straight-line distance in kilometres (haversine).
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Places already saved that look like the one being added: the same name within about
// 2 km, or anything within 50 metres. Shown as a warning before adding, so the family
// does not end up with the same restaurant twice.
export function similarPlaces(places: Place[], name: string, lat: number, lng: number): Place[] {
  const n = normalizeName(name)
  return places
    .map((p) => ({ p, d: distanceKm(p.lat, p.lng, lat, lng) }))
    .filter(({ p, d }) => d <= 0.05 || (n.length > 0 && normalizeName(p.name) === n && d <= 2))
    .sort((a, b) => a.d - b.d)
    .map(({ p }) => p)
}

export function kindLabel(p: Pick<Place, 'kind' | 'cuisine'>): string {
  if (p.kind === 'restaurant') return p.cuisine ? `Restaurant · ${p.cuisine}` : 'Restaurant'
  return 'Place'
}

export function statusLabel(s: PlaceStatus): string {
  return s === 'been' ? 'Been there' : 'Want to go'
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`
}

// The map's starting view: fit all places, or a wide view of Bangladesh when there are none.
export function boundsOf(places: Pick<Place, 'lat' | 'lng'>[]): [[number, number], [number, number]] | null {
  if (places.length === 0) return null
  let s = 90,
    n = -90,
    w = 180,
    e = -180
  for (const p of places) {
    s = Math.min(s, p.lat)
    n = Math.max(n, p.lat)
    w = Math.min(w, p.lng)
    e = Math.max(e, p.lng)
  }
  return [
    [s, w],
    [n, e],
  ]
}

export function validLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}
