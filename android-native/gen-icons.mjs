// Renders the Android launcher icons for every app-icon colour in src/appIcon.ts, using the same artwork as
// renderIcon() there. Needs: npm i @napi-rs/canvas (not a project dependency). Run from the repo root:
//   NODE_PATH=<folder with node_modules> node android-native/gen-icons.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const { createCanvas, Path2D } = require('@napi-rs/canvas')

const src = fs.readFileSync('src/appIcon.ts', 'utf8')
const ICONS = [...src.matchAll(/\{ id: '(\w+)', label: '[^']*', group: '[^']*', a: '(#[0-9a-fA-F]{6})', b: '(#[0-9a-fA-F]{6})' \}/g)]
  .map((m) => ({ id: m[1], a: m[2], b: m[3] }))
if (ICONS.length < 12) throw new Error('could not read the icon list')

const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const mix = (h, o, t) => { const [r1, g1, b1] = rgb(h), [r2, g2, b2] = rgb(o); const f = (a, b) => Math.round(a + (b - a) * t); return `rgb(${f(r1, r2)},${f(g1, g2)},${f(b1, b2)})` }

function drawBackground(g, size, v) {
  const bg = g.createLinearGradient(0, 0, size, size)
  bg.addColorStop(0, v.a); bg.addColorStop(1, v.b)
  g.fillStyle = bg; g.fillRect(0, 0, size, size)
  const glow = g.createRadialGradient(size * 0.2, size * 0.1, 0, size * 0.2, size * 0.1, size * 0.9)
  glow.addColorStop(0, 'rgba(255,255,255,0.28)'); glow.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = glow; g.fillRect(0, 0, size, size)
}
function drawMark(g, size, v, scale) {
  const u = (size * scale) / 52
  g.save(); g.translate(size / 2 - 32 * u, size / 2 - 32 * u); g.scale(u, u)
  const ring = new Path2D('M6 6H58V58H6Z M16 16V48H48V16Z')
  const bar = new Path2D('M3.54 67.54L67.54 3.54L60.46 -3.54L-3.54 60.46Z')
  const edge = mix(v.b, '#000000', 0.55)
  const fill = g.createLinearGradient(6, 6, 58, 58)
  fill.addColorStop(0, '#ffffff'); fill.addColorStop(1, mix(v.a, '#ffffff', 0.55))
  g.save(); g.beginPath(); g.rect(3, 3, 58, 58); g.clip()
  g.strokeStyle = edge; g.lineWidth = 3; g.lineJoin = 'miter'; g.stroke(ring); g.restore()
  g.save(); g.beginPath(); g.rect(6, 6, 52, 52); g.clip()
  g.strokeStyle = edge; g.lineWidth = 3; g.stroke(bar); g.fillStyle = fill; g.fill(bar); g.restore()
  g.fillStyle = fill; g.fill(ring, 'evenodd')
  g.save(); g.beginPath(); g.rect(6, 6, 52, 52); g.clip(); g.fillStyle = fill; g.fill(bar); g.restore()
  g.save(); g.clip(ring, 'evenodd'); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2.4; g.stroke(ring); g.restore()
  g.save(); g.beginPath(); g.rect(16, 16, 32, 32); g.clip(); g.clip(bar)
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2.4; g.stroke(bar); g.restore()
  g.restore()
}
function canvas(size) { const c = createCanvas(size, size); return [c, c.getContext('2d')] }
const png = (c) => c.toBuffer('image/png')
const legacy = (v, size, round) => {
  const [c, g] = canvas(size)
  if (round) { g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.clip() }
  drawBackground(g, size, v); drawMark(g, size, v, 0.58); return png(c)
}
const layerBg = (v, size) => { const [c, g] = canvas(size); drawBackground(g, size, v); return png(c) }
// The adaptive icon only shows the middle 66% (a circle at worst), so the mark is smaller than the legacy one.
const layerFg = (v, size) => { const [c, g] = canvas(size); drawMark(g, size, v, 0.42); return png(c) }

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
fs.writeFileSync('android-native/icons.json', JSON.stringify(ICONS.map((v) => v.id)))
console.log('icons:', ICONS.map((v) => v.id).join(' '))
