import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { shownName } from './avatars'

// Birthdays come from each member's profile. Row-level security already lets family members read
// each other's profiles, so no database change is needed.
export type BirthdayPerson = {
  userId: string
  name: string
  avatar: string | null
  birthday: string | null // 'YYYY-MM-DD'
  isMe: boolean
  isOwner: boolean
}

export type Upcoming = BirthdayPerson & {
  days: number // 0 = today
  date: Date // the next time it falls
  turning: number | null
}

export type Tier = 'today' | 'tomorrow' | 'week' | 'month' | 'later'

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

// The next date this birthday falls on, today included. 29 February is kept on 28 February in common years.
export function nextOccurrence(birthday: string, from: Date): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday)
  if (!m) return null
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  const today = startOfDay(from)
  const make = (y: number) => new Date(y, month, month === 1 && day === 29 && !isLeap(y) ? 28 : day)
  let next = make(today.getFullYear())
  if (next < today) next = make(today.getFullYear() + 1)
  return next
}

export function daysBetween(a: Date, b: Date): number {
  // Calendar days, not 24-hour blocks, so daylight saving shifts cannot move the count.
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000)
}

export function toUpcoming(p: BirthdayPerson, now: Date): Upcoming | null {
  if (!p.birthday) return null
  const next = nextOccurrence(p.birthday, now)
  if (!next) return null
  const birthYear = Number(p.birthday.slice(0, 4))
  const age = next.getFullYear() - birthYear
  return { ...p, date: next, days: daysBetween(startOfDay(now), next), turning: age > 0 && age < 130 ? age : null }
}

export function tierOf(days: number): Tier {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 7) return 'week'
  if (days <= 30) return 'month'
  return 'later'
}

export function countdownText(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days} days`
}

export function dateText(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

export function rank(people: BirthdayPerson[], now = new Date()): { upcoming: Upcoming[]; missing: BirthdayPerson[] } {
  const upcoming: Upcoming[] = []
  const missing: BirthdayPerson[] = []
  for (const p of people) {
    const u = toUpcoming(p, now)
    if (u) upcoming.push(u)
    else missing.push(p)
  }
  upcoming.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name))
  return { upcoming, missing }
}

type Row = {
  user_id: string
  role: 'owner' | 'member'
  profiles: { display_name: string; nickname: string | null; avatar: string | null; birthday: string | null } | null
}

// One query for the whole app: the menu badge, the reminders and the Birthdays page all read this.
export function useFamilyBirthdays(familyId: string, userId: string) {
  const [people, setPeople] = useState<BirthdayPerson[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const q = (cols: string) =>
      supabase.from('family_members').select(`user_id, role, profiles(${cols})`).eq('family_id', familyId).order('joined_at')
    let { data, error } = await q('display_name, nickname, avatar, birthday')
    // Falls back to the old columns until supabase/08_profile.sql has been run.
    if (error) ({ data, error } = await q('display_name, birthday'))
    if (error) {
      setError(error.message)
      return
    }
    setError('')
    setPeople(
      ((data ?? []) as unknown as Row[]).map((r) => ({
        userId: r.user_id,
        name: shownName(r.profiles),
        avatar: r.profiles?.avatar ?? null,
        birthday: r.profiles?.birthday ?? null,
        isMe: r.user_id === userId,
        isOwner: r.role === 'owner',
      })),
    )
    setLoaded(true)
  }, [familyId, userId])

  useEffect(() => {
    reload()
  }, [reload])

  return { people, loaded, error, reload }
}
