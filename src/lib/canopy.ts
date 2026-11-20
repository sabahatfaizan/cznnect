import { NODE_H, NODE_W, type TreeLayout } from './tree'
import { hash, taperPath } from './roots'

// The living tree behind the family chips: a trunk that thickens as the family grows, roots and ground, a banner,
// a moon, stars, butterflies and fireflies. Every family branch has its own wooden limbs (thick where a line of
// descent is large, fine at the tips) and its own leaf canopy drawn around the people of that branch, with a
// natural gap between neighbouring families. Everything is read from where people really are, so canopies follow
// the real parent and child links and grow as a branch gets more descendants. Only drawing numbers live here, so
// it can be tested without a screen.
export type Family = {
  id: string // the person the branch starts from
  tone: number
  ids: string[]
  box: { x: number; y: number; w: number; h: number } // the whole branch, for pointing the camera at it
  parts: { id: string; base: string; mid: string; hi: string; leaves: string }[] // one leaf clump per person, so a folded branch loses its leaves too
  blossoms: { id: string; x: number; y: number; s: number }[]
}
// One stem: wood from a couple (or one parent) up to where it forks, and from there out to each child.
export type Wood = { id: string; parents: string[]; kids: string[]; legs: string; limbs: string; shine: string; fork: { x: number; y: number }; inside: boolean; vein: string } // inside: the children stand inside the trunk, so the link is a fine carved line, not a limb
export type Canopy = {
  frame: { x: number; y: number; w: number; h: number } // everything that is drawn, for fitting it on screen
  families: Family[]
  wood: Wood[]
  trunk: { body: string; bark: string[]; roots: string[]; ground: string; grass: string }
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

const r1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
type P = { x: number; y: number }
const cub = (a: P, b: P, c: P, d: P) => `M${r1(a.x)} ${r1(a.y)}C${r1(b.x)} ${r1(b.y)},${r1(c.x)} ${r1(c.y)},${r1(d.x)} ${r1(d.y)}`
const circle = (x: number, y: number, r: number) => `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0Z`
// One leaf, drawn at x,y, turned by rot (radians) and scaled by s.
const leaf = (x: number, y: number, rot: number, s: number) => {
  const c = Math.cos(rot)
  const sn = Math.sin(rot)
  const p = (px: number, py: number) => `${r1(x + (px * c - py * sn) * s)} ${r1(y + (px * sn + py * c) * s)}`
  return `M${p(0, 0)}C${p(4, -7)} ${p(15, -7)} ${p(22, 0)}C${p(15, 7)} ${p(4, 7)} ${p(0, 0)}Z`
}

// Where a pill starts and ends inside its 80-high box. The screen draws its fold dots at the fork these give.
const TOP = 17
const BOTTOM = 63

type Relations = { down: Map<string, string[]>; mates: Map<string, string[]>; hasParent: Set<string> }
function relations(layout: TreeLayout): Relations {
  const down = new Map<string, string[]>()
  const mates = new Map<string, string[]>()
  const hasParent = new Set<string>()
  const add = (m: Map<string, string[]>, k: string, v: string) => {
    const list = m.get(k)
    if (list) list.push(v)
    else m.set(k, [v])
  }
  for (const e of layout.edges) {
    if (e.kind === 'parent') {
      for (const p of e.parents ?? []) for (const k of e.kids ?? []) { add(down, p, k); hasParent.add(k) }
    } else if (e.kind === 'partner' && e.parents) {
      add(mates, e.parents[0], e.parents[1])
      add(mates, e.parents[1], e.parents[0])
    }
  }
  return { down, mates, hasParent }
}

// A cloud for each group of brothers and sisters (with the partners who joined them): wood grows up to it from
// their parents, and the next generation's limbs grow out of its top. Families side by side stay separate clouds.
type Group = { id: string; kids: string[]; ids: string[]; size: number }
function groups(layout: TreeLayout, rel: Relations, at: Map<string, { x: number; y: number; gen: number }>, onTrunk: Set<string>): Group[] {
  const { down, mates, hasParent } = rel
  const below = new Map<string, number>()
  const count = (id: string, trail = new Set<string>()): number => {
    const known = below.get(id)
    if (known !== undefined) return known
    if (trail.has(id)) return 0
    trail.add(id)
    let total = 0
    for (const k of down.get(id) ?? []) total += 1 + count(k, trail)
    trail.delete(id)
    below.set(id, total)
    return total
  }
  const out: Group[] = []
  const byKids = new Map<string, Group>()
  const seen = new Set<string>()
  for (const e of layout.edges) {
    if (e.kind !== 'parent') continue
    const kids = (e.kids ?? []).filter((k) => at.has(k) && !onTrunk.has(k)).sort((p, q) => (at.get(p) as { x: number }).x - (at.get(q) as { x: number }).x)
    if (kids.length === 0) continue
    const key = kids.join(',')
    if (byKids.has(key)) continue
    const ids = [...new Set(kids.flatMap((k) => [k, ...(mates.get(k) ?? []).filter((m) => at.has(m) && !hasParent.has(m) && !onTrunk.has(m))]))]
    const g: Group = { id: e.id, kids, ids, size: kids.reduce((sum, k) => sum + 1 + count(k), 0) }
    byKids.set(key, g)
    out.push(g)
    for (const id of ids) seen.add(id)
  }
  // Anyone left over (no parents on the tree, not on the trunk) gets a small cloud of their own.
  for (const n of layout.nodes) {
    if (seen.has(n.id) || onTrunk.has(n.id)) continue
    seen.add(n.id)
    out.push({ id: 'solo:' + n.id, kids: [n.id], ids: [n.id], size: 1 + count(n.id) })
  }
  // One generation only (nobody above the trunk): one cloud for everyone so the tree is still leafy.
  if (out.length === 0 && layout.nodes.length > 0) out.push({ id: 'all', kids: [layout.nodes[0].id], ids: layout.nodes.map((n) => n.id), size: layout.nodes.length })
  return out
}

// A cloud outline: bumps all the way round, each a round arc, like a child's drawing of a tree top.
function cloudPath(cx: number, cy: number, a: number, b: number, rand: () => number, bump: number, phase: number): string {
  const around = Math.PI * 2
  const perimeter = 4 * (a + b) * 0.9
  const n = clamp(Math.round(perimeter / bump), 8, 44)
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * around + phase
    const c = Math.cos(t)
    const sn = Math.sin(t)
    const j = 1 + (rand() - 0.5) * 0.06
    pts.push([cx + a * j * Math.sign(c || 1) * Math.abs(c) ** (2 / 2.8), cy + b * j * Math.sign(sn || 1) * Math.abs(sn) ** (2 / 2.8)])
  }
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const q = pts[(i + 1) % n]
    const chord = Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])
    const rad = Math.max(10, chord * (0.6 + rand() * 0.12))
    d += `A${r1(rad)} ${r1(rad)} 0 0 1 ${r1(q[0])} ${r1(q[1])}`
  }
  return d + 'Z'
}

