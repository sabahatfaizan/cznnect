// Renders the Android launcher icons for every app-icon colour in src/appIcon.ts, using the same artwork as
// renderIcon() there. Needs: npm i @napi-rs/canvas (not a project dependency). Run from the repo root:
//   NODE_PATH=<folder with node_modules> node android-native/gen-icons.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const { createCanvas, Path2D } = require('@napi-rs/canvas')

const src = fs.readFileSync('src/appIcon.ts', 'utf8')
const ICONS = [...src.matchAll(/\{ id: '(\w+)', label: '[^']*', group: '[^']*', a: '(#[0-9a-fA-F]{6})', b: '(#[0-9a-fA-F]{6})'(, dark: true)? \}/g)]
  .map((m) => ({ id: m[1], a: m[2], b: m[3], dark: Boolean(m[4]) }))
if (ICONS.length < 18) throw new Error('could not read the icon list')

const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const mix = (h, o, t) => { const [r1, g1, b1] = rgb(h), [r2, g2, b2] = rgb(o); const f = (a, b) => Math.round(a + (b - a) * t); return `rgb(${f(r1, r2)},${f(g1, g2)},${f(b1, b2)})` }
const hexOf = (c) => c.startsWith('#') ? c : '#' + c.match(/\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('')
const alpha = (h, a) => { const [r, g, b] = rgb(hexOf(h)); return `rgba(${r},${g},${b},${a})` }

// Flipped design: the square is white (or black) and the mark carries the colour, shaded like a polished
// enamel badge: a bright top-left, a deep bottom-right, a soft gloss, a lit inner rim and a shadow under it.
function drawBackground(g, size, v) {
  const dark = !!v.dark
  const bg = g.createLinearGradient(0, 0, size, size)
  if (dark) { bg.addColorStop(0, '#1b1e26'); bg.addColorStop(0.55, '#0a0b0f'); bg.addColorStop(1, '#000000') }
  else { bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, '#f6f8fc'); bg.addColorStop(1, '#e3e8f2') }
  g.fillStyle = bg; g.fillRect(0, 0, size, size)
  const glow = g.createRadialGradient(size * 0.5, size * 0.55, 0, size * 0.5, size * 0.55, size * 0.62)
  glow.addColorStop(0, alpha(hexOf(v.a), dark ? 0.30 : 0.13)); glow.addColorStop(1, alpha(hexOf(v.a), 0))
  g.fillStyle = glow; g.fillRect(0, 0, size, size)
}

function drawMark(g, size, v, scale, makeCanvas, Path2DCtor) {
  const dark = !!v.dark
  const u = (size * scale) / 52
  const layer = makeCanvas(size)
  const L = layer.getContext('2d')
  L.translate(size / 2 - 32 * u, size / 2 - 32 * u); L.scale(u, u)
  const ring = new Path2DCtor('M6 6H58V58H6Z M16 16V48H48V16Z')
  const bar = new Path2DCtor('M3.54 67.54L67.54 3.54L60.46 -3.54L-3.54 60.46Z')
  const top = mix(v.a, '#ffffff', dark ? 0.55 : 0.42)
  const bot = dark ? mix(v.b, v.a, 0.3) : v.b
  const body = L.createLinearGradient(6, 6, 58, 58)
  body.addColorStop(0, top); body.addColorStop(0.42, v.a); body.addColorStop(1, bot)

  // 1. The solid shape: the frame, then the diagonal inside the square.
  L.fillStyle = body; L.fill(ring, 'evenodd')
  L.save(); L.beginPath(); L.rect(6, 6, 52, 52); L.clip(); L.fill(bar); L.restore()

  // From here on everything paints only onto the shape (source-atop), so the edges stay clean and nothing doubles up.
  L.globalCompositeOperation = 'source-atop'
  const sheen = L.createLinearGradient(6, 6, 58, 58)
  sheen.addColorStop(0, 'rgba(255,255,255,0.55)'); sheen.addColorStop(0.46, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.54, 'rgba(0,0,0,0)'); sheen.addColorStop(1, dark ? 'rgba(0,0,0,0.30)' : 'rgba(5,10,40,0.42)')
  L.fillStyle = sheen; L.fillRect(0, 0, 64, 64)
  const gloss = L.createRadialGradient(20, 14, 0, 20, 14, 30)
  gloss.addColorStop(0, 'rgba(255,255,255,0.55)'); gloss.addColorStop(1, 'rgba(255,255,255,0)')
  L.fillStyle = gloss; L.fillRect(0, 0, 64, 64)
  // Bevel: a lit rim along the top-left edges, a shaded one along the bottom-right.
  const rim = L.createLinearGradient(6, 6, 58, 58)
  rim.addColorStop(0, 'rgba(255,255,255,0.95)'); rim.addColorStop(0.45, 'rgba(255,255,255,0.15)')
  rim.addColorStop(0.55, 'rgba(0,0,0,0.12)'); rim.addColorStop(1, dark ? 'rgba(0,0,0,0.55)' : alpha(hexOf(v.b), 0.85))
  L.strokeStyle = rim; L.lineWidth = 2.6; L.lineJoin = 'miter'; L.stroke(ring)
  L.save(); L.beginPath(); L.rect(16, 16, 32, 32); L.clip(); L.lineWidth = 2.4; L.stroke(bar); L.restore()
  // A fine dark keyline so the edge reads on white, and a fine light one on black.
  L.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : alpha(mix(v.b, '#000000', 0.5).replace(/rgb\((\d+),(\d+),(\d+)\)/, (_m, r, gg, b) => '#' + [r, gg, b].map((n) => (+n).toString(16).padStart(2, '0')).join('')), 0.55)
  L.lineWidth = 1.1; L.stroke(ring)
  L.globalCompositeOperation = 'source-over'

  g.save()
  g.shadowColor = dark ? alpha(hexOf(v.a), 0.55) : 'rgba(15,25,70,0.38)'
  g.shadowBlur = size * (dark ? 0.06 : 0.035); g.shadowOffsetY = size * (dark ? 0 : 0.022)
  g.drawImage(layer, 0, 0)
  g.restore()
}

