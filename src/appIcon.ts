// Custom app icon: a colour variant for the Cznnect mark. It recolours the logo inside the app and the
// icon the browser uses for the tab and for new Home Screen shortcuts. An icon that is already on a
// phone's Home Screen keeps its look until the app is removed and added again.
export type IconId = 'ocean' | 'sunset' | 'aurora' | 'orchid' | 'forest' | 'graphite'

export const ICONS: { id: IconId; label: string; a: string; b: string }[] = [
  { id: 'ocean', label: 'Ocean', a: '#5aa9ff', b: '#1f3fd0' },
  { id: 'sunset', label: 'Sunset', a: '#ffb347', b: '#f0286e' },
  { id: 'aurora', label: 'Aurora', a: '#2fe0b5', b: '#6a4bff' },
  { id: 'orchid', label: 'Orchid', a: '#ff82dc', b: '#7b3dff' },
  { id: 'forest', label: 'Forest', a: '#9be86e', b: '#0a8f6a' },
  { id: 'graphite', label: 'Graphite', a: '#cfd8e6', b: '#58698a' },
]

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

// The icon artwork: a gradient square with the white mark. Same shapes as the in-app logo.
export function renderIcon(id: IconId, size: number): string {
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

  // The mark sits in the middle 56% so it survives circular and rounded masks.
  const u = (size * 0.56) / 56
  g.save()
  g.translate(size / 2 - 32 * u, size / 2 - 32 * u)
  g.scale(u, u)
  g.fillStyle = '#ffffff'
  g.fill(new Path2D('M4 4H60V60H4Z M15 15V49H49V15Z'), 'evenodd')
  g.beginPath()
  g.rect(4, 4, 56, 56)
  g.clip()
  g.lineWidth = 11
  g.strokeStyle = '#ffffff'
  g.beginPath()
  g.moveTo(0, 64)
  g.lineTo(64, 0)
  g.stroke()
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
