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
export type Wood = { id: string; parents: string[]; kids: string[]; legs: string; limbs: string; shine: string; fork: { x: number; y: number } }
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
function branches(layout: TreeLayout, rel: Relations, at: Map<string, { x: number; y: number; gen: number }>) {
  const { down, mates, hasParent } = rel
  const top = new Set(layout.nodes.filter((n) => !hasParent.has(n.id) && n.gen === 0).map((n) => n.id))
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
    if (e.kind === 'parent' && parents.length > 0 && parents.every((p) => top.has(p))) for (const k of e.kids ?? []) heads.add(k)
  }
  for (const h of [...heads].sort((a, b) => x(a) - x(b))) claim(h)
  const rest = layout.nodes.filter((n) => !claimed.has(n.id) && !top.has(n.id)).sort((a, b) => a.gen - b.gen || a.x - b.x)
  for (const n of rest) claim(n.id)
  // One generation only (or nobody below the oldest couple): give everyone one canopy so the tree is still leafy.
  if (out.length === 0 && layout.nodes.length > 0) out.push({ head: layout.nodes[0].id, ids: layout.nodes.map((n) => n.id) })
  return out
}

function makeFamily(g: { head: string; ids: string[] }, tone: number, at: Map<string, { x: number; y: number }>, total: number): Family | null {
  const rand = seeded(Math.floor(hash(g.head) * 4294967295))
  const big = total > 120
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
    // A clump of six round bunches around the pill, plus one behind it. Wide enough to hold the pill, narrow
    // enough that unrelated branches (about 96 apart) still have clear air between them.
    const bunches: { x: number; y: number; r: number; a: number }[] = []
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + (rand() - 0.5) * 0.5
      const j = 0.9 + rand() * 0.2
      bunches.push({ x: cx + Math.cos(a) * NODE_W * 0.42 * j, y: cy + Math.sin(a) * NODE_H * 0.55 * j, r: 30 + rand() * 8, a })
    }
    bunches.push({ x: cx, y: cy, r: 40, a: 0 })
    let leaves = ''
    for (const b of bunches.slice(0, 6)) {
      for (let j = 0; j < (big ? 1 : 2); j++) {
        const ang = b.a + (rand() - 0.5) * 0.9
        leaves += leaf(b.x + Math.cos(ang) * b.r * 0.92, b.y + Math.sin(ang) * b.r * 0.92, ang, 0.8 + rand() * 0.6)
      }
      x0 = Math.min(x0, b.x - b.r - 18)
      x1 = Math.max(x1, b.x + b.r + 18)
      y0 = Math.min(y0, b.y - b.r - 18)
      y1 = Math.max(y1, b.y + b.r + 18)
    }
    if (rand() < 0.4) {
      const b = bunches[Math.floor(rand() * 6)]
      const ang = b.a + (rand() - 0.5) * 0.8
      blossoms.push({ id, x: r1(b.x + Math.cos(ang) * b.r * 0.85), y: r1(b.y + Math.sin(ang) * b.r * 0.85), s: r1(0.8 + rand() * 0.6) })
    }
    parts.push({
      id,
      base: bunches.map((b) => circle(b.x, b.y, b.r)).join(''),
      mid: bunches.map((b) => circle(b.x - b.r * 0.12, b.y - b.r * 0.18, b.r * 0.7)).join(''),
      hi: bunches.slice(0, 6).filter((_, i) => i % 2 === 0).map((b) => circle(b.x - b.r * 0.3, b.y - b.r * 0.38, b.r * 0.3)).join(''),
      leaves,
    })
  }
  if (parts.length === 0) return null
  return { id: g.head, tone, ids: g.ids, box: { x: r1(x0), y: r1(y0), w: r1(x1 - x0), h: r1(y1 - y0) }, parts, blossoms }
}

// The wood of every stem: two legs climb from the parents to a fork (thickest there), and a limb curves up from the
// fork to each child. A line of descent with many people below it is a thick limb; the tips are fine twigs.
function woodFor(layout: TreeLayout, rel: Relations, at: Map<string, { x: number; y: number }>): Wood[] {
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
  const node = (id: string) => at.get(id) as { x: number; y: number }
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
    const w = clamp(8 + 4.2 * Math.sqrt(everyone.size), 9, 44)
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
    for (const id of parents) {
      const p: P = { x: cx(id), y: node(id).y + TOP }
      piece(fork, { x: fork.x, y: fork.y + (p.y - fork.y) * 0.4 }, { x: p.x, y: p.y - (p.y - fork.y) * 0.45 }, p, w * 0.9, w * 0.5, 'legs')
    }
    for (const id of kids) {
      const t: P = { x: cx(id), y: node(id).y + BOTTOM }
      const end = clamp(4 + 2.6 * Math.sqrt(below(id).size + 1), 4, w * 0.8)
      piece(fork, { x: fork.x + (t.x - fork.x) * 0.12, y: fork.y - (fork.y - t.y) * 0.55 }, { x: t.x, y: t.y + (fork.y - t.y) * 0.38 }, t, w * 0.9, end, 'limbs')
    }
    wood.push({ id: e.id, parents, kids, legs, limbs, shine, fork: { x: r1(fork.x), y: r1(fork.y) } })
  }
  return wood
}

export function canopyFor(layout: TreeLayout): Canopy | null {
  if (layout.nodes.length === 0 || layout.width === 0) return null
  const x0 = Math.min(...layout.nodes.map((n) => n.x))
  const x1 = Math.max(...layout.nodes.map((n) => n.x + NODE_W))
  const y0 = Math.min(...layout.nodes.map((n) => n.y))
  const y1 = Math.max(...layout.nodes.map((n) => n.y + NODE_H))
  const cx = (x0 + x1) / 2

  // Taller than the people need: lots of room above the youngest row, so the tree reaches up.
  const bottom = y1 + 36
  const top = y0 - 70
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

  const rand = seeded(layout.nodes.length * 7919 + Math.round(layout.width))

  // Trunk: it thickens and lengthens as the tree widens, flares into roots, and stands on a patch of ground.
  const tw = clamp(26 + a * 0.07, 30, 120)
  const fh = 60 + tw * 0.6
  // The trunk rises to just behind the oldest row, so the oldest people stand on it and the first branches leave from there.
  const T = Math.max(...layout.nodes.filter((n) => n.gen === 0).map((n) => n.y)) - 24
  const B = bottomY + 50 + a * 0.1
  const mid = T + (B - T) * 0.4
  const L = (k: number) => r1(cx - tw * k)
  const R = (k: number) => r1(cx + tw * k)
  const body =
    `M${L(1)} ${r1(T)} C${L(0.92)} ${r1(mid)} ${L(0.88)} ${r1(B - fh - 10)} ${L(1.05)} ${r1(B - fh)} ` +
    `C${L(1.3)} ${r1(B - fh * 0.4)} ${L(2)} ${r1(B - fh * 0.1)} ${L(2.8)} ${r1(B)} L${R(2.8)} ${r1(B)} ` +
    `C${R(2)} ${r1(B - fh * 0.1)} ${R(1.3)} ${r1(B - fh * 0.4)} ${R(1.05)} ${r1(B - fh)} ` +
    `C${R(0.88)} ${r1(B - fh - 10)} ${R(0.92)} ${r1(mid)} ${R(1)} ${r1(T)}Q${r1(cx)} ${r1(T - 22)} ${L(1)} ${r1(T)}Z`
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
  const families = branches(layout, rel, at)
    .map((g, i) => makeFamily(g, i, at, layout.nodes.length))
    .filter((f): f is Family => f !== null)
  const wood = woodFor(layout, rel, at)

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