function makeCloud(g: Group, tone: number, at: Map<string, { x: number; y: number }>, others: { x: number; y: number }[]): Family | null {
  const nodes = g.ids.map((id) => at.get(id)).filter((n): n is { x: number; y: number } => !!n)
  if (nodes.length === 0) return null
  const rand = seeded(Math.floor(hash(g.id) * 4294967295))
  const x0 = Math.min(...nodes.map((n) => n.x))
  const x1 = Math.max(...nodes.map((n) => n.x + NODE_W))
  const y0 = Math.min(...nodes.map((n) => n.y)) + 6
  const y1 = Math.max(...nodes.map((n) => n.y)) + 74
  // Keep clear of the next family beside this one: the cloud's room on each side is half the free gap.
  const free = Math.min(
    Infinity,
    ...others.filter((o) => o.y + NODE_H > y0 - 20 && o.y < y1 + 20).map((o) => (o.x >= x1 ? o.x - x1 : o.x + NODE_W <= x0 ? x0 - (o.x + NODE_W) : Infinity)),
  )
  const padX = clamp(free / 2 - 16, 6, 40)
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2 - 8
  let a = (x1 - x0) / 2 + padX + 8
  let b = (y1 - y0) / 2 + 30 + Math.min(34, 6 * Math.sqrt(g.size))
  const fits = () => nodes.every((n) => [[n.x, y0], [n.x + NODE_W, y0], [n.x, y1], [n.x + NODE_W, y1]].every(([x, y]) => Math.abs((x - cx) / a) ** 2.8 + Math.abs((y - cy) / b) ** 2.8 < 0.94))
  for (let i = 0; i < 30 && !fits(); i++) { a += 2; b += 3 }
  const phase = rand() * 0.6
  const base = cloudPath(cx, cy, a, b, rand, 112, phase)
  const mid = cloudPath(cx - 4, cy - 6, a - 24, b - 24, rand, 92, phase + 0.35)
  // The lit side of the foliage: a smaller cloud toward the upper left, where the light comes from.
  const hi = cloudPath(cx - a * 0.18, cy - b * 0.26, a * 0.58, b * 0.46, rand, 78, phase + 0.7)
  // Leaves: a fringe all round the rim, so the outline is foliage and not a smooth edge, plus a few inside.
  let leaves = ''
  const perimeter = 4 * (a + b) * 0.9
  const fringe = clamp(Math.round(perimeter / 34), 10, 46)
  for (let i = 0; i < fringe; i++) {
    const t = ((i + rand() * 0.8) / fringe) * Math.PI * 2 + phase
    const c = Math.cos(t)
    const sn = Math.sin(t)
    const px = cx + (a + 2) * Math.sign(c || 1) * Math.abs(c) ** (2 / 2.8)
    const py = cy + (b + 2) * Math.sign(sn || 1) * Math.abs(sn) ** (2 / 2.8)
    leaves += leaf(px, py, Math.atan2(py - cy, px - cx) + (rand() - 0.5) * 1.2, 0.8 + rand() * 0.7)
  }
  const sprinkle = clamp(Math.round((a * b) / 6500), 3, 16)
  for (let i = 0, tries = 0; i < sprinkle && tries < 80; tries++) {
    const x = cx + (rand() * 2 - 1) * a * 0.85
    const y = cy + (rand() * 2 - 1) * b * 0.85
    if (Math.abs((x - cx) / (a - 16)) ** 2.8 + Math.abs((y - cy) / (b - 16)) ** 2.8 > 1) continue
    leaves += leaf(x, y, rand() * 6.28, 0.55 + rand() * 0.5)
    i++
  }
  const blossoms: Family['blossoms'] = []
  for (let i = 0; i < clamp(Math.round(a / 90), 1, 4); i++) {
    const t = rand() * Math.PI * 2
    blossoms.push({ id: g.kids[0], x: r1(cx + Math.cos(t) * (a - 6)), y: r1(cy + Math.sin(t) * (b - 6)), s: r1(0.8 + rand() * 0.5) })
  }
  return {
    id: g.id, tone, ids: g.ids,
    box: { x: r1(cx - a - 14), y: r1(cy - b - 14), w: r1(2 * a + 28), h: r1(2 * b + 28) },
    parts: [{ id: g.kids[0], base, mid, hi, leaves }],
    blossoms,
  }
}

