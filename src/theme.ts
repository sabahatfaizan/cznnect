// Themes: Light, Dark, Midnight (black) and Dusk (dark purple) are open to everyone; Liquid Glass is owner-only.
// The choice is saved on this device, so each cousin has their own.
// The retired Red Dead, Uncharted and Moon Knight themes are gone. Their old unlock names stay only because the
// avatar and icon packs that came with them still use them.
export type ThemePref = 'light' | 'dark' | 'midnight' | 'dusk' | 'glass'
export type ExclusiveTheme = 'rdr2' | 'uncharted' | 'moonknight' | 'moonpaper'

export const EXCLUSIVE_THEMES: ExclusiveTheme[] = ['rdr2', 'uncharted', 'moonknight', 'moonpaper']
const ALL_THEMES: ThemePref[] = ['light', 'dark', 'midnight', 'dusk', 'glass']
const RETIRED_THEMES = ['rdr2', 'uncharted', 'moonknight', 'moonpaper']

const KEY = 'cznnect-theme'
const UNLOCKS_KEY = 'cznnect-unlocked-themes'
const CHANGE_EVENT = 'cznnect-unlocks-changed'

const isExclusive = (t: string): t is ExclusiveTheme => (EXCLUSIVE_THEMES as string[]).includes(t)

export function getUnlockedThemes(): ExclusiveTheme[] {
  try {
    const saved = JSON.parse(localStorage.getItem(UNLOCKS_KEY) || '[]')
    const list = (Array.isArray(saved) ? saved : []).filter(isExclusive)
    // The Moon Knight code unlocks both of its looks (Ink and Paper).
    if (list.includes('moonknight') && !list.includes('moonpaper')) list.push('moonpaper')
    return list
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

// Fires whenever the unlocked set changes in either direction (for screens that list themes).
export function onUnlocksChanged(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v && (ALL_THEMES as string[]).includes(v)) return v as ThemePref
    // Retired themes become Midnight, the nearest dark look.
    if (v && RETIRED_THEMES.includes(v)) return 'midnight'
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
  midnight: '#000000',
  dusk: '#15101f',
  glass: '#070b16',
}

export function applyTheme(pref: ThemePref) {
  const theme: ThemePref = pref === 'glass' && !glassAllowed ? 'dark' : pref
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // The theme still changes for this visit.
  }
  applyTheme(pref)
}
