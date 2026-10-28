// Turns the centre lines of the tree into roots: thick where they leave the parents,
// thinning out as they grow down, with fine rootlets splitting off like a real root system.
import type { RootSeg } from './tree'

export type Pt = { x: number; y: number }
export type Cubic = [Pt, Pt, Pt, Pt]
export type Rootlet = { d: string; w0: number; w1: number }

const f = (n: number) => Math.round(n * 10) / 10

export function parseCubic(d: string): Cubic | null {
  const n = d.match(/-?\d*\.?\d+/g)?.map(Number)
  if (!n || n.length < 8) return null
  return [
    { x: n[0], y: n[1] },
    { x: n[2], y: n[3] },
    { x: n[4], y: n[5] },
    { x: n[6], y: n[7] },
  ]
}

export function pointOn([a, b, c, d]: Cubic, t: number): Pt {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  }
}

function dirOn(cubic: Cubic, t: number): Pt {
  const p = pointOn(cubic, Math.max(0, t - 0.01))
  const q = pointOn(cubic, Math.min(1, t + 0.01))
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
  return { x: (q.x - p.x) / len, y: (q.y - p.y) / len }
}

export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

// Width along a root: starts at w0, ends at w1, with a slight swell so it reads as wood, not a pipe.
export function widthAt(w0: number, w1: number, t: number): number {
  return w1 + (w0 - w1) * Math.pow(1 - t, 1.15)
}

// A filled ribbon along the curve that goes from width w0 down to width w1.
export function taperPath(d: string, w0: number, w1: number, steps = 22): string {
  const cubic = parseCubic(d)
  if (!cubic) return ''
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = pointOn(cubic, t)
    const n = dirOn(cubic, t)
    const w = Math.max(0.35, widthAt(w0, w1, t)) / 2
    left.push({ x: p.x - n.y * w, y: p.y + n.x * w })
    right.push({ x: p.x + n.y * w, y: p.y - n.x * w })
  }
  const pts = [...left, ...right.reverse()]
  // Round ends so joints between roots flow into each other without a notch.
  const dot = (p: Pt, r: number) =>
    `M${f(p.x - r)} ${f(p.y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`
  return `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}Z${dot(cubic[0], w0 / 2)}${dot(cubic[3], Math.max(0.35, w1) / 2)}`
}

// Fine rootlets that split off the thicker roots. Always the same for the same family.
export function rootlets(seg: RootSeg, seed: string): Rootlet[] {
  const cubic = parseCubic(seg.d)
  if (!cubic || seg.w0 < 8) return [] // thin roots stay clean; only the thick ones split off a rootlet
  const count = seg.w0 > 16 ? 2 : 1
  const out: Rootlet[] = []
  for (let i = 0; i < count; i++) {
    const r = hash(`${seed}:${i}`)
    const r2 = hash(`${seed}:${i}:b`)
    const t = 0.28 + (i + 0.3 + r * 0.5) * (0.5 / count)
    const p = pointOn(cubic, t)
    const n = dirOn(cubic, t)
    const side = (i + (r < 0.5 ? 0 : 1)) % 2 === 0 ? -1 : 1
    const angle = side * (0.42 + r2 * 0.5)
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    let hx = n.x * c - n.y * s
    let hy = n.x * s + n.y * c
    if (hy < 0.35) { hy = 0.35; const m = Math.hypot(hx, hy); hx /= m; hy /= m } // always grow downwards
    const len = (26 + r * 20) * Math.min(1.25, 0.7 + seg.w0 / 30)
    const wig = (r2 - 0.5) * 12
    const x3 = p.x + hx * len
    const y3 = p.y + hy * len
    const local = widthAt(seg.w0, seg.w1, t)
    out.push({
      d: `M${f(p.x)} ${f(p.y)}C${f(p.x + hx * len * 0.3 + wig)} ${f(p.y + hy * len * 0.3)},${f(p.x + hx * len * 0.7 - wig)} ${f(p.y + hy * len * 0.7)},${f(x3)} ${f(y3)}`,
      w0: Math.max(2.4, local * 0.42),
      w1: 1.1,
    })
  }
  return out
}
