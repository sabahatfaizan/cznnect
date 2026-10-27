// Available themes: Tactical HUD, Red Dead, Uncharted, and owner-only Liquid Glass.
// The choice is saved on this device, so each cousin picks their own.
export type ThemePref = 'tactical' | 'rdr2' | 'uncharted' | 'mw4' | 'glass'
type Theme = 'tactical' | 'rdr2' | 'uncharted' | 'mw4' | 'glass'

const KEY = 'cznnect-theme'
const UNLOCKS_KEY = 'cznnect-unlocked-themes'
const UNLOCK_EVENT = 'cznnect-theme-unlocked'

export type ExclusiveTheme = 'rdr2' | 'uncharted'

export function getUnlockedThemes(): ExclusiveTheme[] {
  try {
    const saved = JSON.parse(localStorage.getItem(UNLOCKS_KEY) || '[]')
    return (Array.isArray(saved) ? saved : []).filter((v): v is ExclusiveTheme => v === 'rdr2' || v === 'uncharted')
  } catch {
    return []
  }
}

export function isThemeUnlocked(theme: ExclusiveTheme): boolean {
  return getUnlockedThemes().includes(theme)
}

export function unlockTheme(theme: ExclusiveTheme): boolean {
  const unlocked = getUnlockedThemes()
  if (unlocked.includes(theme)) return false
  try { localStorage.setItem(UNLOCKS_KEY, JSON.stringify([...unlocked, theme])) } catch { /* This visit can still unlock it. */ }
  window.dispatchEvent(new CustomEvent(UNLOCK_EVENT, { detail: theme }))
  return true
}

export function onThemeUnlocked(callback: (theme: ExclusiveTheme) => void) {
  const handler = (event: Event) => callback((event as CustomEvent<ExclusiveTheme>).detail)
  window.addEventListener(UNLOCK_EVENT, handler)
  return () => window.removeEventListener(UNLOCK_EVENT, handler)
}

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'rdr2' && !isThemeUnlocked('rdr2')) return 'tactical'
    if (v === 'uncharted' && !isThemeUnlocked('uncharted')) return 'tactical'
    if (v === 'tactical' || v === 'rdr2' || v === 'uncharted' || v === 'mw4' || v === 'glass') return v
    // Migrate removed themes to Tactical HUD so existing users don't land on a retired appearance.
  } catch {
    // Storage can be blocked. Fall back to the default.
  }
  return 'tactical'
}

// Liquid Glass is cosmetic and owner-only. Shell tells us who is signed in; until then, or for anyone
// else, a saved "glass" choice falls back to Tactical HUD, so there is no flash of a retired theme before sign-in. (Hiding the option is not a security boundary.)
let glassAllowed = false
export function setGlassAllowed(allowed: boolean) {
  if (glassAllowed === allowed) return
  glassAllowed = allowed
  applyTheme(getThemePref())
}

function resolve(pref: ThemePref): Theme {
  if (pref === 'rdr2' || pref === 'uncharted' || pref === 'mw4') return pref
  if (pref === 'glass') return glassAllowed ? 'glass' : 'tactical'
  return pref
}

export function applyTheme(pref: ThemePref) {
  const theme = resolve(pref)
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'tactical' ? '#0c0e0b' : theme === 'rdr2' ? '#171310' : theme === 'uncharted' ? '#e8d9b5' : theme === 'mw4' ? '#06090c' : theme === 'glass' ? '#070b16' : '#0c0e0b')
}

export function setThemePref(pref: ThemePref) {
  if (pref === 'rdr2' && !isThemeUnlocked('rdr2')) pref = 'tactical'
  if (pref === 'uncharted' && !isThemeUnlocked('uncharted')) pref = 'tactical'
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // The theme still changes for this visit.
  }
  applyTheme(pref)
}


