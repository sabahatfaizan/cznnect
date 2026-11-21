// App icon: the picture on the phone's Home Screen, the browser tab and new shortcuts. Light (pale square, blue mark)
// and Dark (blue square, white mark) follow the app's light and dark themes and are free. The coloured icons are part of
// Cznnect+ (the paid tier). The logo inside the app is not affected.
// An icon that is already on a phone's Home Screen keeps its look until the app is removed and added again.
import { setLauncherIcon } from './lib/native'

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

export function applyIcon(id: IconId = getIconPref()) {
  if (id === 'light') {
    setLink('icon', null)
    setLink('apple-touch-icon', null)
  } else {
    setLink('icon', renderIcon(id, 192))
    setLink('apple-touch-icon', renderIcon(id, 180))
  }
  // In the Android app this also switches the launcher icon on the home screen.
  setLauncherIcon(id)
}

export function setIconPref(id: IconId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // The icon still changes for this visit.
  }
  applyIcon(id)
}
