// Renders the Android launcher icons and the website icons, using the same artwork as renderIcon() in
// src/appIcon.ts. Needs: npm i @napi-rs/canvas (not a project dependency). Run from the repo root:
//   NODE_PATH=<folder with node_modules> node android-native/gen-icons.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const { createCanvas, Path2D } = require('@napi-rs/canvas')

const src = fs.readFileSync('src/appIcon.ts', 'utf8')
const ICONS = [...src.matchAll(/\{ id: '(\w+)', label: '[^']*', group: '[^']*', mark: '(#[0-9a-fA-F]{6})', bg: '(#[0-9a-fA-F]{6})' \}/g)]
  .map((m) => ({ id: m[1], mark: m[2], bg: m[3] }))
if (ICONS.length !== 7) throw new Error('could not read the icon list')
// Icons that are no longer offered. Their launcher entries stay in the app (so a phone that had one on its Home Screen
// does not lose its icon after an update) but they show the Light icon, and the app switches the phone back to Light.
const LEGACY = ['ocean', 'treasure', 'libertalia', 'outlaw', 'dust', 'khonshu', 'crescent',
  'ocean_night', 'sunset_night', 'aurora_night', 'orchid_night', 'forest_night', 'graphite_night']

const canvas0 = (size) => createCanvas(size, size)
const canvas = (size) => { const c = canvas0(size); return [c, c.getContext('2d')] }
const png = (c) => c.toBuffer('image/png')
// Light and Dark are shaded with one soft gradient across the whole mark; the coloured icons stay flat.
// Keep SHADES in step with SHADES in src/appIcon.ts.
const SHADES = {
  light: { bg: ['#ffffff', '#edf2ff'], stops: ['#6c9dff', '#2a5ceb', '#0d2c9e'], glow: ['#ffffff', 0.38], deep: ['#06185f', 0.35] },
  dark: { bg: ['#17191f', '#000000'], stops: ['#ffffff', '#dde3f0', '#8f9ab5'], glow: ['#ffffff', 0.45], deep: ['#4a556f', 0.35] },
}
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
function drawBackground(g, size, v) {
  const s = SHADES[v.id]
  if (s) {
    const grad = g.createLinearGradient(0, 0, size, size)
    grad.addColorStop(0, s.bg[0]); grad.addColorStop(1, s.bg[1])
    g.fillStyle = grad
  } else g.fillStyle = v.bg
  g.fillRect(0, 0, size, size)
}
// Shaded marks are drawn on their own layer first, so the gradients only land on the mark.
function drawShadedMark(g, size, s, scale) {
  const [layer, l] = canvas(size)
  const u = (size * scale) / 52
  l.translate(size / 2 - 32 * u, size / 2 - 32 * u); l.scale(u, u)
  l.fillStyle = '#000000'
  l.fill(new Path2D('M6 6H58V58H6Z M16 16V48H48V16Z'), 'evenodd')
  l.save(); l.beginPath(); l.rect(6, 6, 52, 52); l.clip()
  l.fill(new Path2D('M3.54 67.54L67.54 3.54L60.46 -3.54L-3.54 60.46Z'))
  l.restore()
  l.globalCompositeOperation = 'source-in'
  const base = l.createLinearGradient(10, 6, 54, 58)
  base.addColorStop(0, s.stops[0]); base.addColorStop(0.5, s.stops[1]); base.addColorStop(1, s.stops[2])
  l.fillStyle = base; l.fillRect(6, 6, 52, 52)
  l.globalCompositeOperation = 'source-atop'
  const glow = l.createRadialGradient(20, 14, 0, 20, 14, 34)
  glow.addColorStop(0, rgba(s.glow[0], s.glow[1])); glow.addColorStop(1, rgba(s.glow[0], 0))
  l.fillStyle = glow; l.fillRect(6, 6, 52, 52)
  const deep = l.createRadialGradient(56, 58, 0, 56, 58, 30)
  deep.addColorStop(0, rgba(s.deep[0], s.deep[1])); deep.addColorStop(1, rgba(s.deep[0], 0))
  l.fillStyle = deep; l.fillRect(6, 6, 52, 52)
  g.drawImage(layer, 0, 0)
}
function drawMark(g, size, v, scale) {
  if (SHADES[v.id]) return drawShadedMark(g, size, SHADES[v.id], scale)
  const u = (size * scale) / 52
  g.save(); g.translate(size / 2 - 32 * u, size / 2 - 32 * u); g.scale(u, u)
  g.fillStyle = v.mark
  g.fill(new Path2D('M6 6H58V58H6Z M16 16V48H48V16Z'), 'evenodd')
  g.beginPath(); g.rect(6, 6, 52, 52); g.clip()
  g.fill(new Path2D('M3.54 67.54L67.54 3.54L60.46 -3.54L-3.54 60.46Z'))
  g.restore()
}
const legacy = (v, size, round) => {
  const [c, g] = canvas(size)
  if (round) { g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.clip() }
  drawBackground(g, size, v); drawMark(g, size, v, 0.56); return png(c)
}
const layerBg = (v, size) => { const [c, g] = canvas(size); drawBackground(g, size, v); return png(c) }
// The adaptive icon only shows the middle 66% (a circle at worst), so the mark is smaller than the legacy one.
const layerFg = (v, size) => { const [c, g] = canvas(size); drawMark(g, size, v, 0.40); return png(c) }

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
    if (v.id === 'light') { // the app's default icon (also used on the app info screen)
      fs.writeFileSync(`${dir}/ic_launcher.png`, legacy(v, leg, false))
      fs.writeFileSync(`${dir}/ic_launcher_round.png`, legacy(v, leg, true))
    }
  }
  fs.writeFileSync(`${root}/mipmap-anydpi-v26/ic_cz_${v.id}.xml`, adaptive(v.id))
  if (v.id === 'light') for (const n of ['ic_launcher', 'ic_launcher_round']) fs.writeFileSync(`${root}/mipmap-anydpi-v26/${n}.xml`, adaptive('light'))
}
// The website's own icons (browser tab, Home Screen shortcut, install prompt) use the Light look.
{
  const v = ICONS.find((i) => i.id === 'light')
  const web = (size, scale) => { const [c, g] = canvas(size); drawBackground(g, size, v); drawMark(g, size, v, scale); return png(c) }
  fs.mkdirSync('public/icons', { recursive: true })
  fs.writeFileSync('public/icons/icon-512.png', web(512, 0.6))
  fs.writeFileSync('public/icons/icon-192.png', web(192, 0.6))
  fs.writeFileSync('public/icons/apple-touch-icon.png', web(180, 0.58))
  fs.writeFileSync('public/icons/icon-maskable-512.png', web(512, 0.48))
}
fs.writeFileSync('android-native/icons.json', JSON.stringify({ active: ICONS.map((v) => v.id), legacy: LEGACY }))
console.log('icons:', ICONS.map((v) => v.id).join(' '), '+', LEGACY.length, 'old entries')
