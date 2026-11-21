// App icon: the picture on the phone's Home Screen, the browser tab and new shortcuts. Light (white square, blue mark)
// and Dark (black square, white mark) follow the app's light and dark themes and are free. The coloured icons are part of
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

// Light and Dark use the same picture as the logo inside the app (a gradient with a dark edge, a light rim and a recessed
// channel). A canvas can't draw that edge, so they are ready-made pictures in public/icons, made by
// android-native/gen-icons.mjs. The coloured icons are still drawn flat below.
const READY: Partial<Record<IconId, { small: string; big: string }>> = {
  light: { small: 'icons/apple-touch-icon.png', big: 'icons/icon-192.png' },
  dark: { small: 'icons/dark-180.png', big: 'icons/dark-192.png' },
}

// The flat artwork, kept as plain as it can be: a flat square and the mark in one colour (the O is the frame, the Z is
// the diagonal). android-native/gen-icons.mjs draws the same thing for the phone's launcher icons.
export function renderIcon(id: IconId, size: number, scale = 0.6): string {
  const ready = READY[id]
  if (ready) return import.meta.env.BASE_URL + (size <= 180 ? ready.small : ready.big)
  const v = find(id)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  if (!g) return ''
  g.fillStyle = v.bg
  g.fillRect(0, 0, size, size)
  const u = (size * scale) / 52
  g.translate(size / 2 - 32 * u, size / 2 - 32 * u)
  g.scale(u, u)
  g.fillStyle = v.mark
  g.fill(new Path2D('M6 6H58V58H6Z M16 16V48H48V16Z'), 'evenodd')
  g.beginPath()
  g.rect(6, 6, 52, 52)
  g.clip()
  g.fill(new Path2D('M3.54 67.54L67.54 3.54L60.46 -3.54L-3.54 60.46Z'))
  return c.toDataURL('image/png')
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