// The wood of every stem: two legs climb from the parents to a fork (thickest there), and a limb curves up from the
// fork to each child. A line of descent with many people below it is a thick limb; the tips are fine twigs.
function woodFor(layout: TreeLayout, rel: Relations, at: Map<string, { x: number; y: number; gen: number }>, onTrunk: Set<string>): Wood[] {
  const memo = new Map<string, Set<string>>()
  const below = (id: string, trail = new Set<string>()): Set<string> => {
    const hit = memo.get(id)
    if (hit) return hit
    const out = new Set<string>()
    if (trail.has(id)) return out
    trail.add(id)
    for (const c of rel.down.get(id) ?? []) {
      out.add(c)
      for (const x of below(c, trail)) out.add(x)
    }
    trail.delete(id)
    memo.set(id, out)
    return out
  }
  const node = (id: string) => at.get(id) as { x: number; y: number; gen: number }
  const cx = (id: string) => node(id).x + NODE_W / 2
  const wood: Wood[] = []
  for (const e of layout.edges) {
    if (e.kind !== 'parent') continue
    const parents = (e.parents ?? []).filter((id) => at.has(id))
    const kids = (e.kids ?? []).filter((id) => at.has(id))
    if (parents.length === 0 || kids.length === 0) continue
    const py = Math.min(...parents.map((id) => node(id).y + TOP))
    const ky = Math.max(...kids.map((id) => node(id).y + BOTTOM))
    const fork: P = { x: parents.reduce((s, id) => s + cx(id), 0) / parents.length, y: ky + (py - ky) * 0.5 }
    const everyone = new Set<string>(kids)
    for (const k of kids) for (const d of below(k)) everyone.add(d)
    const w = clamp(16 + 7 * Math.sqrt(everyone.size), 20, 96)
    let legs = ''
    let limbs = ''
    let shine = ''
    // A tapered piece of wood from a to d, w0 wide at the start and w1 at the end, with a narrow light streak
    // along it (a little to one side) so it reads as bark catching the light.
    const piece = (a: P, b: P, c: P, d: P, w0: number, w1: number, into: 'legs' | 'limbs') => {
      const t = taperPath(cub(a, b, c, d), w0, w1)
      if (into === 'legs') legs += t
      else limbs += t
      const s = -w0 * 0.16
      const sh = (q: P): P => ({ x: q.x + s, y: q.y })
      shine += taperPath(cub(sh(a), sh(b), sh(c), sh(d)), w0 * 0.28, w1 * 0.28)
    }
    // One thick stem rises from the middle of the parents (between a couple) to the fork.
    const base: P = { x: parents.reduce((sum, id) => sum + cx(id), 0) / parents.length, y: py }
    piece(fork, { x: fork.x, y: fork.y + (base.y - fork.y) * 0.4 }, { x: base.x, y: base.y - (base.y - fork.y) * 0.4 }, base, w * 0.8, w, 'legs')
    for (const id of kids) {
      const t: P = { x: cx(id), y: node(id).y + BOTTOM }
      const end = clamp(4 + 2.6 * Math.sqrt(below(id).size + 1), 4, w * 0.8)
      piece(fork, { x: fork.x + (t.x - fork.x) * 0.12, y: fork.y - (fork.y - t.y) * 0.55 }, { x: t.x, y: t.y + (fork.y - t.y) * 0.38 }, t, w * 0.9, end, 'limbs')
    }
    const inside = kids.every((id) => onTrunk.has(id))
    let vein = ''
    if (inside) {
      // Inside the trunk the link is a fine carved line: up from each parent, across, and up to each child.
      const xs = [...parents.map(cx), ...kids.map(cx)]
      vein = parents.map((id) => `M${r1(cx(id))} ${r1(node(id).y + TOP)}L${r1(cx(id))} ${r1(fork.y)}`).join('') +
        `M${r1(Math.min(...xs))} ${r1(fork.y)}H${r1(Math.max(...xs))}` +
        kids.map((id) => `M${r1(cx(id))} ${r1(fork.y)}L${r1(cx(id))} ${r1(node(id).y + BOTTOM)}`).join('')
    }
    wood.push({ id: e.id, parents, kids, legs: inside ? '' : legs, limbs: inside ? '' : limbs, shine: inside ? '' : shine, fork: { x: r1(fork.x), y: r1(fork.y) }, inside, vein })
  }
  return wood
}

