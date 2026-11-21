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

// Light and Dark are shaded: one soft gradient runs across the whole mark (the frame and the slash are a single piece, so
// there is no seam), with a light glow at the top-left and a deeper tone at the bottom-right. The coloured icons stay
// flat. android-native/gen-icons.mjs has a copy of these numbers; keep the two in step.
export type Shade = { bg: [string, string]; stops: [string, string, string]; glow: [string, number]; deep: [string, number] }
export const SHADES: Partial<Record<IconId, Shade>> = {
  light: { bg: ['#ffffff', '#edf2ff'], stops: ['#6c9dff', '#2a5ceb', '#0d2c9e'], glow: ['#ffffff', 0.38], deep: ['#06185f', 0.35] },
  dark: { bg: ['#17191f', '#000000'], stops: ['#ffffff', '#dde3f0', '#8f9ab5'], glow: ['#ffffff', 0.45], deep: ['#4a556f', 0.35] },
}

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function fillBackground(g: CanvasRenderingContext2D, size: number, id: IconId, flat: string) {
  const s = SHADES[id]
  if (s) {
    const grad = g.createLinearGradient(0, 0, size, size)
    grad.addColorStop(0, s.bg[0])
    grad.addColorStop(1, s.bg[1])
    g.fillStyle = grad
  } else {
    g.fillStyle = flat
  }
  g.fillRect(0, 0, size, size)
}

// The mark is drawn on its own layer first, so the gradients only land on the mark and never on the background.
function drawShadedMark(g: CanvasRenderingContext2D, size: number, scale: number, s: Shade) {
  const layer = document.createElement('canvas')
  layer.width = layer.height = size
  const l = layer.getContext('2d')
  if (!l) return
  const u = (size * scale) / 52
  l.translate(size / 2 - 32 * u, size / 2 - 32 * u)
  l.scale(u, u)
  l.fillStyle = '#000000'
  l.fill(new Path2D('M6 6H58V58H6Z M16 16V48H48V16Z'), 'evenodd')
  l.save()
  l.beginPath()
  l.rect(6, 6, 52, 52)
  l.clip()
  l.fill(new Path2D('M3.54 67.54L67.54 3.54L60.46 -3.54L-3.54 60.46Z'))
  l.restore()
  l.globalCompositeOperation = 'source-in'
  const base = l.createLinearGradient(10, 6, 54, 58)
  base.addColorStop(0, s.stops[0])
  base.addColorStop(0.5, s.stops[1])
  base.addColorStop(1, s.stops[2])
  l.fillStyle = base
  l.fillRect(6, 6, 52, 52)
  l.globalCompositeOperation = 'source-atop'
  const glow = l.createRadialGradient(20, 14, 0, 20, 14, 34)
  glow.addColorStop(0, rgba(s.glow[0], s.glow[1]))
  glow.addColorStop(1, rgba(s.glow[0], 0))
  l.fillStyle = glow
  l.fillRect(6, 6, 52, 52)
  const deep = l.createRadialGradient(56, 58, 0, 56, 58, 30)
  deep.addColorStop(0, rgba(s.deep[0], s.deep[1]))
  deep.addColorStop(1, rgba(s.deep[0], 0))
  l.fillStyle = deep
  l.fillRect(6, 6, 52, 52)
  g.drawImage(layer, 0, 0)
}

// The artwork: a square and the mark (the O is the frame, the Z is the diagonal). Light and Dark are shaded (see above);
// the coloured icons are flat, in one colour. android-native/gen-icons.mjs draws the same thing for the phone's launcher icons.
export function renderIcon(id: IconId, size: number, scale = 0.6): string {
  const v = find(id)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  if (!g) return ''
  fillBackground(g, size, v.id, v.bg)
  const shade = SHADES[v.id]
  if (shade) {
    drawShadedMark(g, size, scale, shade)
    return c.toDataURL('image/png')
  }
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
