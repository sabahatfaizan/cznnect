import type { Upcoming } from './birthdays'

// Device reminders. They are local: they appear when the app is opened, once per person per type per day.
// Alerts while the app is closed would need a push service, which this app does not have yet.
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
  schedule: (o: { notifications: { id: number; title: string; body: string; schedule: { at: Date } }[] }) => Promise<unknown>
}
function nativePlugin(): NativeNotifications | null {
  const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } }).Capacitor
  if (!c?.isNativePlatform?.()) return null
  return (c.Plugins?.LocalNotifications as NativeNotifications | undefined) ?? null
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

export function runReminders(upcoming: Upcoming[], prefs: ReminderPrefs, now = new Date()) {
  if (!prefs.enabled) return
  const native = nativePlugin()
  if (native && nativeKnown !== 'granted') {
    // Ask the phone once, then run again if it is allowed.
    void native.checkPermissions().then((r) => {
      nativeKnown = fromNative(r.display)
      if (nativeKnown === 'granted') runReminders(upcoming, prefs, now)
    }).catch(() => {})
    return
  }
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
