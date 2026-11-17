import { NODE_H, NODE_W, type TreeLayout } from './tree'

// The living tree behind the family chips: a tall leafy crown with branches inside it, a trunk that thickens as the
// family grows, roots and ground, a banner, a moon, stars, butterflies and fireflies. The crown is sized from where
// the people really are, so it grows sideways with the widest generation and upward with every generation added.
// Only drawing numbers live here, so it can be tested without a screen.
export type Canopy = {
  frame: { x: number; y: number; w: number; h: number } // everything that is drawn, for fitting it on screen
  crown: string
  branches: { d: string; w: number }[]
  leaves: { x: number; y: number; rot: number; s: number; dim: boolean }[]
  blossoms: { x: number; y: number; s: number }[]
  trunk: { body: string; bark: string[]; roots: string[]; ground: string }
  banner: { x: number; y: number; w: number; h: number; tx: number; ty: number }
  moon: { path: string }
  butterflies: { x: number; y: number; s: number; delay: number }[]
  stars: { x: number; y: number; r: number; delay: number }[]
  flies: { x: number; y: number; dx: number; dy: number; delay: number; dur: number }[]
}

// A tiny seeded random generator, so the tree looks the same every time for the same family.
function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const sgn = (v: number) => (v < 0 ? -1 : 1)
const EXP = 2 / 2.8 // a rounded-box crown rather than a plain ellipse, so the corners of a wide row still fit
const point = (cx: number, cy: number, a: number, b: number, t: number): [number, number] => {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [cx + a * sgn(c) * Math.abs(c) ** EXP, cy + b * sgn(s) * Math.abs(s) ** EXP]
}
const r1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function canopyFor(layout: TreeLayout): Canopy | null {
  if (layout.nodes.length === 0 || layout.width === 0) return null
  const x0 = Math.min(...layout.nodes.map((n) => n.x))
  const x1 = Math.max(...layout.nodes.map((n) => n.x + NODE_W))
  const y0 = Math.min(...layout.nodes.map((n) => n.y))
  const y1 = Math.max(...layout.nodes.map((n) => n.y + NODE_H))
  const cx = (x0 + x1) / 2

  // Taller than the people need: lots of room above the youngest row, so the tree reaches up.
  const bottom = y1 + 36
  const top = y0 - 130 - 0.22 * (y1 - y0)
  const cy = (top + bottom) / 2
  let a = ((x1 - x0) / 2) * 1.18 + 80
  let b = (bottom - top) / 2
  const fits = (k: number) =>
    layout.nodes.every((n) =>
      [[n.x, n.y], [n.x + NODE_W, n.y], [n.x, n.y + NODE_H], [n.x + NODE_W, n.y + NODE_H]].every(
        ([x, y]) => Math.abs((x - cx) / a) ** 2.8 + Math.abs((y - cy) / b) ** 2.8 < k,
      ),
    )
  for (let i = 0; i < 30 && !fits(0.92); i++) { a *= 1.05; b *= 1.03 }
  const topY = cy - b
  const bottomY = cy + b

  const steps = 120
  let crown = ''
  for (let i = 0; i < steps; i++) {
    const [x, y] = point(cx, cy, a, b, (i / steps) * Math.PI * 2)
    crown += `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`
  }
  crown += 'Z'

  const rand = seeded(layout.nodes.length * 7919 + Math.round(layout.width))

  // Trunk: it thickens and lengthens as the tree widens, flares into roots, and stands on a patch of ground.
  const tw = clamp(26 + a * 0.07, 30, 120)
  const fh = 60 + tw * 0.6
  const T = cy + b * 0.3
  const B = bottomY + 50 + a * 0.1
  const mid = T + (B - T) * 0.4
  const L = (k: number) => r1(cx - tw * k)
  const R = (k: number) => r1(cx + tw * k)
  const body =
    `M${L(1)} ${r1(T)} C${L(0.92)} ${r1(mid)} ${L(0.88)} ${r1(B - fh - 10)} ${L(1.05)} ${r1(B - fh)} ` +
    `C${L(1.3)} ${r1(B - fh * 0.4)} ${L(2)} ${r1(B - fh * 0.1)} ${L(2.8)} ${r1(B)} L${R(2.8)} ${r1(B)} ` +
    `C${R(2)} ${r1(B - fh * 0.1)} ${R(1.3)} ${r1(B - fh * 0.4)} ${R(1.05)} ${r1(B - fh)} ` +
    `C${R(0.88)} ${r1(B - fh - 10)} ${R(0.92)} ${r1(mid)} ${R(1)} ${r1(T)}Z`
  const bark = [-0.55, -0.18, 0.2, 0.58].map((f, i) => {
    const x = cx + tw * f
    return `M${r1(x)} ${r1(T + 24 + i * 6)} C${r1(x + 7)} ${r1(T + (B - T) * 0.3)} ${r1(x - 7)} ${r1(T + (B - T) * 0.6)} ${r1(x + 2 + f * 18)} ${r1(B - fh * 0.5)}`
  })
  const roots = [-1, 1].flatMap((side) =>
    [0, 1, 2].map((i) => {
      const sx = cx + side * tw * (1.9 + i * 0.35)
      return `M${r1(sx)} ${r1(B - 6)} C${r1(sx + side * tw * 0.7)} ${r1(B + 6 + i * 3)} ${r1(sx + side * tw * 1.2)} ${r1(B + 12 + i * 4)} ${r1(sx + side * tw * (1.8 + i * 0.3))} ${r1(B + 8 + i * 5)}`
    }),
  )
  const ground = `M${r1(cx - a * 0.95)} ${r1(B + 2)} C${r1(cx - a * 0.5)} ${r1(B - 26)} ${r1(cx + a * 0.5)} ${r1(B - 26)} ${r1(cx + a * 0.95)} ${r1(B + 2)} C${r1(cx + a * 0.5)} ${r1(B + 30)} ${r1(cx - a * 0.5)} ${r1(B + 30)} ${r1(cx - a * 0.95)} ${r1(B + 2)}Z`

  // Branches: from the top of the trunk they fan out and fork inside the crown, behind the names.
  const branches: Canopy['branches'] = []
  const fan = 7
  const sx = cx
  const sy = T + 10
  for (let i = 0; i < fan; i++) {
    const u = (i - (fan - 1) / 2) / ((fan - 1) / 2) // -1 .. 1
    const tx = cx + u * a * 0.7
    const ty = topY + b * (0.22 + 0.5 * Math.abs(u) ** 1.4) + rand() * 20
    const qx = cx + u * a * 0.18
    const qy = (sy + ty) / 2 + b * 0.1
    branches.push({ d: `M${r1(sx)} ${r1(sy)} Q${r1(qx)} ${r1(qy)} ${r1(tx)} ${r1(ty)}`, w: r1(clamp(tw * 0.34, 7, 22) * (1 - Math.abs(u) * 0.3)) })
    // Two forks off each main branch.
    for (const f of [0.55, 0.8]) {
      const px = (1 - f) * (1 - f) * sx + 2 * (1 - f) * f * qx + f * f * tx
      const py = (1 - f) * (1 - f) * sy + 2 * (1 - f) * f * qy + f * f * ty
      for (const dir of [-1, 1]) {
        const ex = px + dir * a * (0.12 + rand() * 0.1)
        const ey = py - b * (0.1 + rand() * 0.14)
        branches.push({ d: `M${r1(px)} ${r1(py)} Q${r1(px + dir * a * 0.04)} ${r1((py + ey) / 2)} ${r1(ex)} ${r1(ey)}`, w: r1(clamp(tw * 0.12, 3, 8)) })
      }
    }
  }

  // Leaves along the edge of the crown (an outer and a slightly inner ring), and a few blossoms among them.
  const perimeter = 4 * (a + b)
  const ring = clamp(Math.round(perimeter / 22), 44, 240)
  const leaves: Canopy['leaves'] = []
  for (const [shrink, offset] of [[1, 0], [0.93, 0.5]] as const) {
    for (let i = 0; i < ring; i++) {
      const t = ((i + offset) / ring) * Math.PI * 2
      const [x, y] = point(cx, cy, a * shrink, b * shrink, t)
      const rot = Math.atan2((y - cy) / b, (x - cx) / a) + (rand() - 0.5) * 0.9
      leaves.push({ x: r1(x), y: r1(y), rot: r1((rot * 180) / Math.PI), s: r1(0.8 + rand() * 0.8), dim: rand() < 0.45 })
    }
  }
  const blossoms: Canopy['blossoms'] = []
  const flowers = clamp(Math.round(ring / 6), 8, 36)
  for (let i = 0; i < flowers; i++) {
    const [x, y] = point(cx, cy, a * 0.97, b * 0.97, rand() * Math.PI * 2)
    blossoms.push({ x: r1(x), y: r1(y), s: r1(0.8 + rand() * 0.7) })
  }

  const banner = { x: r1(cx - 130), y: r1(topY - 40), w: 260, h: 44, tx: r1(cx), ty: r1(topY - 10) }

  const fx0 = cx - a - 100
  const fx1 = cx + a + 100
  const fy0 = banner.y - 70
  const fy1 = B + 50

  // A crescent moon in one corner of the sky.
  const mr = clamp(a * 0.1, 22, 46)
  const mx = fx0 + 60 + mr
  const my = fy0 + 40 + mr
  const moon = { path: `M${r1(mx)} ${r1(my - mr)} A${r1(mr)} ${r1(mr)} 0 1 0 ${r1(mx)} ${r1(my + mr)} A${r1(mr * 0.78)} ${r1(mr * 0.78)} 0 1 1 ${r1(mx)} ${r1(my - mr)}Z` }

  const inside = (x: number, y: number, k: number) => Math.abs((x - cx) / a) ** 2.8 + Math.abs((y - cy) / b) ** 2.8 < k
  const stars: Canopy['stars'] = []
  const wanted = clamp(Math.round(((fx1 - fx0) * (fy1 - fy0)) / 14000), 26, 110)
  for (let tries = 0; tries < 800 && stars.length < wanted; tries++) {
    const x = fx0 + rand() * (fx1 - fx0)
    const y = fy0 + rand() * (B - fy0 - 60)
    if (inside(x, y, 1.15) || Math.hypot(x - mx, y - my) < mr * 1.6) continue
    stars.push({ x: r1(x), y: r1(y), r: r1(1.2 + rand() * 2.2), delay: r1(rand() * 5) })
  }
  const flies: Canopy['flies'] = []
  const swarm = clamp(Math.round(layout.nodes.length / 3), 6, 16)
  for (let tries = 0; tries < 300 && flies.length < swarm; tries++) {
    const x = cx + (rand() * 2 - 1) * a
    const y = cy + (rand() * 2 - 1) * b
    if (!inside(x, y, 0.8)) continue
    flies.push({ x: r1(x), y: r1(y), dx: r1((rand() * 2 - 1) * 55), dy: r1((rand() * 2 - 1) * 45), delay: r1(rand() * 6), dur: r1(7 + rand() * 6) })
  }
  const butterflies: Canopy['butterflies'] = [
    { x: r1(cx - a * 1.02), y: r1(cy - b * 0.35), s: 1, delay: 0 },
    { x: r1(cx + a * 1.04), y: r1(cy + b * 0.05), s: 0.85, delay: 1.3 },
  ]

  return {
    frame: { x: r1(fx0), y: r1(fy0), w: r1(fx1 - fx0), h: r1(fy1 - fy0) },
    crown, branches, leaves, blossoms, trunk: { body, bark, roots, ground }, banner, moon, butterflies, stars, flies,
  }
}
