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

// The primary family branches: each child of the oldest couple starts one, with their partner and everyone below
// them (and the people who married into that line). Anyone left over starts a branch of their own.
function branches(layout: TreeLayout, rel: Relations, at: Map<string, { x: number; y: number; gen: number }>, top: Set<string>) {
  const { down, mates, hasParent } = rel
  // `top` is everyone standing on the trunk (the oldest generations, as far as the trunk is wide); the family branches start above them.
  const claimed = new Set<string>()
  const out: { head: string; ids: string[] }[] = []
  const claim = (head: string) => {
    if (claimed.has(head)) return
    const ids: string[] = []
    const todo = [head]
    while (todo.length) {
      const id = todo.pop() as string
      if (claimed.has(id)) continue
      claimed.add(id)
      ids.push(id)
      for (const k of down.get(id) ?? []) todo.push(k)
      for (const m of mates.get(id) ?? []) if (!top.has(m) && !hasParent.has(m)) todo.push(m)
    }
    if (ids.length) out.push({ head, ids })
  }
  const x = (id: string) => at.get(id)?.x ?? 0
  const heads = new Set<string>()
  for (const e of layout.edges) {
    const parents = e.parents ?? []
    if (e.kind === 'parent' && parents.length > 0 && parents.every((p) => top.has(p))) for (const k of e.kids ?? []) if (!top.has(k)) heads.add(k)
  }
  for (const h of [...heads].sort((a, b) => x(a) - x(b))) claim(h)
  const rest = layout.nodes.filter((n) => !claimed.has(n.id) && !top.has(n.id)).sort((a, b) => a.gen - b.gen || a.x - b.x)
  for (const n of rest) claim(n.id)
  // One generation only (or nobody below the oldest couple): give everyone one canopy so the tree is still leafy.
  if (out.length === 0 && layout.nodes.length > 0) out.push({ head: layout.nodes[0].id, ids: layout.nodes.map((n) => n.id) })
  return out
}

