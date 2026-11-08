import type { Upcoming } from './birthdays'
import { callPlugin, isNative } from './native'

// Device reminders. In the Android app they are scheduled with the phone's own alarm clock (notification plugin), so they
// arrive at 9:00 in the morning even when the app is closed; the app plans them again each time it is opened. In a
// browser they appear when the app is opened, once per person per type per day (browsers cannot wake a closed page).
export type ReminderPrefs = { enabled: boolean; today: boolean; tomorrow: boolean; week: boolean }

const PREFS_KEY = 'cznnect-bday-prefs'
const SEEN_KEY = 'cznnect-bday-seen'
const DEFAULTS: ReminderPrefs = { enabled: false, today: true, tomorrow: true, week: true }

export function loadPrefs(): ReminderPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function savePrefs(p: ReminderPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // Private mode: the choice just will not stick.
  }
}

type Perm = 'unsupported' | 'denied' | 'default' | 'granted'

// In the Android app the web view has no Notification support, so the app's own notification plugin is used
// (added when the APK is built). It is reached through the global the app wrapper provides.
type NativeNotifications = {
  checkPermissions: () => Promise<{ display: string }>
  requestPermissions: () => Promise<{ display: string }>
  schedule: (o: { notifications: { id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle?: boolean } }[] }) => Promise<unknown>
  cancel: (o: { notifications: { id: number }[] }) => Promise<unknown>
}
// The notification plugin is added to the APK when it is built, after the web code is bundled, so the web code never
// imports it. The app's bridge script has no ready-made plugin objects, so each call goes through it by plugin name.
// If the app was built without the plugin, the calls fail and the reminders switch explains that.
let nativeInstance: NativeNotifications | null | undefined
function nativePlugin(): NativeNotifications | null {
  if (!isNative()) return null
  if (nativeInstance === undefined) {
    const call = (method: string, options: Record<string, unknown> = {}) => callPlugin('LocalNotifications', method, options)
    nativeInstance = {
      checkPermissions: () => call('checkPermissions') as Promise<{ display: string }>,
      requestPermissions: () => call('requestPermissions') as Promise<{ display: string }>,
      schedule: (o) => call('schedule', o),
      cancel: (o) => call('cancel', o),
    }
  }
  return nativeInstance
}
function fromNative(display: string): Perm {
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default'
}

export function notificationState(): Perm {
  if (nativePlugin()) return nativeKnown
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}
let nativeKnown: Perm = 'default'

function hash(t: string): number {
  let h = 0
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0
  return Math.abs(h) % 2147483000
}

async function show(title: string, body: string, tag: string) {
  try {
    const native = nativePlugin()
    if (native) {
      await native.schedule({ notifications: [{ id: hash(tag + Date.now()), title, body, schedule: { at: new Date(Date.now() + 800) } }] })
      return
    }
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: import.meta.env.BASE_URL + 'icons/icon-192.png' })
      return
    }
    new Notification(title, { body, tag })
  } catch {
    // A blocked or unsupported notification is not worth interrupting the app for.
  }
}

const REMIND_HOUR = 9 // local time
const HORIZON_DAYS = 60
const IDS_KEY = 'cznnect-bday-ids'

export type PlannedReminder = { id: number; key: string; at: Date; title: string; body: string }

const TYPES = [
  ['today', 0],
  ['tomorrow', 1],
  ['week', 7],
] as const

// Every reminder to deliver over the next two months, each at 9:00 on its own morning. Pure, so it can be tested.
export function planReminders(upcoming: Upcoming[], prefs: ReminderPrefs): PlannedReminder[] {
  const out: PlannedReminder[] = []
  for (const u of upcoming) {
    if (u.days > HORIZON_DAYS) continue
    const who = u.isMe ? 'Your' : `${u.name}'s`
    const age = u.turning ? ` (${u.turning})` : ''
    for (const [type, offset] of TYPES) {
      if (!prefs[type]) continue
      const at = new Date(u.date.getFullYear(), u.date.getMonth(), u.date.getDate() - offset, REMIND_HOUR, 0, 0)
      const body =
        type === 'today'
          ? u.isMe
            ? `Happy birthday${u.turning ? `! You turn ${u.turning} today` : ''}.`
            : `It's ${u.name}'s birthday today${age}. Send a wish!`
          : type === 'tomorrow'
            ? `${who} birthday is tomorrow${age}.`
            : `${who} birthday is in one week${age}.`
      const key = `${u.userId}:${type}:${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`
      out.push({ id: hash(key), key, at, title: 'Birthday', body })
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

function readIds(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(IDS_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((n) => typeof n === 'number') : []
  } catch {
    return []
  }
}
function writeIds(ids: number[]) {
  try {
    localStorage.setItem(IDS_KEY, JSON.stringify(ids))
  } catch {
    // Ignore.
  }
}

// Replace everything scheduled earlier with a fresh plan. A reminder whose 9:00 already passed today (for example the
// switch was turned on at noon) is shown right away, once.
async function syncNative(native: NativeNotifications, upcoming: Upcoming[], prefs: ReminderPrefs, now: Date) {
  const old = readIds()
  if (old.length) await native.cancel({ notifications: old.map((id) => ({ id })) }).catch(() => {})
  if (!prefs.enabled) {
    writeIds([])
    return
  }
  const plan = planReminders(upcoming, prefs)
  const seen = readSeen(now)
  const later = plan.filter((r) => r.at.getTime() > now.getTime() + 5000)
  const missed = plan.filter((r) => r.at.getTime() <= now.getTime() + 5000 && sameDay(r.at, now) && !seen.seen[r.key])
  const batch = [
    ...later.map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true } })),
    ...missed.map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: new Date(now.getTime() + 1500), allowWhileIdle: true } })),
  ]
  if (batch.length) await native.schedule({ notifications: batch }).catch(() => {})
  for (const r of missed) seen.seen[r.key] = true
  writeSeen(seen)
  writeIds(batch.map((n) => n.id))
}

