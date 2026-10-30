// Standard themes: Light and Dark. Red Dead, Uncharted and Moon Knight are exclusive unlocks; Liquid Glass is owner-only.
// The choice (and which exclusives are unlocked) is saved on this device, so each cousin has their own.
export type ThemePref = 'light' | 'dark' | 'rdr2' | 'uncharted' | 'moonknight' | 'glass'
export type ExclusiveTheme = 'rdr2' | 'uncharted' | 'moonknight'

export const EXCLUSIVE_THEMES: ExclusiveTheme[] = ['rdr2', 'uncharted', 'moonknight']
const ALL_THEMES: ThemePref[] = ['light', 'dark', 'rdr2', 'uncharted', 'moonknight', 'glass']

const KEY = 'cznnect-theme'
const UNLOCKS_KEY = 'cznnect-unlocked-themes'
const UNLOCK_EVENT = 'cznnect-theme-unlocked'
const CHANGE_EVENT = 'cznnect-unlocks-changed'

const isExclusive = (t: string): t is ExclusiveTheme => (EXCLUSIVE_THEMES as string[]).includes(t)

export function getUnlockedThemes(): ExclusiveTheme[] {
  try {
    const saved = JSON.parse(localStorage.getItem(UNLOCKS_KEY) || '[]')
    return (Array.isArray(saved) ? saved : []).filter(isExclusive)
  } catch {
    return []
  }
}

export function isThemeUnlocked(theme: ExclusiveTheme): boolean {
  return getUnlockedThemes().includes(theme)
}

// Returns true only the first time, so callers can tell a new unlock from a repeat.
export function unlockTheme(theme: ExclusiveTheme): boolean {
  const unlocked = getUnlockedThemes()
  if (unlocked.includes(theme)) return false
  try {
    localStorage.setItem(UNLOCKS_KEY, JSON.stringify([...unlocked, theme]))
  } catch {
    // Storage can be blocked; this visit can still use it.
  }
  window.dispatchEvent(new CustomEvent(UNLOCK_EVENT, { detail: theme }))
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return true
}

// Owner testing only: put the exclusives back behind their locks on this device.
export function relockThemes() {
  try {
    localStorage.removeItem(UNLOCKS_KEY)
  } catch {
    // Nothing to clear.
  }
  applyTheme(getThemePref())
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

// Fires when a theme is newly unlocked (for the celebration).
export function onThemeUnlocked(callback: (theme: ExclusiveTheme) => void) {
  const handler = (event: Event) => callback((event as CustomEvent<ExclusiveTheme>).detail)
  window.addEventListener(UNLOCK_EVENT, handler)
  return () => window.removeEventListener(UNLOCK_EVENT, handler)
}

// Fires whenever the unlocked set changes in either direction (for screens that list themes).
export function onUnlocksChanged(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v && isExclusive(v) && !isThemeUnlocked(v)) return 'dark'
    if (v && (ALL_THEMES as string[]).includes(v)) return v as ThemePref
    // Retired themes (Call of Duty, Tactical, Midnight) become the plain Dark theme.
    if (v === 'tactical' || v === 'mw4' || v === 'midnight') return 'dark'
  } catch {
    // Storage can be blocked. Fall back to the default.
  }
  return 'light'
}

// Liquid Glass is cosmetic and owner-only. Shell tells us who is signed in; until then, or for anyone
// else, a saved "glass" choice falls back to Dark, so there is no flash before sign-in.
// (Hiding the option is not a security boundary.)
let glassAllowed = false
export function setGlassAllowed(allowed: boolean) {
  if (glassAllowed === allowed) return
  glassAllowed = allowed
  applyTheme(getThemePref())
}

const THEME_COLOR: Record<ThemePref, string> = {
  light: '#ffffff',
  dark: '#111318',
  rdr2: '#171310',
  uncharted: '#e8d9b5',
  moonknight: '#05070d',
  glass: '#070b16',
}

export function applyTheme(pref: ThemePref) {
  const theme: ThemePref = pref === 'glass' && !glassAllowed ? 'dark' : pref
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

export function setThemePref(pref: ThemePref) {
  if (isExclusive(pref) && !isThemeUnlocked(pref)) pref = 'dark'
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // The theme still changes for this visit.
  }
  applyTheme(pref)
}
