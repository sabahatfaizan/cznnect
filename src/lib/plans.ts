// Pure helpers for polls and bucket lists. No network and no screens in here, so they can be tested alone.

export type Horizon = 'month' | 'year' | 'life'

export type Poll = {
  id: string
  family_id: string
  question: string
  closed: boolean
  created_by: string | null
  created_at: string
}
export type PollOption = { id: string; poll_id: string; label: string; position: number }
export type PollVote = { poll_id: string; user_id: string; option_id: string }

export type BucketItem = {
  id: string
  family_id: string
  title: string
  notes: string | null
  horizon: Horizon
  due_date: string | null
  assigned_to: string | null
  done: boolean
  done_at: string | null
  done_by: string | null
  created_by: string | null
  created_at: string
}
export type ItemVote = { item_id: string; user_id: string }

export const HORIZONS: { id: Horizon; label: string; hint: string }[] = [
  { id: 'month', label: 'This month', hint: 'Things to do soon' },
  { id: 'year', label: 'This year', hint: 'Plans for the year' },
  { id: 'life', label: 'Lifetime', hint: 'Big dreams' },
]

export function horizonLabel(h: Horizon): string {
  return HORIZONS.find((x) => x.id === h)?.label ?? h
}

// ---------- polls ----------

export type Tally = { option: PollOption; count: number; percent: number; mine: boolean; leading: boolean }

// Counts the votes for each choice, in the order the choices were written.
// Votes for a choice that no longer exists are ignored.
export function tally(options: PollOption[], votes: PollVote[], userId: string): { rows: Tally[]; total: number } {
  const sorted = [...options].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label))
  const counts = new Map<string, number>(sorted.map((o) => [o.id, 0]))
  let mineId: string | null = null
  for (const v of votes) {
    if (!counts.has(v.option_id)) continue
    counts.set(v.option_id, (counts.get(v.option_id) as number) + 1)
    if (v.user_id === userId) mineId = v.option_id
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const top = Math.max(0, ...counts.values())
  const rows = sorted.map((option) => {
    const count = counts.get(option.id) as number
    return {
      option,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
      mine: option.id === mineId,
      leading: top > 0 && count === top,
    }
  })
  return { rows, total }
}

export function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = m.get(k)
    if (list) list.push(r)
    else m.set(k, [r])
  }
  return m
}

// Choices as typed in the form: trimmed, blanks dropped, repeats (ignoring case) dropped.
export function cleanChoices(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of raw) {
    const t = r.trim().replace(/\s+/g, ' ')
    const k = t.toLowerCase()
    if (!t || seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

// ---------- dates ----------

// Dates are plain 'YYYY-MM-DD' text, and "today" is passed in, so the answer never depends on the clock or time zone.
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000)
}

export function localToday(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export function daysUntil(due: string, today: string): number {
  return dayNumber(due) - dayNumber(today)
}

export type DueState = 'none' | 'overdue' | 'soon' | 'later'

export function dueState(due: string | null, today: string, soonDays = 7): DueState {
  if (!due) return 'none'
  const d = daysUntil(due, today)
  if (d < 0) return 'overdue'
  return d <= soonDays ? 'soon' : 'later'
}

export function dueText(due: string | null, today: string): string {
  if (!due) return ''
  const d = daysUntil(due, today)
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  if (d === -1) return '1 day overdue'
  if (d < 0) return `${-d} days overdue`
  if (d <= 14) return `Due in ${d} days`
  const [y, m, day] = due.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `Due ${day} ${months[m - 1]} ${y}`
}

// ---------- bucket list ----------

export type Show = 'open' | 'done' | 'mine'

export function filterItems(items: BucketItem[], opts: { horizon: Horizon; show: Show; userId: string }): BucketItem[] {
  return items.filter((i) => {
    if (i.horizon !== opts.horizon) return false
    if (opts.show === 'done') return i.done
    if (i.done) return false
    if (opts.show === 'mine') return i.assigned_to === opts.userId
    return true
  })
}

// Open items: overdue first, then the nearest deadline, then undated; ties go to the item more people want.
// Done items: most recently finished first.
export function sortItems(items: BucketItem[], votes: Map<string, ItemVote[]>, today: string): BucketItem[] {
  const n = (i: BucketItem) => votes.get(i.id)?.length ?? 0
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done && b.done) return (b.done_at ?? '').localeCompare(a.done_at ?? '') || a.title.localeCompare(b.title)
    const da = a.due_date ? daysUntil(a.due_date, today) : Infinity
    const db = b.due_date ? daysUntil(b.due_date, today) : Infinity
    if (da !== db) return da < db ? -1 : 1
    return n(b) - n(a) || a.title.localeCompare(b.title)
  })
}

export function counts(items: BucketItem[]): Record<Horizon, { open: number; done: number }> {
  const c: Record<Horizon, { open: number; done: number }> = {
    month: { open: 0, done: 0 },
    year: { open: 0, done: 0 },
    life: { open: 0, done: 0 },
  }
  for (const i of items) c[i.horizon][i.done ? 'done' : 'open']++
  return c
}
