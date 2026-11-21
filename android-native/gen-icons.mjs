// Renders the Android launcher icons and the website icons. Needs: npm i @napi-rs/canvas (not a project dependency). Run from the repo root:
//   NODE_PATH=<folder with node_modules> node android-native/gen-icons.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const { createCanvas, Path2D, loadImage } = require('@napi-rs/canvas')

const src = fs.readFileSync('src/appIcon.ts', 'utf8')
const ICONS = [...src.matchAll(/\{ id: '(\w+)', label: '[^']*', group: '[^']*', mark: '(#[0-9a-fA-F]{6})', bg: '(#[0-9a-fA-F]{6})' \}/g)]
  .map((m) => ({ id: m[1], mark: m[2], bg: m[3] }))
if (ICONS.length !== 7) throw new Error('could not read the icon list')
// Icons that are no longer offered. Their launcher entries stay in the app (so a phone that had one on its Home Screen
// does not lose its icon after an update) but they show the Light icon, and the app switches the phone back to Light.
const LEGACY = ['ocean', 'treasure', 'libertalia', 'outlaw', 'dust', 'khonshu', 'crescent',
  'ocean_night', 'sunset_night', 'aurora_night', 'orchid_night', 'forest_night', 'graphite_night']

// Every icon has the same look, inspired by the Docs and Drive icons: the mark (frame and slash as one piece, very slightly
// rounded) filled with one soft gradient, a lighter highlight at the top-right and a second soft glow at the bottom, on a
// pale tinted square. Dark swaps it round: a white mark on a blue-to-violet square. The canvas can't blend like this, so the
// mark is drawn as an SVG and placed like a flat one. Each row is [top, middle, bottom, glow, square from, square to].
const TILE = {
  light: ['#5b97ff', '#3f7ff5', '#4a78f0', '#b7a6ff', '#ffffff', '#e6eeff'],
  sunset: ['#ff6a9a', '#f0286e', '#f2405f', '#ffb36b', '#ffffff', '#ffe9f1'],
  aurora: ['#3dddbe', '#0fb89a', '#17a9b8', '#7bd7ff', '#ffffff', '#e3faf5'],
  orchid: ['#a56bff', '#8a3dff', '#7b4bff', '#e59bff', '#ffffff', '#f1e9ff'],
  forest: ['#4cc27f', '#1d9a55', '#1e9b6b', '#cfe96b', '#ffffff', '#e4f6ea'],
  graphite: ['#7a8596', '#4b5563', '#5a6272', '#a3b1c9', '#ffffff', '#eaedf1'],
}
const DARK_SQUARE = [[0, '#6fa6ff'], [0.6, '#3e7bf2'], [1, '#8e86f5']] // runs from (20%, 0) to (80%, 100%) of the square
const OUTER = 'M9.0 6H55.0A3.0 3.0 0 0 1 58 9.0V55.0A3.0 3.0 0 0 1 55.0 58H9.0A3.0 3.0 0 0 1 6 55.0V9.0A3.0 3.0 0 0 1 9.0 6Z'
const RING = 'M9.0 6H55.0A3.0 3.0 0 0 1 58 9.0V55.0A3.0 3.0 0 0 1 55.0 58H9.0A3.0 3.0 0 0 1 6 55.0V9.0A3.0 3.0 0 0 1 9.0 6ZM17.5 16A1.5 1.5 0 0 0 16 17.5V46.5A1.5 1.5 0 0 0 17.5 48H46.5A1.5 1.5 0 0 0 48 46.5V17.5A1.5 1.5 0 0 0 46.5 16Z'
const markSvg = (body, defs) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="1024" height="1024">
<defs>${defs}<clipPath id="outer"><path d="${OUTER}"/></clipPath>
<clipPath id="union"><path d="${RING}"/><path d="M6 50.92L50.92 6H58V13.08L13.08 58H6Z"/></clipPath></defs>
<g clip-path="url(#outer)"><g clip-path="url(#union)">${body}</g></g></svg>`
const rect = (f) => `<rect x="6" y="6" width="52" height="52" fill="url(#${f})"/>`
const radial = (id, cx, cy, r, col, a) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${col}" stop-opacity="${a}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`
const tileMark = ([top, mid, bot, glow]) => markSvg(rect('b') + rect('lav') + rect('hi'),
  `<linearGradient id="b" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="58"><stop offset="0" stop-color="${top}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${bot}"/></linearGradient>` +
  radial('lav', 34, 62, 30, glow, 0.95) + radial('hi', 54, 10, 26, '#ffffff', 0.5))
const darkMark = () => markSvg(rect('w') + rect('lav'),
  '<linearGradient id="w" gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="58"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dce6ff"/></linearGradient>' +
  radial('lav', 30, 60, 30, '#b7a6ff', 0.55))
const MARKS = {}
for (const id of Object.keys(TILE)) MARKS[id] = await loadImage(Buffer.from(tileMark(TILE[id])))
MARKS.dark = await loadImage(Buffer.from(darkMark()))

const canvas0 = (size) => createCanvas(size, size)
const canvas = (size) => { const c = canvas0(size); return [c, c.getContext('2d')] }
const png = (c) => c.toBuffer('image/png')
function drawBackground(g, size, v) {
  if (v.id === 'dark') {
    const grad = g.createLinearGradient(size * 0.2, 0, size * 0.8, size)
    for (const [o, c] of DARK_SQUARE) grad.addColorStop(o, c)
    g.fillStyle = grad
  } else if (TILE[v.id]) {
    const grad = g.createLinearGradient(0, 0, size, size)
    grad.addColorStop(0, TILE[v.id][4]); grad.addColorStop(1, TILE[v.id][5])
    g.fillStyle = grad
  } else g.fillStyle = v.bg
  g.fillRect(0, 0, size, size)
}
function drawMark(g, size, v, scale) {
  const u = (size * scale) / 52
  if (MARKS[v.id]) { g.drawImage(MARKS[v.id], size / 2 - 32 * u, size / 2 - 32 * u, 64 * u, 64 * u); return }
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
// The website's own icons (browser tab, Home Screen shortcut, install prompt) use the Light look. The browser has no way to
// draw the icons itself, so every icon also gets a ready-made picture (app-<id>-192 and -180) that appIcon.ts points to.
{
  const pic = (v, size, scale) => { const [c, g] = canvas(size); drawBackground(g, size, v); drawMark(g, size, v, scale); return png(c) }
  fs.mkdirSync('public/icons', { recursive: true })
  const v = ICONS.find((i) => i.id === 'light')
  fs.writeFileSync('public/icons/icon-512.png', pic(v, 512, 0.6))
  fs.writeFileSync('public/icons/icon-192.png', pic(v, 192, 0.6))
  fs.writeFileSync('public/icons/apple-touch-icon.png', pic(v, 180, 0.58))
  fs.writeFileSync('public/icons/icon-maskable-512.png', pic(v, 512, 0.48))
  for (const i of ICONS) {
    fs.writeFileSync(`public/icons/app-${i.id}-192.png`, pic(i, 192, 0.6))
    fs.writeFileSync(`public/icons/app-${i.id}-180.png`, pic(i, 180, 0.58))
  }
}
fs.writeFileSync('android-native/icons.json', JSON.stringify({ active: ICONS.map((v) => v.id), legacy: LEGACY }))
console.log('icons:', ICONS.map((v) => v.id).join(' '), '+', LEGACY.length, 'old entries')
