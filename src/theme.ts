// Available themes: Tactical HUD, RDR2, Uncharted, and owner-only Liquid Glass.
// The choice is saved on this device, so each cousin picks their own.
export type ThemePref = 'tactical' | 'rdr2' | 'uncharted' | 'glass'
type Theme = 'tactical' | 'rdr2' | 'uncharted' | 'glass'

const KEY = 'cznnect-theme'

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'tactical' || v === 'rdr2' || v === 'uncharted' || v === 'glass') return v
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
  if (pref === 'rdr2' || pref === 'uncharted') return pref
  if (pref === 'glass') return glassAllowed ? 'glass' : 'tactical'
  return pref
}

export function applyTheme(pref: ThemePref) {
  const theme = resolve(pref)
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'tactical' ? '#0c0e0b' : theme === 'rdr2' ? '#171310' : theme === 'uncharted' ? '#e8d9b5' : theme === 'glass' ? '#070b16' : '#0c0e0b')
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // The theme still changes for this visit.
  }
  applyTheme(pref)
}