export function canopyFor(layout: TreeLayout): Canopy | null {
  if (layout.nodes.length === 0 || layout.width === 0) return null
  const x0 = Math.min(...layout.nodes.map((n) => n.x))
  const x1 = Math.max(...layout.nodes.map((n) => n.x + NODE_W))
  const y0 = Math.min(...layout.nodes.map((n) => n.y))
  const y1 = Math.max(...layout.nodes.map((n) => n.y + NODE_H))
  const cx = layout.origin ?? (x0 + x1) / 2

  // Taller than the people need: lots of room above the youngest row, so the tree reaches up.
  const bottom = y1 + 36
  const top = y0 - 70
  const cy = (top + bottom) / 2
  let a = Math.max(cx - x0, x1 - cx) * 1.18 + 80
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

  const rand = seeded(layout.nodes.length * 7919 + Math.round(layout.width))

  // One trunk holds the oldest generations (up to four rows) and is as wide as the widest of them; it flares into
  // roots at the bottom and stands on the ground. The family branches leave from its top.
  // Always leave at least two generations above the trunk, so there is a branching tree and not just a stump.
  const maxGen = Math.max(...layout.nodes.map((n) => n.gen))
  // Generations 1–2 (indices 0–1) belong to the roots; generations 3–4 (2–3) form the trunk.
  // Keep this structural boundary fixed: adding descendants must never lengthen the trunk.
  const trunkStartGen = Math.min(2, Math.max(0, maxGen - 1))
  const trunkEndGen = Math.min(3, maxGen)
  type Row = { l: number; r: number; yTop: number; yBot: number }
  const rows: Row[] = []
  const onTrunk = new Set<string>()
  const oldestRow = layout.nodes.filter((n) => n.gen === trunkStartGen)
  const cap = Math.max(215, ...oldestRow.map((n) => Math.abs(n.x + NODE_W / 2 - cx) + NODE_W / 2 + 36))
  for (let g = trunkStartGen; g <= trunkEndGen; g++) {
    const ns = layout.nodes.filter((n) => n.gen === g && (g === trunkStartGen || (n.x >= cx - cap && n.x + NODE_W <= cx + cap)))
    if (ns.length === 0) break
    for (const n of ns) onTrunk.add(n.id)
    let l = Math.min(...ns.map((n) => n.x)) - 36
    let r = Math.max(...ns.map((n) => n.x + NODE_W)) + 36
    if (r - l < 220) { const c = (l + r) / 2; l = c - 110; r = c + 110 }
    rows.push({ l, r, yTop: Math.min(...ns.map((n) => n.y)), yBot: Math.max(...ns.map((n) => n.y + NODE_H)) })
  }
  const through = (pts: [number, number][]): string => {
    let d = ''
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]
      d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`
    }
    return d
  }
  const bottomRow = rows[0]
  const topRow = rows[rows.length - 1]
  const B = Math.max(bottomY + 50 + a * 0.1, bottomRow.yBot + 56)
  const T = topRow.yTop - 6
  const w0 = bottomRow.r - bottomRow.l
  const flare = clamp(w0 * 0.5, 90, 320)
  const wob = seeded(4242 + Math.round(w0))
  const wall = (side: 'l' | 'r'): [number, number][] =>
    [...rows].reverse().flatMap((r) => [[r[side] + (wob() - 0.5) * 14, r.yTop + 2], [r[side] + (wob() - 0.5) * 14, r.yBot - 2]] as [number, number][])
  const left = wall('l')
  left.push([bottomRow.l - flare * 0.2, B - 44], [bottomRow.l - flare * 0.7, B - 14], [bottomRow.l - flare * 1.3, B + 2])
  const rightUp = [...wall('r'), [bottomRow.r + flare * 0.2, B - 44], [bottomRow.r + flare * 0.7, B - 14], [bottomRow.r + flare * 1.3, B + 2]].reverse() as [number, number][]
  const tc = (topRow.l + topRow.r) / 2
  const body =
    `M${r1(topRow.l + 14)} ${r1(T + 6)}${through(left)}L${r1(rightUp[0][0])} ${r1(rightUp[0][1])}${through(rightUp)}` +
    `Q${r1(tc)} ${r1(T - 26)} ${r1(topRow.l + 14)} ${r1(T + 6)}Z`
  const brand = seeded(Math.round(w0) + trunkGens)
  const strands = clamp(Math.round(w0 / 70), 4, 18)
  const bark = Array.from({ length: strands }, (_, i) => {
    const x = bottomRow.l + ((i + 0.5) / strands) * w0 + (brand() - 0.5) * 16
    const y0b = T + 30 + brand() * Math.max(10, B - T - 220)
    const len = 110 + brand() * 130
    return `M${r1(x)} ${r1(y0b)} C${r1(x + 8)} ${r1(y0b + len * 0.3)} ${r1(x - 8)} ${r1(y0b + len * 0.65)} ${r1(x + (brand() - 0.5) * 10)} ${r1(y0b + len)}`
  })
  const perSide = clamp(2 + Math.round(w0 / 500), 2, 5)
  const roots = [-1, 1].flatMap((side) =>
    Array.from({ length: perSide }, (_, i) => {
      const sx = (side < 0 ? bottomRow.l - flare * 0.5 : bottomRow.r + flare * 0.5) + side * i * flare * 0.5
      const reach = 70 + i * 34 + brand() * 30
      return `M${r1(sx)} ${r1(B - 6)} C${r1(sx + side * reach * 0.3)} ${r1(B + 6 + i * 3)} ${r1(sx + side * reach * 0.65)} ${r1(B + 12 + i * 4)} ${r1(sx + side * reach)} ${r1(B + 8 + i * 5)}`
    }),
  )
  let grass = ''
  const gr = seeded(99 + Math.round(a))
  for (let gx = bottomRow.l - flare * 2.2; gx < bottomRow.r + flare * 2.2; gx += 22 + gr() * 18) {
    const h = 12 + gr() * 16
    const lean = (gr() - 0.5) * 12
    grass += `M${r1(gx)} ${r1(B + 4)}Q${r1(gx + lean * 0.4)} ${r1(B - h * 0.5)} ${r1(gx + lean)} ${r1(B - h)}Q${r1(gx + 6 + lean * 0.3)} ${r1(B - h * 0.4)} ${r1(gx + 7)} ${r1(B + 4)}Z`
  }
  const ground = `M${r1(cx - a * 0.95)} ${r1(B + 2)} C${r1(cx - a * 0.5)} ${r1(B - 26)} ${r1(cx + a * 0.5)} ${r1(B - 26)} ${r1(cx + a * 0.95)} ${r1(B + 2)} C${r1(cx + a * 0.5)} ${r1(B + 30)} ${r1(cx - a * 0.5)} ${r1(B + 30)} ${r1(cx - a * 0.95)} ${r1(B + 2)}Z`

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

  // Families and wood come from the real parent and child links, not from screen positions.
  const rel = relations(layout)
  const at = new Map(layout.nodes.map((n) => [n.id, n]))
  const wood = woodFor(layout, rel, at, onTrunk)
  const grouped = groups(layout, rel, at, onTrunk)
  const families = grouped
    .map((g) => makeCloud(g, Math.floor(hash(g.id) * 4), at, layout.nodes.filter((n) => !g.ids.includes(n.id) && !onTrunk.has(n.id))))
    .filter((f): f is Family => f !== null)

  // Stars keep clear of the people and their leaves, so they show in the gaps between family canopies.
  const near = (x: number, y: number) => layout.nodes.some((n) => x > n.x - 30 && x < n.x + NODE_W + 30 && y > n.y - 70 && y < n.y + NODE_H + 70)
  const stars: Canopy['stars'] = []
  const wanted = clamp(Math.round(((fx1 - fx0) * (fy1 - fy0)) / 14000), 26, 110)
  for (let tries = 0; tries < 800 && stars.length < wanted; tries++) {
    const x = fx0 + rand() * (fx1 - fx0)
    const y = fy0 + rand() * (B - fy0 - 60)
    if (near(x, y) || Math.hypot(x - mx, y - my) < mr * 1.6) continue
    stars.push({ x: r1(x), y: r1(y), r: r1(1.2 + rand() * 2.2), delay: r1(rand() * 5) })
  }
  // Fireflies drift among the leaves, around real people.
  const flies: Canopy['flies'] = []
  const swarm = clamp(Math.round(layout.nodes.length / 3), 6, 16)
  for (let i = 0; i < swarm; i++) {
    const n = layout.nodes[Math.floor(rand() * layout.nodes.length)]
    flies.push({ x: r1(n.x + rand() * NODE_W), y: r1(n.y + rand() * NODE_H), dx: r1((rand() * 2 - 1) * 55), dy: r1((rand() * 2 - 1) * 45), delay: r1(rand() * 6), dur: r1(7 + rand() * 6) })
  }
  const butterflies: Canopy['butterflies'] = [
    { x: r1(cx - a * 1.02), y: r1(cy - b * 0.35), s: 1, delay: 0 },
    { x: r1(cx + a * 1.04), y: r1(cy + b * 0.05), s: 0.85, delay: 1.3 },
  ]

  return {
    frame: { x: r1(fx0), y: r1(fy0), w: r1(fx1 - fx0), h: r1(fy1 - fy0) },
    families, wood, trunk: { body, bark, roots, ground, grass }, banner, moon, butterflies, stars, flies,
  }
}