const canvas0 = (size) => createCanvas(size, size)
function canvas(size) { const c = createCanvas(size, size); return [c, c.getContext('2d')] }
const png = (c) => c.toBuffer('image/png')
const legacy = (v, size, round) => {
  const [c, g] = canvas(size)
  if (round) { g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.clip() }
  drawBackground(g, size, v); drawMark(g, size, v, 0.50, canvas0, Path2D); return png(c)
}
const layerBg = (v, size) => { const [c, g] = canvas(size); drawBackground(g, size, v); return png(c) }
// The adaptive icon only shows the middle 66% (a circle at worst), so the mark is smaller than the legacy one.
const layerFg = (v, size) => { const [c, g] = canvas(size); drawMark(g, size, v, 0.36, canvas0, Path2D); return png(c) }

const DENS = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] }
const root = 'android-icons/res'
fs.rmSync('android-icons', { recursive: true, force: true })
const adaptive = (id) => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/cz_bg_${id}" />
    <foreground android:drawable="@mipmap/cz_fg_${id}" />
</adaptive-icon>
`
fs.mkdirSync(`${root}/mipmap-anydpi-v26`, { recursive: true })
for (const v of ICONS) {
  for (const [d, [leg, lay]] of Object.entries(DENS)) {
    const dir = `${root}/mipmap-${d}`; fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(`${dir}/ic_cz_${v.id}.png`, legacy(v, leg, false))
    fs.writeFileSync(`${dir}/cz_bg_${v.id}.png`, layerBg(v, lay))
    fs.writeFileSync(`${dir}/cz_fg_${v.id}.png`, layerFg(v, lay))
    if (v.id === 'ocean') { // the app's default icon (also used on the app info screen)
      fs.writeFileSync(`${dir}/ic_launcher.png`, legacy(v, leg, false))
      fs.writeFileSync(`${dir}/ic_launcher_round.png`, legacy(v, leg, true))
    }
  }
  fs.writeFileSync(`${root}/mipmap-anydpi-v26/ic_cz_${v.id}.xml`, adaptive(v.id))
  if (v.id === 'ocean') for (const n of ['ic_launcher', 'ic_launcher_round']) fs.writeFileSync(`${root}/mipmap-anydpi-v26/${n}.xml`, adaptive('ocean'))
}
// The website's own icons (browser tab, Home Screen shortcut, install prompt) use the default white 'ocean' look.
{
  const v = ICONS.find((i) => i.id === 'ocean')
  const web = (size, scale) => { const [c, g] = canvas(size); drawBackground(g, size, v); drawMark(g, size, v, scale, canvas0, Path2D); return png(c) }
  fs.mkdirSync('public/icons', { recursive: true })
  fs.writeFileSync('public/icons/icon-512.png', web(512, 0.58))
  fs.writeFileSync('public/icons/icon-192.png', web(192, 0.58))
  fs.writeFileSync('public/icons/apple-touch-icon.png', web(180, 0.56))
  fs.writeFileSync('public/icons/icon-maskable-512.png', web(512, 0.46))
}
fs.writeFileSync('android-native/icons.json', JSON.stringify(ICONS.map((v) => v.id)))
console.log('icons:', ICONS.map((v) => v.id).join(' '))