type Seen = { day: string; seen: Record<string, true> }
function readSeen(now: Date): Seen {
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')
    if (raw.day === day) return { day, seen: raw.seen ?? {} }
  } catch {
    // Start fresh.
  }
  return { day, seen: {} }
}
function writeSeen(v: Seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(v))
  } catch {
    // Ignore.
  }
}

// True in the Android app, where reminders are scheduled ahead and arrive with the app closed.
export function remindersAreScheduled(): boolean {
  return nativePlugin() !== null
}

// A quick check that notifications really reach the phone: sends one in a couple of seconds.
export async function sendTestReminder(title = 'Birthday reminder', body = 'This is how your reminders will look.'): Promise<'sent' | 'blocked' | 'unsupported'> {
  const native = nativePlugin()
  if (native) {
    try {
      let state = fromNative((await native.checkPermissions()).display)
      if (state !== 'granted') state = fromNative((await native.requestPermissions()).display)
      nativeKnown = state
      if (state !== 'granted') return 'blocked'
      await native.schedule({
        notifications: [{ id: hash(`test:${Date.now()}`), title, body, schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true } }],
      })
      return 'sent'
    } catch {
      return 'unsupported'
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'granted') return 'blocked'
  await show(title, body, 'test')
  return 'sent'
}

export function runReminders(upcoming: Upcoming[], prefs: ReminderPrefs, now = new Date()) {
  const native = nativePlugin()
  if (native) {
    // Android app: schedule ahead (or cancel, when switched off), once the phone allows notifications.
    if (!prefs.enabled) {
      void syncNative(native, upcoming, prefs, now)
      return
    }
    void native
      .checkPermissions()
      .then((r) => {
        nativeKnown = fromNative(r.display)
        if (nativeKnown === 'granted') return syncNative(native, upcoming, prefs, now)
      })
      .catch(() => {})
    return
  }
  if (!prefs.enabled) return
  if (notificationState() !== 'granted') return
  let seen: Record<string, true> = {}
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')
    if (raw.day === day) seen = raw.seen ?? {}
  } catch {
    // Start fresh.
  }
  for (const u of upcoming) {
    const who = u.isMe ? 'Your' : `${u.name}'s`
    const age = u.turning ? ` (${u.turning})` : ''
    let type: 'today' | 'tomorrow' | 'week' | null = null
    let text = ''
    if (u.days === 0 && prefs.today) {
      type = 'today'
      text = u.isMe ? `Happy birthday${u.turning ? `! You turn ${u.turning} today` : ''}.` : `It's ${u.name}'s birthday today${age}. Send a wish!`
    } else if (u.days === 1 && prefs.tomorrow) {
      type = 'tomorrow'
      text = `${who} birthday is tomorrow${age}.`
    } else if (u.days === 7 && prefs.week) {
      type = 'week'
      text = `${who} birthday is in one week${age}.`
    }
    if (!type) continue
    const key = `${u.userId}:${type}`
    if (seen[key]) continue
    seen[key] = true
    void show('Birthday', text, key)
  }
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ day, seen }))
  } catch {
    // Ignore.
  }
}

export async function askPermission(): Promise<Perm> {
  const native = nativePlugin()
  if (native) {
    try {
      nativeKnown = fromNative((await native.requestPermissions()).display)
    } catch {
      nativeKnown = 'unsupported'
    }
    return nativeKnown
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    await Notification.requestPermission()
  } catch {
    // Older browsers use a callback form; the state below still reflects the result.
  }
  return notificationState()
}