type Bridge = { x: number; y: number; r: number; far?: boolean } // far: leaves along a long limb, not counted in the family's own area
const RING = 5
function makeFamily(g: { head: string; ids: string[] }, tone: number, at: Map<string, { x: number; y: number }>, total: number, bridges: Map<string, Bridge[]>): Family | null {
  const rand = seeded(Math.floor(hash(g.head) * 4294967295))
  const big = total > 40 // a bigger tree gets fewer, simpler leaves so it stays smooth to move
  const parts: Family['parts'] = []
  const blossoms: Family['blossoms'] = []
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const id of g.ids) {
    const n = at.get(id)
    if (!n) continue
    const cx = n.x + NODE_W / 2
    const cy = n.y + NODE_H / 2
    // A clump of round bunches around the pill, plus one behind it. Wide enough to hold the pill, narrow
    // enough that unrelated branches (about 96 apart) still have clear air between them.
    const bunches: { x: number; y: number; r: number; a: number; far?: boolean }[] = []
    for (let k = 0; k < RING; k++) {
      const a = (k / RING) * Math.PI * 2 + (rand() - 0.5) * 0.5
      const j = 0.9 + rand() * 0.2
      bunches.push({ x: cx + Math.cos(a) * NODE_W * 0.42 * j, y: cy + Math.sin(a) * NODE_H * 0.55 * j, r: 31 + rand() * 8, a })
    }
    bunches.push({ x: cx, y: cy, r: 40, a: 0 })
    // Extra bunches along the wood between this person and their family, so the gaps inside a family are leafy.
    for (const b of bridges.get(id) ?? []) bunches.push({ x: b.x, y: b.y, r: b.r + rand() * 6, a: 0, far: b.far })
    let leaves = ''
    for (const b of bunches.slice(0, RING)) {
      for (let j = 0; j < (big ? 1 : 2); j++) {
        const ang = b.a + (rand() - 0.5) * 0.9
        leaves += leaf(b.x + Math.cos(ang) * b.r * 0.92, b.y + Math.sin(ang) * b.r * 0.92, ang, 0.8 + rand() * 0.6)
      }
    }
    for (const b of bunches.filter((q) => !q.far)) {
      x0 = Math.min(x0, b.x - b.r - 18)
      x1 = Math.max(x1, b.x + b.r + 18)
      y0 = Math.min(y0, b.y - b.r - 18)
      y1 = Math.max(y1, b.y + b.r + 18)
    }
    if (rand() < 0.4) {
      const b = bunches[Math.floor(rand() * RING)]
      const ang = b.a + (rand() - 0.5) * 0.8
      blossoms.push({ id, x: r1(b.x + Math.cos(ang) * b.r * 0.85), y: r1(b.y + Math.sin(ang) * b.r * 0.85), s: r1(0.8 + rand() * 0.6) })
    }
    parts.push({
      id,
      base: bunches.map((b) => circle(b.x, b.y, b.r)).join(''),
      mid: bunches.map((b) => circle(b.x - b.r * 0.12, b.y - b.r * 0.18, b.r * 0.7)).join(''),
      hi: bunches.slice(0, 2).map((b) => circle(b.x - b.r * 0.3, b.y - b.r * 0.38, b.r * 0.3)).join(''),
      leaves,
    })
  }
  if (parts.length === 0) return null
  return { id: g.head, tone, ids: g.ids, box: { x: r1(x0), y: r1(y0), w: r1(x1 - x0), h: r1(y1 - y0) }, parts, blossoms }
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
    const kids = (e.kids ?? []).filter((id) => at.has(id)).sort((a, b) => cx(a) - cx(b))
    if (!parents.length || !kids.length) continue

    const everyone = new Set<string>(kids)
    for (const k of kids) for (const d of below(k)) everyone.add(d)
    const w = clamp(12 + 5.8 * Math.sqrt(everyone.size), 13, 62)
    let legs = ''
    let limbs = ''
    let shine = ''
    const piece = (a: P, b: P, c: P, d: P, w0: number, w1: number, into: 'legs' | 'limbs') => {
      const t = taperPath(cub(a, b, c, d), w0, w1)
      if (into === 'legs') legs += t
      else limbs += t
      const offset = -w0 * 0.16
      const sh = (q: P): P => ({ x: q.x + offset, y: q.y })
      shine += taperPath(cub(sh(a), sh(b), sh(c), sh(d)), w0 * 0.2, w1 * 0.2)
    }

    const rootLine = parents.every((id) => onTrunk.has(id))
    const trunkX = parents.reduce((sum, id) => sum + cx(id), 0) / parents.length
    const parentTop = Math.min(...parents.map((id) => node(id).y + TOP))
    const childBottom = Math.max(...kids.map((id) => node(id).y + BOTTOM))
    const sharedFork: P = { x: trunkX, y: childBottom + (parentTop - childBottom) * 0.5 }

    if (rootLine) {
      // The first generation does not fan out from one horizontal bar. Each family
      // grows from its own point on the rising trunk, at a different height.
      const rootJunction: P = { x: trunkX, y: parentTop - 12 }
      for (const id of parents) {
        const p = { x: cx(id), y: node(id).y + TOP }
        piece(rootJunction, { x: rootJunction.x, y: rootJunction.y + 18 }, { x: p.x, y: p.y - 22 }, p, w * 0.72, w * 0.46, 'legs')
      }
      const middle = (kids.length - 1) / 2
      kids.forEach((id, i) => {
        const target: P = { x: cx(id), y: node(id).y + BOTTOM }
        const dx = target.x - trunkX
        const rank = Math.abs(i - middle)
        const attach: P = {
          x: trunkX + clamp(dx * 0.1, -34, 34),
          y: rootJunction.y - 22 - rank * 18,
        }
        const rise = Math.max(55, attach.y - target.y)
        const side = Math.sign(dx || (i % 2 ? 1 : -1))
        const sweep = side * Math.min(92, Math.abs(dx) * 0.3 + 24)
        const c1: P = { x: attach.x + dx * 0.28 + sweep, y: attach.y - rise * 0.22 }
        const c2: P = { x: target.x - dx * 0.12 + sweep * 0.18, y: target.y + rise * 0.34 }
        const tip = clamp(5 + 2.8 * Math.sqrt(below(id).size + 1), 5, w * 0.72)
        piece(attach, c1, c2, target, w * 0.86, tip, 'limbs')
      })
    } else {
      for (const id of parents) {
        const p: P = { x: cx(id), y: node(id).y + TOP }
        piece(sharedFork, { x: sharedFork.x, y: sharedFork.y + (p.y - sharedFork.y) * 0.4 }, { x: p.x, y: p.y - (p.y - sharedFork.y) * 0.45 }, p, w * 0.86, w * 0.48, 'legs')
      }
      for (const id of kids) {
        const t: P = { x: cx(id), y: node(id).y + BOTTOM }
        const dx = t.x - sharedFork.x
        const rise = Math.max(50, sharedFork.y - t.y)
        const end = clamp(4.5 + 2.9 * Math.sqrt(below(id).size + 1), 4.5, w * 0.76)
        const bend = Math.sign(dx || (hash(id) - 0.5)) * Math.min(78, Math.abs(dx) * 0.24 + 18)
        const c1: P = { x: sharedFork.x + dx * 0.32 + bend, y: sharedFork.y - rise * 0.25 }
        const c2: P = { x: t.x - dx * 0.14 + bend * 0.22, y: t.y + rise * 0.32 }
        piece(sharedFork, c1, c2, t, w * 0.92, end, 'limbs')
      }
    }

    const inside = kids.every((id) => onTrunk.has(id))
    const fork = rootLine
      ? { x: trunkX, y: parentTop - 24 }
      : sharedFork
    let vein = ''
    if (inside) {
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

  // The trunk represents the oldest generation only. Every child of that generation
  // starts a distinct family limb, so the canopy reads as a tree rather than stacked rows.
  const trunkGens = 1
  type Row = { l: number; r: number; yTop: number; yBot: number }
  const rows: Row[] = []
  // The trunk stays slim, like a real one: it holds only as many people of each generation as fit in its width.
  // Anyone further out (a big generation of cousins) grows on a limb from the top of the trunk instead.
  const onTrunk = new Set<string>()
  const oldestRow = layout.nodes.filter((n) => n.gen === 0)
  const cap = Math.max(215, ...oldestRow.map((n) => Math.abs(n.x + NODE_W / 2 - cx) + NODE_W / 2 + 36))
  for (let g = 0; g < trunkGens; g++) {
    const ns = layout.nodes.filter((n) => n.gen === g && (g === 0 || (n.x >= cx - cap && n.x + NODE_W <= cx + cap)))
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
  const flare = clamp(w0 * 0.22, 60, 240)
  const wall = (side: 'l' | 'r'): [number, number][] =>
    [...rows].reverse().flatMap((r) => [[r[side], r.yTop + 2], [r[side], r.yBot - 2]] as [number, number][])
  const left = wall('l')
  left.push([bottomRow.l - flare * 0.2, B - 44], [bottomRow.l - flare * 0.7, B - 14], [bottomRow.l - flare * 1.3, B + 2])
  const rightUp = [...wall('r'), [bottomRow.r + flare * 0.2, B - 44], [bottomRow.r + flare * 0.7, B - 14], [bottomRow.r + flare * 1.3, B + 2]].reverse() as [number, number][]
  const tc = (topRow.l + topRow.r) / 2
  // A single sculpted trunk: narrow where the first limbs emerge, broad and
  // deeply flared at the roots. Its curved sides replace the old row-shaped column.
  const trunkHeight = B - T
  const crownHalf = Math.max(112, w0 * 0.56)
  const rootHalf = Math.max(crownHalf + 52, w0 * 0.76)
  const body =
    `M${r1(tc - crownHalf)} ${r1(T + 8)}` +
    `C${r1(tc - crownHalf * 1.12)} ${r1(T + trunkHeight * 0.28)} ${r1(tc - rootHalf * 0.62)} ${r1(B - trunkHeight * 0.22)} ${r1(tc - rootHalf)} ${r1(B)}` +
    `C${r1(tc - rootHalf * 0.92)} ${r1(B + 22)} ${r1(tc - rootHalf * 0.35)} ${r1(B + 28)} ${r1(tc)} ${r1(B + 14)}` +
    `C${r1(tc + rootHalf * 0.35)} ${r1(B + 28)} ${r1(tc + rootHalf * 0.92)} ${r1(B + 22)} ${r1(tc + rootHalf)} ${r1(B)}` +
    `C${r1(tc + rootHalf * 0.62)} ${r1(B - trunkHeight * 0.22)} ${r1(tc + crownHalf * 1.12)} ${r1(T + trunkHeight * 0.28)} ${r1(tc + crownHalf)} ${r1(T + 8)}` +
    `Q${r1(tc)} ${r1(T - 18)} ${r1(tc - crownHalf)} ${r1(T + 8)}Z`
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
  const groups = branches(layout, rel, at, onTrunk)
  const wood = woodFor(layout, rel, at, onTrunk)
  // Leafy bridges: along each stem inside one family, and between partners, so there are no bare gaps inside a
  // family (different families still keep their gap).
  const famOf = new Map<string, number>()
  groups.forEach((g, i) => g.ids.forEach((id) => famOf.set(id, i)))
  const bridges = new Map<string, Bridge[]>()
  const bridge = (id: string, x: number, y: number, r: number, far = false) => {
    const list = bridges.get(id)
    const b = { x, y, r, far }
    if (list) list.push(b)
    else bridges.set(id, [b])
  }
  const pos = (id: string) => at.get(id) as { x: number; y: number }
  // A point a fraction t of the way along the limb from a fork to a child (the same curve the wood is drawn on).
  const onLimb = (fork: { x: number; y: number }, kx: number, ky: number, t: number) => {
    const u = 1 - t
    const p1 = { x: fork.x + (kx - fork.x) * 0.12, y: fork.y - (fork.y - ky) * 0.55 }
    const p2 = { x: kx, y: ky + (fork.y - ky) * 0.38 }
    return {
      x: u * u * u * fork.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * kx,
      y: u * u * u * fork.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * ky,
    }
  }
  for (const w of wood) {
    const f = famOf.get(w.parents[0])
    if (f === undefined) {
      // The oldest couple's limbs sweep out from the trunk to each branch: hedge them with leaves all along.
      if (w.parents.some((p) => famOf.get(p) !== undefined)) continue
      for (const k of w.kids) {
        if (famOf.get(k) === undefined) continue
        const kx = pos(k).x + NODE_W / 2
        const ky = pos(k).y + BOTTOM
        const n = Math.max(2, Math.round(Math.hypot(kx - w.fork.x, ky - w.fork.y) / 58))
        for (let i = 0; i <= n; i++) {
          const q = onLimb(w.fork, kx, ky, 0.1 + (0.86 * i) / n)
          // Alternate sides and sizes a little, so the hedge looks grown rather than like a string of beads.
          bridge(k, q.x, q.y + (i % 2 ? 8 : -8), 21 + ((i * 5) % 8), true)
        }
      }
      continue
    }
    if (!w.parents.every((p) => famOf.get(p) === f)) continue
    bridge(w.parents[0], w.fork.x, w.fork.y, 32)
    for (const p of w.parents) {
      const px = pos(p).x + NODE_W / 2
      if (Math.abs(px - w.fork.x) < 240) bridge(p, (px + w.fork.x) / 2, (pos(p).y + TOP + w.fork.y) / 2, 26)
    }
    for (const k of w.kids) {
      if (famOf.get(k) !== f) continue
      const kx = pos(k).x + NODE_W / 2
      const ky = pos(k).y + BOTTOM
      // Leaves all along the limb to each child, at a steady spacing, so no stretch of it is left bare.
      const reach = Math.hypot(kx - w.fork.x, ky - w.fork.y)
      const n = Math.max(1, Math.round(reach / 62))
      for (let i = 1; i <= n; i++) {
        const q = onLimb(w.fork, kx, ky, i / (n + 1) + 0.04)
        bridge(k, q.x, q.y + (i % 2 ? 6 : -6), 24 + ((i * 3) % 7))
      }
    }
  }
  for (const e of layout.edges) {
    const [a, b] = e.parents ?? []
    if (e.kind !== 'partner' || !a || !b || !at.has(a) || !at.has(b) || famOf.get(a) === undefined || famOf.get(a) !== famOf.get(b)) continue
    bridge(a, (pos(a).x + pos(b).x) / 2 + NODE_W / 2, pos(a).y + NODE_H / 2, 30)
  }
  const families = groups
    .map((g, i) => makeFamily(g, i, at, layout.nodes.length, bridges))
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
    families, wood, trunk: { body, bark, roots, ground }, banner, moon, butterflies, stars, flies,
  }
}
