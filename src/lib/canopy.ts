import { NODE_H, NODE_W, type TreeLayout } from './tree'

// The leafy crown behind the family tree, with a banner on top and a trunk underneath. The crown is sized from where the
// people really are, so it grows sideways as a generation gets wider (more brothers, sisters and cousins on one row)
// and taller as generations are added. Only drawing numbers live here, so it can be tested without a screen.
export type Canopy = {
  frame: { x: number; y: number; w: number; h: number } // everything that is drawn, for fitting it on screen
  crown: string
  bubbles: { cx: number; cy: number; r: number; dim: boolean }[]
  trunk: string
  banner: { x: number; y: number; w: number; h: number; tx: number; ty: number }
}

const sgn = (v: number) => (v < 0 ? -1 : 1)
const EXP = 2 / 2.8 // a rounded-box crown rather than a plain ellipse, so the corners of a wide row still fit
const point = (cx: number, cy: number, a: number, b: number, t: number): [number, number] => {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [cx + a * sgn(c) * Math.abs(c) ** EXP, cy + b * sgn(s) * Math.abs(s) ** EXP]
}
const r1 = (n: number) => Math.round(n * 10) / 10

export function canopyFor(layout: TreeLayout): Canopy | null {
  if (layout.nodes.length === 0 || layout.width === 0) return null
  const x0 = Math.min(...layout.nodes.map((n) => n.x))
  const x1 = Math.max(...layout.nodes.map((n) => n.x + NODE_W))
  const y0 = Math.min(...layout.nodes.map((n) => n.y))
  const y1 = Math.max(layout.height - 20, Math.max(...layout.nodes.map((n) => n.y + NODE_H)))
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const a = ((x1 - x0) / 2) * 1.28 + 70
  const b = ((y1 - y0) / 2) * 1.28 + 70

  const steps = 96
  let crown = ''
  for (let i = 0; i < steps; i++) {
    const [x, y] = point(cx, cy, a, b, (i / steps) * Math.PI * 2)
    crown += `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`
  }
  crown += 'Z'

  // Round beads along the edge, big and small in turn.
  const perimeter = 4 * (a + b)
  const count = Math.min(160, Math.max(28, Math.round(perimeter / 34)))
  const sizes = [9, 5.5, 11, 4.5]
  const bubbles = Array.from({ length: count }, (_, i) => {
    const [x, y] = point(cx, cy, a, b, (i / count) * Math.PI * 2)
    return { cx: r1(x), cy: r1(y), r: sizes[i % 4], dim: i % 3 !== 0 }
  })

  const top = cy - b
  const bottom = cy + b
  const banner = { x: r1(cx - 120), y: r1(top - 34), w: 240, h: 40, tx: r1(cx), ty: r1(top - 8) }
  const trunkTop = bottom - b * 0.18
  const base = bottom + 150
  const trunk = `M${r1(cx - 34)} ${r1(trunkTop)} L${r1(cx + 34)} ${r1(trunkTop)} L${r1(cx + 38)} ${r1(base - 70)} L${r1(cx + 110)} ${r1(base)} L${r1(cx - 110)} ${r1(base)} L${r1(cx - 38)} ${r1(base - 70)}Z`

  const fx0 = cx - a - 14
  const fx1 = cx + a + 14
  const fy0 = banner.y - 6
  const fy1 = base + 8
  return { frame: { x: r1(fx0), y: r1(fy0), w: r1(fx1 - fx0), h: r1(fy1 - fy0) }, crown, bubbles, trunk, banner }
}
