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

export function notificationState(): 'unsupported' | 'denied' | 'default' | 'granted' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

async function show(title: string, body: string, tag: string) {
  try {
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
  if (!prefs.enabled || notificationState() !== 'granted') return
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

export async function askPermission(): Promise<'unsupported' | 'denied' | 'default' | 'granted'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    await Notification.requestPermission()
  } catch {
    // Older browsers use a callback form; the state below still reflects the result.
  }
  return notificationState()
}
