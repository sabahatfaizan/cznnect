// Birthday helpers: which birthdays fall on a day, and the birthday email (now built with the shared Cznnect template).
// No Deno parts, so it can be tested on its own.
import { SITE, giftHtml, giftText, mediaHtml, mediaText, renderEmail, type Gift } from './emailTemplate.ts'

export { SITE }
export type { Gift }
export type Day = { year: number; month: number; day: number }

/** Today's date as people there see it (a time zone name like "Asia/Dhaka"), not the server's date. */
export function todayIn(timeZone: string, now: Date = new Date()): Day {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: n('year'), month: n('month'), day: n('day') }
}

const isLeap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)

/** True when this birthday (YYYY-MM-DD) is today. A 29 February birthday is celebrated on 28 February in years without one. */
export function birthdayIsToday(birthday: string | null | undefined, today: Day): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday ?? '')
  if (!m) return false
  const month = Number(m[2])
  const day = Number(m[3])
  if (month === today.month && day === today.day) return true
  return month === 2 && day === 29 && !isLeap(today.year) && today.month === 2 && today.day === 28
}

/** Optional birthday photo/video; email clients link to video rather than playing it inline. */
export type BirthdayMedia = { imageUrl?: string; videoUrl?: string; posterUrl?: string; caption?: string }

/** The birthday email for one person, with an optional gift card (set in the function's secrets) and optional photo or video. */
export function renderBirthday(name: string, gift?: Gift, media?: BirthdayMedia) {
  const m = media ? { ...media, imageAlt: 'Your birthday photo', videoAlt: 'Play your birthday video' } : undefined
  const extraHtml = mediaHtml(m) + giftHtml(gift)
  const extraText = [mediaText(m), giftText(gift)].filter(Boolean).join('\n\n')
  return renderEmail('birthday', { name: name.trim() || 'friend' }, { html: extraHtml, text: extraText })
}
