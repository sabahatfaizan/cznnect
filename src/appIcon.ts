// Custom app icon: a colour variant for the Cznnect mark. It recolours the logo inside the app and the
// icon the browser uses for the tab and for new Home Screen shortcuts. An icon that is already on a
// phone's Home Screen keeps its look until the app is removed and added again.
import { setLauncherIcon } from './lib/native'

export type IconId =
  | 'ocean' | 'sunset' | 'aurora' | 'orchid' | 'forest' | 'graphite'
  | 'treasure' | 'libertalia' | 'outlaw' | 'dust' | 'khonshu' | 'crescent'
  | 'ocean_night' | 'sunset_night' | 'aurora_night' | 'orchid_night' | 'forest_night' | 'graphite_night'

// "a" is the main colour and "b" the deep end of the gradient. The Uncharted and Red Dead sets follow the
// colours of those two app themes (parchment, gold and leather; ember red and oxblood).
export const ICONS: { id: IconId; label: string; group: string; a: string; b: string; dark?: boolean }[] = [
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
  { id: 'ocean_night', label: 'Ocean', group: 'Night', a: '#5aa9ff', b: '#1f3fd0', dark: true },
  { id: 'sunset_night', label: 'Sunset', group: 'Night', a: '#ffb347', b: '#f0286e', dark: true },
  { id: 'aurora_night', label: 'Aurora', group: 'Night', a: '#2fe0b5', b: '#6a4bff', dark: true },
  { id: 'orchid_night', label: 'Orchid', group: 'Night', a: '#ff82dc', b: '#7b3dff', dark: true },
  { id: 'forest_night', label: 'Forest', group: 'Night', a: '#9be86e', b: '#0a8f6a', dark: true },
  { id: 'graphite_night', label: 'Graphite', group: 'Night', a: '#cfd8e6', b: '#58698a', dark: true },
]
export const ICON_GROUPS = ['Classic', 'Night']

// Classic (white background) and Night (black background) are offered. The older themed sets are no longer in the
// picker (a phone that had one chosen goes back to Ocean), but their definitions stay so the native icon list keeps matching.
export function iconGroupAvailable(group: string): boolean {
  return group === 'Classic' || group === 'Night'
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

type Ctx = CanvasRenderingContext2D
type IconDef = { a: string; b: string; dark?: boolean }
const makeCanvas = (size: number) => {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
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
const hex2 = (n: number) => n.toString(16).padStart(2, '0')
function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
// The same hex as mix(), for the one place that needs a #rrggbb string back.
function mixHex(hex: string, other: string, t: number): string {
  const [r1, g1, b1] = rgb(hex)
  const [r2, g2, b2] = rgb(other)
  const f = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `#${hex2(f(r1, r2))}${hex2(f(g1, g2))}${hex2(f(b1, b2))}`
}

// The icon artwork, flipped: a white (or black) square, and the mark carries the colour, shaded like a polished
// enamel badge: bright top-left, deep bottom-right, a soft gloss, a lit rim, and a shadow (or glow on black) under it.
// Keep in step with android-native/gen-icons.mjs, which draws the same thing for the phone's launcher icons.
function drawBackground(g: Ctx, size: number, v: IconDef) {
  const dark = !!v.dark
  const bg = g.createLinearGradient(0, 0, size, size)
  if (dark) { bg.addColorStop(0, '#1b1e26'); bg.addColorStop(0.55, '#0a0b0f'); bg.addColorStop(1, '#000000') }
  else { bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, '#f6f8fc'); bg.addColorStop(1, '#e3e8f2') }
  g.fillStyle = bg
  g.fillRect(0, 0, size, size)
  const glow = g.createRadialGradient(size * 0.5, size * 0.55, 0, size * 0.5, size * 0.55, size * 0.62)
  glow.addColorStop(0, alpha(v.a, dark ? 0.3 : 0.13))
  glow.addColorStop(1, alpha(v.a, 0))
  g.fillStyle = glow
  g.fillRect(0, 0, size, size)
}

function drawMark(g: Ctx, size: number, v: IconDef, scale: number) {
  const dark = !!v.dark
  const u = (size * scale) / 52
  const layer = makeCanvas(size)
  const L = layer.getContext('2d')
  if (!L) return
  L.translate(size / 2 - 32 * u, size / 2 - 32 * u)
  L.scale(u, u)
  const ring = new Path2D('M6 6H58V58H6Z M16 16V48H48V16Z')
  const bar = new Path2D('M3.54 67.54L67.54 3.54L60.46 -3.54L-3.54 60.46Z')
  const top = mix(v.a, '#ffffff', dark ? 0.55 : 0.42)
  const bot = dark ? mix(v.b, v.a, 0.3) : v.b
  const body = L.createLinearGradient(6, 6, 58, 58)
  body.addColorStop(0, top)
  body.addColorStop(0.42, v.a)
  body.addColorStop(1, bot)
  // 1. The solid shape: the frame, then the diagonal inside the square.
  L.fillStyle = body
  L.fill(ring, 'evenodd')
  L.save()
  L.beginPath()
  L.rect(6, 6, 52, 52)
  L.clip()
  L.fill(bar)
  L.restore()
  // Everything after this paints only onto the shape (source-atop), so edges stay clean and nothing doubles up.
  L.globalCompositeOperation = 'source-atop'
  const sheen = L.createLinearGradient(6, 6, 58, 58)
  sheen.addColorStop(0, 'rgba(255,255,255,0.55)')
  sheen.addColorStop(0.46, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.54, 'rgba(0,0,0,0)')
  sheen.addColorStop(1, dark ? 'rgba(0,0,0,0.30)' : 'rgba(5,10,40,0.42)')
  L.fillStyle = sheen
  L.fillRect(0, 0, 64, 64)
  const gloss = L.createRadialGradient(20, 14, 0, 20, 14, 30)
  gloss.addColorStop(0, 'rgba(255,255,255,0.55)')
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  L.fillStyle = gloss
  L.fillRect(0, 0, 64, 64)
  const rim = L.createLinearGradient(6, 6, 58, 58)
  rim.addColorStop(0, 'rgba(255,255,255,0.95)')
  rim.addColorStop(0.45, 'rgba(255,255,255,0.15)')
  rim.addColorStop(0.55, 'rgba(0,0,0,0.12)')
  rim.addColorStop(1, dark ? 'rgba(0,0,0,0.55)' : alpha(v.b, 0.85))
  L.strokeStyle = rim
  L.lineWidth = 2.6
  L.lineJoin = 'miter'
  L.stroke(ring)
  L.save()
  L.beginPath()
  L.rect(16, 16, 32, 32)
  L.clip()
  L.lineWidth = 2.4
  L.stroke(bar)
  L.restore()
  L.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : alpha(mixHex(v.b, '#000000', 0.5), 0.55)
  L.lineWidth = 1.1
  L.stroke(ring)
  L.globalCompositeOperation = 'source-over'

  g.save()
  g.shadowColor = dark ? alpha(v.a, 0.55) : 'rgba(15,25,70,0.38)'
  g.shadowBlur = size * (dark ? 0.06 : 0.035)
  g.shadowOffsetY = size * (dark ? 0 : 0.022)
  g.drawImage(layer, 0, 0)
  g.restore()
}

export function renderIcon(id: IconId, size: number, scale = 0.58): string {
  const v = find(id)
  const c = makeCanvas(size)
  const g = c.getContext('2d')
  if (!g) return ''
  drawBackground(g, size, v)
  drawMark(g, size, v, scale)
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
