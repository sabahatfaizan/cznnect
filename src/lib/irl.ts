// Pure helpers for Convoy: reading QR text, ranking, achievements, dates.
// No network and no screens in here, so they can be tested alone.
// The database decides every point. Nothing here can award or change points.

export type Person = { user_id: string; name: string; confirmed: boolean; avatar?: string | null }
export type Meetup = {
  id: string
  kind: 'pair' | 'group'
  title: string | null
  status: 'pending' | 'open' | 'locked' | 'verified' | 'cancelled' | 'expired'
  host_id: string | null
  expires_at: string
  ended_at: string | null
  points_each: number | null
  join_code: string | null
  my_points: number | null
  people: Person[]
}

export type Row = {
  user_id: string
  name: string
  avatar?: string | null
  points: number
  meetups: number
  cousins_met: number
  biggest_group: number
  hosted_big: boolean
  last_at: string | null
}

export type Recent = {
  id: string
  kind: 'pair' | 'group'
  title: string | null
  verified_at: string
  points_each: number | null
  people: { user_id: string; name: string; points: number; avatar?: string | null }[]
}

// ---------- QR text ----------

export type Scanned = { type: 'person'; payload: string } | { type: 'group'; payload: string }

// Reads what a camera or a typed code gives us. Accepts spaces, dots and dashes, any case.
// Anything else (a website, someone else's QR) is ignored.
export function parseScanned(text: string): Scanned | null {
  const s = (text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const group = /^CZN1G([0-9A-F]{8})$/.exec(s)
  if (group) return { type: 'group', payload: `CZN1G.${group[1]}` }
  const person = /^CZN1([0-9A-F]{8})([0-9A-F]{10})$/.exec(s)
  if (person) return { type: 'person', payload: `CZN1.${person[1]}.${person[2]}` }
  return null
}

export function personPayload(handle: string, code: string): string {
  return `CZN1.${handle}.${code}`
}

export function groupPayload(joinCode: string): string {
  return `CZN1G.${joinCode}`
}

// The same code in easy-to-read chunks, for typing it in when the camera will not work.
export function readableCode(payload: string): string {
  const p = parseScanned(payload)
  if (!p) return payload
  const s = p.payload.replace(/[^A-Z0-9]/g, '')
  const head = p.type === 'group' ? 5 : 4
  const rest = s.slice(head).match(/.{1,4}/g) ?? []
  return [s.slice(0, head), ...rest].join(' ')
}

// ---------- points shown on screen (the database applies the real rule) ----------

export function pointsFor(kind: 'pair' | 'group', people: number): number {
  return kind === 'pair' ? 10 : Math.min(40, 10 + 5 * Math.max(0, people - 2))
}

// ---------- ranking ----------

export type Ranked<T> = T & { rank: number }

// Highest points first. People with the same points share a rank (1, 2, 2, 4).
export function rankRows<T extends { name: string; points: number; meetups?: number }>(rows: T[]): Ranked<T>[] {
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || (b.meetups ?? 0) - (a.meetups ?? 0) || a.name.localeCompare(b.name),
  )
  let rank = 0
  let prev: number | null = null
  return sorted.map((r, i) => {
    if (prev === null || r.points !== prev) rank = i + 1
    prev = r.points
    return { ...r, rank }
  })
}

export type LedgerLine = { user_id: string; points: number; created_at: string }

// Points earned from a date onwards (for "This month").
export function pointsSince(ledger: LedgerLine[], sinceIso: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of ledger) {
    if (l.created_at < sinceIso) continue
    m.set(l.user_id, (m.get(l.user_id) ?? 0) + l.points)
  }
  return m
}

export function startOfMonthIso(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

// ---------- achievements ----------

export type Achievement = { id: string; title: string; hint: string; earned: boolean; progress: string }

export function achievements(me: Row | undefined, familySize: number): Achievement[] {
  const r: Row = me ?? { user_id: '', name: '', points: 0, meetups: 0, cousins_met: 0, biggest_group: 0, hosted_big: false, last_at: null }
  const prog = (have: number, need: number) => `${Math.min(have, need)}/${need}`
  const others = Math.max(0, familySize - 1)
  return [
    { id: 'first', title: 'First hello', hint: 'Verify your first meetup', earned: r.meetups >= 1, progress: prog(r.meetups, 1) },
    { id: 'regular', title: 'Regular', hint: 'Verify 5 meetups', earned: r.meetups >= 5, progress: prog(r.meetups, 5) },
    { id: 'veteran', title: 'Family fixture', hint: 'Verify 15 meetups', earned: r.meetups >= 15, progress: prog(r.meetups, 15) },
    { id: 'connector', title: 'Connector', hint: 'Meet 3 different cousins', earned: r.cousins_met >= 3, progress: prog(r.cousins_met, 3) },
    {
      id: 'everyone',
      title: 'Met everyone',
      hint: 'Meet every cousin in the family',
      earned: others >= 3 && r.cousins_met >= others,
      progress: others >= 3 ? prog(r.cousins_met, others) : 'needs 4+ cousins',
    },
    { id: 'crowd', title: 'Full house', hint: 'Be part of a group of 4 or more', earned: r.biggest_group >= 4, progress: prog(r.biggest_group, 4) },
    { id: 'host', title: 'Host with the most', hint: 'Host a verified group of 4 or more', earned: r.hosted_big, progress: r.hosted_big ? '1/1' : '0/1' },
    { id: 'century', title: 'Century', hint: 'Reach 100 points', earned: r.points >= 100, progress: prog(r.points, 100) },
  ]
}

// ---------- time ----------

export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function minutesLeft(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60000))
}

// "Amina, Bashir and Dev"
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
