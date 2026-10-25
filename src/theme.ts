// Theme choice: Light, Tactical Dark, Midnight, private Liquid Glass, or follow the phone's setting.
// The choice is saved on this device, so each cousin picks their own.
export type ThemePref = 'light' | 'tactical' | 'midnight' | 'glass' | 'system'
type Theme = 'light' | 'tactical' | 'midnight' | 'glass'

const KEY = 'cznnect-theme'

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'tactical' || v === 'midnight' || v === 'glass' || v === 'system') return v
  } catch {
    // Storage can be blocked. Fall back to the default.
  }
  return 'light'
}

// Liquid Glass is cosmetic and owner-only. Shell tells us who is signed in; until then, or for anyone
// else, a saved "glass" choice falls back to Light. (Hiding the option is not a security boundary.)
let glassAllowed = false
export function setGlassAllowed(allowed: boolean) {
  if (glassAllowed === allowed) return
  glassAllowed = allowed
  applyTheme(getThemePref())
}

function resolve(pref: ThemePref): Theme {
  if (pref === 'glass') return glassAllowed ? 'glass' : 'light'
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'tactical' : 'light'
  }
  return pref
}

export function applyTheme(pref: ThemePref) {
  const theme = resolve(pref)
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'tactical' ? '#0c0e0b' : theme === 'midnight' ? '#05070d' : theme === 'glass' ? '#eaf3ff' : '#ffffff')
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // The theme still changes for this visit.
  }
  applyTheme(pref)
}

// Keeps "System" in step when the phone switches between light and dark.
export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getThemePref() === 'system') applyTheme('system')
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
