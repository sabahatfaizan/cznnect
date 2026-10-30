// Custom app icon: a colour variant for the Cznnect mark. It recolours the logo inside the app and the
// icon the browser uses for the tab and for new Home Screen shortcuts. An icon that is already on a
// phone's Home Screen keeps its look until the app is removed and added again.
import type { ExclusiveTheme } from './theme'

export type IconId =
  | 'ocean' | 'sunset' | 'aurora' | 'orchid' | 'forest' | 'graphite'
  | 'treasure' | 'libertalia' | 'outlaw' | 'dust' | 'khonshu' | 'crescent'

// "a" is the main colour and "b" the deep end of the gradient. The Uncharted and Red Dead sets follow the
// colours of those two app themes (parchment, gold and leather; ember red and oxblood).
export const ICONS: { id: IconId; label: string; group: string; a: string; b: string }[] = [
  { id: 'ocean', label: 'Ocean', group: 'Classic', a: '#5aa9ff', b: '#1f3fd0' },
  { id: 'sunset', label: 'Sunset', group: 'Classic', a: '#ffb347', b: '#f0286e' },
  { id: 'aurora', label: 'Aurora', group: 'Classic', a: '#2fe0b5', b: '#6a4bff' },
  { id: 'orchid', label: 'Orchid', group: 'Classic', a: '#ff82dc', b: '#7b3dff' },
  { id: 'forest', label: 'Forest', group: 'Classic', a: '#9be86e', b: '#0a8f6a' },
  { id: 'graphite', label: 'Graphite', group: 'Classic', a: '#cfd8e6', b: '#58698a' },
  { id: 'treasure', label: 'Treasure Map', group: 'Uncharted', a: '#f2d58f', b: '#a8431a' },
  { id: 'libertalia', label: 'Libertalia', group: 'Uncharted', a: '#ffd36b', b: '#6b3410' },
  { id: 'outlaw', label: 'Outlaw', group: 'Red Dead', a: '#e8603f', b: '#4a0f0a' },
  { id: 'dust', label: 'Dust & Leather', group: 'Red Dead', a: '#dcbd8e', b: '#4a2c17' },
  { id: 'khonshu', label: 'Khonshu', group: 'Moon Knight', a: '#f4f4f4', b: '#111111' },
  { id: 'crescent', label: 'Crescent', group: 'Moon Knight', a: '#111111', b: '#f4f4f4' },
]
export const ICON_GROUPS = ['Classic', 'Uncharted', 'Red Dead', 'Moon Knight']

// The Uncharted and Red Dead colour sets belong to those themes, so they appear once the theme is unlocked.
export function iconGroupAvailable(group: string, unlocked: ExclusiveTheme[]): boolean {
  if (group === 'Uncharted') return unlocked.includes('uncharted')
  if (group === 'Red Dead') return unlocked.includes('rdr2')
  if (group === 'Moon Knight') return unlocked.includes('moonknight')
  return true
}

const KEY = 'cznnect-icon'

export function getIconPref(): IconId {
  try {
    const v = localStorage.getItem(KEY)
    if (ICONS.some((i) => i.id === v)) return v as IconId
  } catch {
    // Storage can be blocked. Use the default.
  }
  return 'ocean'
}

function find(id: IconId) {
  return ICONS.find((i) => i.id === id) ?? ICONS[0]
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(hex: string, other: string, t: number): string {
  const [r1, g1, b1] = rgb(hex)
  const [r2, g2, b2] = rgb(other)
  const f = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${f(r1, r2)} ${f(g1, g2)} ${f(b1, b2)})`
}

// The icon artwork: a gradient square with the mark in light metal, a dark outline round every edge
// and a thin bright rim just inside them. Same shapes as the in-app logo.
export function renderIcon(id: IconId, size: number, scale = 0.58): string {
  const v = find(id)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  if (!g) return ''
  const bg = g.createLinearGradient(0, 0, size, size)
  bg.addColorStop(0, v.a)
  bg.addColorStop(1, v.b)
  g.fillStyle = bg
  g.fillRect(0, 0, size, size)
  const glow = g.createRadialGradient(size * 0.2, size * 0.1, 0, size * 0.2, size * 0.1, size * 0.9)
  glow.addColorStop(0, 'rgb(255 255 255 / 0.28)')
  glow.addColorStop(1, 'rgb(255 255 255 / 0)')
  g.fillStyle = glow
  g.fillRect(0, 0, size, size)

  // The mark sits in the middle 58% so it survives circular and rounded masks.
  const u = (size * scale) / 52
  g.save()
  g.translate(size / 2 - 32 * u, size / 2 - 32 * u)
  g.scale(u, u)
  const ring = new Path2D('M6 6H58V58H6Z M16 16V48H48V16Z')
  const bar = new Path2D('M3.54 67.54L67.54 3.54L60.46 -3.54L-3.54 60.46Z')
  const edge = mix(v.b, '#000000', 0.55)
  const fill = g.createLinearGradient(6, 6, 58, 58)
  fill.addColorStop(0, '#ffffff')
  fill.addColorStop(1, mix(v.a, '#ffffff', 0.55))

  // 1. Outline: stroke both shapes dark; the fills below cover the inner halves and the seams.
  g.save()
  g.beginPath()
  g.rect(6 - 3, 6 - 3, 52 + 6, 52 + 6)
  g.clip()
  g.strokeStyle = edge
  g.lineWidth = 3
  g.lineJoin = 'miter'
  g.stroke(ring)
  g.restore()
  g.save()
  g.beginPath()
  g.rect(6, 6, 52, 52)
  g.clip()
  g.strokeStyle = edge
  g.lineWidth = 3
  g.stroke(bar)
  g.fillStyle = fill
  g.fill(bar)
  g.restore()
  // 2. Fill the frame, then the bar over it.
  g.fillStyle = fill
  g.fill(ring, 'evenodd')
  g.save()
  g.beginPath()
  g.rect(6, 6, 52, 52)
  g.clip()
  g.fillStyle = fill
  g.fill(bar)
  g.restore()
  // 3. Rim light just inside the frame's edges (clipped to the frame), then along the bar inside the opening.
  g.save()
  g.clip(ring, 'evenodd')
  g.strokeStyle = 'rgb(255 255 255 / 0.9)'
  g.lineWidth = 2.4
  g.stroke(ring)
  g.restore()
  g.save()
  g.beginPath()
  g.rect(16, 16, 32, 32)
  g.clip()
  g.clip(bar)
  g.strokeStyle = 'rgb(255 255 255 / 0.9)'
  g.lineWidth = 2.4
  g.stroke(bar)
  g.restore()
  g.restore()
  return c.toDataURL('image/png')
}

function setLink(rel: string, href: string | null) {
  const el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) return
  if (!el.dataset.original) el.dataset.original = el.getAttribute('href') ?? ''
  el.setAttribute('href', href ?? el.dataset.original)
}

export function applyIcon(id: IconId = getIconPref()) {
  const v = find(id)
  const root = document.documentElement
  root.style.setProperty('--logo-a', v.a)
  root.style.setProperty('--logo-b', v.b)
  root.style.setProperty('--logo-hi', mix(v.a, '#ffffff', 0.45))
  root.style.setProperty('--logo-edge', mix(v.b, '#000000', 0.5))
  if (id === 'ocean') {
    setLink('icon', null)
    setLink('apple-touch-icon', null)
  } else {
    setLink('icon', renderIcon(id, 192))
    setLink('apple-touch-icon', renderIcon(id, 180))
  }
}

export function setIconPref(id: IconId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // The icon still changes for this visit.
  }
  applyIcon(id)
}
