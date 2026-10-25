// Turns the centre lines of the tree into glowing roots that are thick near the top
// and thin out as they grow downwards, with a few fine hairs like a bolt of lightning.
import type { RootSeg } from './tree'

type Pt = { x: number; y: number }
type Cubic = [Pt, Pt, Pt, Pt]

function parse(d: string): Cubic | null {
  const n = d.match(/-?\d*\.?\d+/g)?.map(Number)
  if (!n || n.length < 8) return null
  return [
    { x: n[0], y: n[1] },
    { x: n[2], y: n[3] },
    { x: n[4], y: n[5] },
    { x: n[6], y: n[7] },
  ]
}

function at([a, b, c, d]: Cubic, t: number): Pt {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  }
}

function dir(cubic: Cubic, t: number): Pt {
  const p = at(cubic, Math.max(0, t - 0.01))
  const q = at(cubic, Math.min(1, t + 0.01))
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
  return { x: (q.x - p.x) / len, y: (q.y - p.y) / len }
}

const f = (n: number) => Math.round(n * 10) / 10

// A filled ribbon along the curve that goes from width w0 to width w1.
export function taperPath(d: string, w0: number, w1: number, steps = 18): string {
  const cubic = parse(d)
  if (!cubic) return ''
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = at(cubic, t)
    const n = dir(cubic, t)
    const w = (w0 + (w1 - w0) * Math.pow(t, 0.85)) / 2
    left.push({ x: p.x - n.y * w, y: p.y + n.x * w })
    right.push({ x: p.x + n.y * w, y: p.y - n.x * w })
  }
  const pts = [...left, ...right.reverse()]
  // Round ends so joints between roots flow into each other without a notch.
  const dot = (p: Pt, r: number) => `M${f(p.x - r)} ${f(p.y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`
  return `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}Z${dot(cubic[0], w0 / 2)}${dot(cubic[3], w1 / 2)}`
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

// Fine hairs that split off the thicker roots, always the same for the same family.
export function hairPaths(seg: RootSeg, seed: string): string[] {
  if (seg.role === 'twig') return []
  const cubic = parse(seg.d)
  if (!cubic) return []
  const out: string[] = []
  for (const [i, t] of [0.38, 0.7].entries()) {
    const r = hash(`${seed}:${seg.role}:${i}`)
    const p = at(cubic, t)
    const n = dir(cubic, t)
    const side = r < 0.5 ? -1 : 1
    const angle = side * (0.5 + r * 0.5)
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const len = 15 + r * 14
    const hx = n.x * c - n.y * s
    const hy = n.x * s + n.y * c
    out.push(`M${f(p.x)} ${f(p.y)}q${f(hx * len * 0.5 + hy * 3)} ${f(hy * len * 0.5 - hx * 3)} ${f(hx * len)} ${f(hy * len)}`)
  }
  return out
}
