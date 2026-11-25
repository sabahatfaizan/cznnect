// App icon: the picture on the phone's Home Screen, the browser tab and new shortcuts. Everyone gets Light (pale square,
// blue mark) or Dark (blue square, white mark), and it follows the app's theme by itself: there is nothing to choose.
// The coloured icons are part of Cznnect+ (the paid tier), and only an account with it can pick one. The logo inside the
// app is not affected.
// An icon that is already on a phone's Home Screen keeps its look until the app is removed and added again.
import { setLauncherIcon } from './lib/native'
import { PLUS_EVENT, cachedPlus } from './lib/plus'
import { getThemePref, type ThemePref } from './theme'

export type IconId = 'light' | 'dark' | 'sunset' | 'aurora' | 'orchid' | 'forest' | 'graphite'

export const ICONS: { id: IconId; label: string; group: string; mark: string; bg: string }[] = [
  { id: 'light', label: 'Light', group: 'Style', mark: '#1f4fe0', bg: '#ffffff' },
  { id: 'dark', label: 'Dark', group: 'Style', mark: '#ffffff', bg: '#000000' },
  { id: 'sunset', label: 'Sunset', group: 'Cznnect+', mark: '#f0286e', bg: '#ffffff' },
  { id: 'aurora', label: 'Aurora', group: 'Cznnect+', mark: '#0fb89a', bg: '#ffffff' },
  { id: 'orchid', label: 'Orchid', group: 'Cznnect+', mark: '#8a3dff', bg: '#ffffff' },
  { id: 'forest', label: 'Forest', group: 'Cznnect+', mark: '#1d9a55', bg: '#ffffff' },
  { id: 'graphite', label: 'Graphite', group: 'Cznnect+', mark: '#4b5563', bg: '#ffffff' },
]
// The gradient colours of each coloured icon's mark [top, middle, bottom, glow]. Same values as TILE in
// android-native/gen-icons.mjs, so the loading screen's logo matches the icon on the home screen.
const MARK_COLOURS: Partial<Record<IconId, [string, string, string, string]>> = {
  sunset: ['#ff6a9a', '#f0286e', '#f2405f', '#ffb36b'],
  aurora: ['#3dddbe', '#0fb89a', '#17a9b8', '#7bd7ff'],
  orchid: ['#a56bff', '#8a3dff', '#7b4bff', '#e59bff'],
  forest: ['#4cc27f', '#1d9a55', '#1e9b6b', '#cfe96b'],
  graphite: ['#7a8596', '#4b5563', '#5a6272', '#a3b1c9'],
}
// CSS variables for the logo when a coloured icon is in use, or undefined to let the theme colour the logo.
export function iconLogoVars(id: IconId): Record<string, string> | undefined {
  const c = MARK_COLOURS[id]
  return c ? { '--logo-hi': c[0], '--logo-a': c[1], '--logo-b': c[2], '--logo-glow': c[3] } : undefined
}
export const ICON_GROUPS = ['Style', 'Cznnect+']
export const PLUS_GROUP = 'Cznnect+'
export const isPlusIcon = (id: IconId): boolean => ICONS.find((i) => i.id === id)?.group === PLUS_GROUP
export const iconGroupAvailable = (group: string): boolean => ICON_GROUPS.includes(group)

const KEY = 'cznnect-icon'

// A phone that had an icon that no longer exists chosen goes back to Light.
export function getIconPref(): IconId {
  try {
    const v = localStorage.getItem(KEY)
    if (ICONS.some((i) => i.id === v)) return v as IconId
  } catch {
    // Storage can be blocked. Use the default.
  }
  return 'light'
}

function find(id: IconId) {
  return ICONS.find((i) => i.id === id) ?? ICONS[0]
}

// The pictures are ready-made files in public/icons (app-<id>-192.png and -180.png), made by android-native/gen-icons.mjs,
// because the soft blends in them are not something a canvas can draw.
export function renderIcon(id: IconId, size: number): string {
  return import.meta.env.BASE_URL + 'icons/app-' + find(id).id + '-' + (size <= 180 ? 180 : 192) + '.png'
}

function setLink(rel: string, href: string | null) {
  const el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) return
  if (!el.dataset.original) el.dataset.original = el.getAttribute('href') ?? ''
  el.setAttribute('href', href ?? el.dataset.original)
}

// The free icon that goes with a theme: Light for the Light theme, Dark for every dark one.
export function iconForTheme(theme: ThemePref): IconId {
  return theme === 'light' ? 'light' : 'dark'
}

// The icon this account shows right now. A coloured icon is only used by an account with Cznnect+ that has picked one;
// otherwise it is the theme's own icon, so it changes by itself when the theme goes from Light to Dark. The saved pick is
// kept (not erased) when Cznnect+ is off, so it comes back if the account gets Cznnect+ again.
export function effectiveIcon(plus: boolean = cachedPlus(), theme: ThemePref = getThemePref()): IconId {
  const pick = getIconPref()
  return plus && isPlusIcon(pick) ? pick : iconForTheme(theme)
}

export function applyIcon(plus: boolean = cachedPlus()) {
  const id = effectiveIcon(plus)
  if (id === 'light') {
    setLink('icon', null)
    setLink('apple-touch-icon', null)
  } else {
    setLink('icon', renderIcon(id, 192))
    setLink('apple-touch-icon', renderIcon(id, 180))
  }
  // In the Android app this also switches the launcher icon on the home screen.
  // The home screen label also reads "Cznnect+" for a Cznnect+ account (the app uses a second launcher entry for it).
  setLauncherIcon(id, plus)
}
if (typeof window !== 'undefined') window.addEventListener(PLUS_EVENT, () => applyIcon())

// Saves the coloured icon an account with Cznnect+ picked ('light' means "follow the theme"), then shows it.
export function setIconPref(id: IconId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // The icon still changes for this visit.
  }
  applyIcon()
}
