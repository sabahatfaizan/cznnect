// Themes: Light, Dark, Midnight (black) and Dusk (dark purple) are open to everyone; Liquid Glass is owner-only.
// The choice is saved on this device, so each cousin has their own.
export type ThemePref = 'light' | 'dark' | 'midnight' | 'dusk' | 'glass'
const ALL_THEMES: ThemePref[] = ['light', 'dark', 'midnight', 'dusk', 'glass']
const RETIRED_THEMES = ['rdr2', 'uncharted', 'moonknight', 'moonpaper']

const KEY = 'cznnect-theme'
export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v && (ALL_THEMES as string[]).includes(v)) return v as ThemePref
    // Retired themes become Midnight, the nearest dark look.
    if (v && RETIRED_THEMES.includes(v)) return 'midnight'
    // Retired themes (Call of Duty, Tactical) become the plain Dark theme.
    if (v === 'tactical' || v === 'mw4') return 'dark'
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
