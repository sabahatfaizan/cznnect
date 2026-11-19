import { NODE_H, NODE_W, type TreeLayout } from './tree'
import { hash, taperPath } from './roots'

// The living tree behind the people. Every family (a couple or a single parent and their children) gets its own
// canopy of leaves around the children, a wooden limb that grows up from the parents and forks to each child, and a few
// twigs. Families that are side by side are separated by a natural gap, and a canopy grows with the people below it.
// The oldest generation stands on the trunk, with roots going into the ground.
// Only drawing numbers live here (no screen), and everything is seeded from ids, so the tree looks the same every time.

// Where, inside a person's 80-high box, wood leaves a parent (its top) and reaches a child (its bottom).
export const ATTACH_TOP = 8
export const ATTACH_BOTTOM = 74
// The visible part of a person's box (portrait on top, name pill under it).
const BODY_TOP = 5
const BODY_BOTTOM = 76

export type Box = { x0: number; y0: number; x1: number; y1: number }

export type Branch = {
  id: string // the id of the layout edge, which is also what folding uses
  parents: string[]
  kids: string[]
  members: string[] // everybody inside this canopy: the children and the partners who married in
  gen: number // generation of the children
  size: number // how many people grow from this family
  tone: 0 | 1 | 2 // a slightly different green for neighbouring families
  box: Box // canopy plus its limb, for pointing the camera at it
  fork: { x: number; y: number } // where the limb splits, which is where the fold button sits
  canopy: string
  back: string // leaves behind the wood
  front: string // leaves in front of the wood, along the rim
  blossoms: string
  limb: string
  stub: string // only the stem, shown when the branch is folded shut
  light: string // thin highlight along the limb
  twigs: string
  center: { x: number; y: number }
}

export type Canopy = {
  frame: { x: number; y: number; w: number; h: number } // everything that is drawn, for fitting it on screen
  branches: Branch[]
  trunks: { body: string; light: string; bark: string; roots: string; id: string }[]
  inTrunk: Set<string> // families whose children stand inside the trunk (the four oldest generations)
  ground: string
  banner: { x: number; y: number; w: number; h: number; tx: number; ty: number }
  moon: { path: string }
  butterflies: { x: number; y: number; s: number; delay: number }[]
  stars: { x: number; y: number; r: number; delay: number }[]
  flies: { x: number; y: number; dx: number; dy: number; delay: number; dur: number }[]
}

// A tiny seeded random generator.
function seeded(seed: string) {
  let t = Math.floor(hash(seed) * 4294967295) >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const sgn = (v: number) => (v < 0 ? -1 : 1)
const EXP = 2 / 2.8 // a rounded-box shape rather than a plain ellipse, so a wide row of people still fits
const r1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// A point on the canopy outline. `bump` pushes the edge out or in by a few pixels, so it is lobed, not a smooth oval.
function rim(cx: number, cy: number, a: number, b: number, t: number, bump: (t: number) => number): [number, number] {
  const c = Math.cos(t)
  const s = Math.sin(t)
  const d = bump(t)
  return [cx + (a + d) * sgn(c) * Math.abs(c) ** EXP, cy + (b + d) * sgn(s) * Math.abs(s) ** EXP]
}

// A smooth closed curve through the points (quadratic curves between their midpoints).
function smooth(pts: [number, number][]): string {
  const n = pts.length
  const mid = (i: number): [number, number] => {
    const p = pts[i % n]
    const q = pts[(i + 1) % n]
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  }
  const m0 = mid(n - 1)
  let d = `M${r1(m0[0])} ${r1(m0[1])}`
  for (let i = 0; i < n; i++) {
    const m = mid(i)
    d += `Q${r1(pts[i][0])} ${r1(pts[i][1])} ${r1(m[0])} ${r1(m[1])}`
  }
  return d + 'Z'
}

// One leaf: a pointed oval from (x, y) reaching `len` along `angle`.
function leaf(x: number, y: number, angle: number, len: number, wide: number): string {
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  const tx = x + ca * len
  const ty = y + sa * len
  const mx = x + ca * len * 0.5
  const my = y + sa * len * 0.5
  return `M${r1(x)} ${r1(y)}Q${r1(mx - sa * wide)} ${r1(my + ca * wide)} ${r1(tx)} ${r1(ty)}Q${r1(mx + sa * wide)} ${r1(my - ca * wide)} ${r1(x)} ${r1(y)}Z`
}

function blossom(x: number, y: number, s: number): string {
  let d = ''
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2
    const px = x + Math.cos(a) * 4 * s
    const py = y + Math.sin(a) * 4 * s
    d += `M${r1(px - 3 * s)} ${r1(py)}a${r1(3 * s)} ${r1(3 * s)} 0 1 0 ${r1(6 * s)} 0a${r1(3 * s)} ${r1(3 * s)} 0 1 0 ${r1(-6 * s)} 0Z`
  }
  return d
}

const cubic = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
  `M${r1(x0)} ${r1(y0)} C${r1(x1)} ${r1(y1)}, ${r1(x2)} ${r1(y2)}, ${r1(x3)} ${r1(y3)}`

type N = { id: string; x: number; y: number; gen: number }

export function canopyFor(layout: TreeLayout): Canopy | null {
  if (layout.nodes.length === 0 || layout.width === 0) return null
  const at = new Map<string, N>(layout.nodes.map((n) => [n.id, n]))
  const cx = (n: N) => n.x + NODE_W / 2

  // Who is whose parent and partner, read from the layout's own edges, so folding and lit lines agree with it.
  const down = new Map<string, string[]>()
  const hasParent = new Set<string>()
  const mates = new Map<string, string[]>()
  const stems = layout.edges.filter((e) => e.kind === 'parent' && (e.parents ?? []).some((p) => at.has(p)) && (e.kids ?? []).some((k) => at.has(k)))
  for (const e of stems) {
    for (const p of e.parents ?? []) for (const k of e.kids ?? []) {
      down.set(p, [...(down.get(p) ?? []), k])
      hasParent.add(k)
    }
  }
  for (const e of layout.edges) {
    if (e.kind !== 'partner' || !e.parents) continue
    mates.set(e.parents[0], [...(mates.get(e.parents[0]) ?? []), e.parents[1]])
    mates.set(e.parents[1], [...(mates.get(e.parents[1]) ?? []), e.parents[0]])
  }
  const sizeCache = new Map<string, number>()
  const below = (id: string, trail = new Set<string>()): number => {
    const known = sizeCache.get(id)
    if (known !== undefined) return known
    if (trail.has(id)) return 0
    trail.add(id)
    let total = 0
    for (const k of down.get(id) ?? []) total += 1 + below(k, trail)
    trail.delete(id)
    sizeCache.set(id, total)
    return total
  }
  const familySize = (kids: string[]) => kids.reduce((s, k) => s + 1 + below(k), 0)

  // The oldest generations stand inside the trunk (up to four rows); canopies and limbs begin above them.
  const maxGen = Math.max(...layout.nodes.map((n) => n.gen))
  const trunkGens = clamp(maxGen, 1, 4)
  const kidGen = (e: (typeof stems)[number]) => (at.get((e.kids ?? []).find((k) => at.has(k)) as string) as N).gen
  const inTrunk = new Set(stems.filter((e) => kidGen(e) < trunkGens).map((e) => e.id))
  const treeStems = stems.filter((e) => kidGen(e) >= trunkGens)

  const branches: Branch[] = []
  const allBoxes: Box[] = []
  const rowGen = new Map<number, number>()
  let budget = 1500 // the most leaves drawn in total, so a very large family stays quick to pan and pinch
  const wanted = treeStems.reduce((s, e) => s + Math.min(90, Math.round(((e.kids ?? []).length * NODE_W + 120) / 12)), 0)
  const thin = wanted > budget ? budget / wanted : 1

  // Families that share the very same children (two parents who are not a couple) share one canopy.
  const seenKids = new Set<string>()
  for (const e of treeStems) {
    const parents = (e.parents ?? []).filter((p) => at.has(p))
    const kids = (e.kids ?? []).filter((k) => at.has(k)).sort((a, b) => (at.get(a) as N).x - (at.get(b) as N).x)
    const key = kids.join(',')
    const shared = seenKids.has(key)
    seenKids.add(key)
    const rand = seeded(e.id)
    const kidNodes = kids.map((k) => at.get(k) as N)
    const ky = kidNodes[0].y
    const members = [...new Set(kids.flatMap((k) => [k, ...(mates.get(k) ?? []).filter((m) => !hasParent.has(m) && at.get(m)?.y === ky)]))]
    const memberNodes = members.map((m) => at.get(m) as N)
    const gen = kidNodes[0].gen
    rowGen.set(gen, (rowGen.get(gen) ?? 0) + 1)
    const size = familySize(kids)

    // ---- the canopy: around the children and the partners who joined them; taller when more people grow from it ----
    const x0 = Math.min(...memberNodes.map((n) => n.x))
    const x1 = Math.max(...memberNodes.map((n) => n.x + NODE_W))
    const y0 = ky + BODY_TOP
    const y1 = ky + BODY_BOTTOM
    const top = y0 - 30 - Math.min(26, 5 * Math.sqrt(size))
    const bottom = y1 + 12
    const ccx = (x0 + x1) / 2
    const ccy = (top + bottom) / 2
    let a = (x1 - x0) / 2 + 30
    let b = (bottom - top) / 2
    const inside = (k: number) =>
      memberNodes.every((n) =>
        [[n.x, y0], [n.x + NODE_W, y0], [n.x, y1], [n.x + NODE_W, y1]].every(
          ([x, y]) => Math.abs((x - ccx) / a) ** 2.8 + Math.abs((y - ccy) / b) ** 2.8 < k,
        ),
      )
    for (let i = 0; i < 40 && !inside(0.95); i++) { a += 3; b += 2 }
    const ph1 = rand() * 6.28
    const ph2 = rand() * 6.28
    const lobes = 4 + Math.floor(rand() * 3)
    const bump = (t: number) => 5 * Math.sin(lobes * t + ph1) + 3 * Math.sin((lobes * 2 + 1) * t + ph2)
    const around = clamp(Math.round((4 * (a + b)) / 20), 26, 84)
    const outline: [number, number][] = []
    for (let i = 0; i < around; i++) outline.push(rim(ccx, ccy, a, b, (i / around) * Math.PI * 2, bump))
    const canopy = smooth(outline)

    // ---- leaves: dense behind the wood, a lighter rim in front, a few blossoms ----
    const ring = Math.max(14, Math.round(clamp(Math.round((4 * (a + b)) / 15), 30, 110) * thin))
    let back = ''
    let front = ''
    let flowers = ''
    for (let i = 0; i < ring; i++) {
      const t = ((i + rand() * 0.6) / ring) * Math.PI * 2
      const [px, py] = rim(ccx, ccy, a, b, t, bump)
      const out = Math.atan2((py - ccy) / b, (px - ccx) / a)
      back += leaf(px - Math.cos(out) * 4, py - Math.sin(out) * 4, out + (rand() - 0.5) * 1.1, 15 + rand() * 12, 5 + rand() * 3)
      if (i % 2 === 0) {
        const [qx, qy] = rim(ccx, ccy, a - 9, b - 9, t + 0.05, bump)
        front += leaf(qx, qy, out + (rand() - 0.5) * 1.4, 11 + rand() * 9, 4 + rand() * 2.5)
      }
    }
    // Leaves scattered inside so the canopy looks full rather than hollow.
    const fill = Math.round(clamp(Math.round((a * b) / 1300), 10, 60) * thin)
    for (let i = 0, tries = 0; i < fill && tries < fill * 6; tries++) {
      const x = ccx + (rand() * 2 - 1) * a
      const y = ccy + (rand() * 2 - 1) * b
      if (Math.abs((x - ccx) / (a - 8)) ** 2.8 + Math.abs((y - ccy) / (b - 8)) ** 2.8 > 1) continue
      back += leaf(x, y, rand() * 6.28, 10 + rand() * 9, 4 + rand() * 2)
      i++
    }
    const flowerCount = clamp(Math.round(ring / 9), 2, 9)
    for (let i = 0; i < flowerCount; i++) {
      const [px, py] = rim(ccx, ccy, a - 6, b - 6, rand() * Math.PI * 2, bump)
      flowers += blossom(px, py, 0.7 + rand() * 0.5)
    }
    budget -= ring * 1.5 + fill

    // ---- the limb: grows up from the parents, forks, and reaches each child from below ----
    const parentNodes = parents.map((p) => at.get(p) as N)
    const py = Math.min(...parentNodes.map((n) => n.y)) + ATTACH_TOP
    const mx = parentNodes.reduce((s, n) => s + cx(n), 0) / parentNodes.length
    const ey = ky + ATTACH_BOTTOM
    const span = Math.max(40, py - ey)
    const fx = mx + (rand() - 0.5) * 16
    const fy = py - span * 0.46
    const stem = clamp(9 + 4.5 * Math.sqrt(size + 1), 12, 60)
    const stemEnd = stem * 0.8
    let limb = ''
    let light = ''
    let twigs = ''
    const stub = taperPath(cubic(mx, py, mx, py - span * 0.2, fx, fy + span * 0.14, fx, fy), stem, stemEnd, 14)
    limb += stub
    light += taperPath(cubic(mx - stem * 0.18, py, mx - stem * 0.18, py - span * 0.2, fx - stemEnd * 0.18, fy + span * 0.14, fx - stemEnd * 0.18, fy), stem * 0.22, stemEnd * 0.2, 12)
    kidNodes.forEach((k, i) => {
      const kx = cx(k)
      const reach = kx - fx
      const own = below(k.id)
      const w0 = clamp(stemEnd * (kids.length > 1 ? 0.7 : 0.95), 5, stemEnd)
      const w1 = clamp(3.4 + 2.6 * Math.sqrt(own), 3, w0 * 0.8)
      limb += taperPath(cubic(fx, fy, fx + reach * 0.15, fy - span * 0.1, kx - reach * 0.05, ey + span * 0.34, kx, ey), w0, w1, 16)
      // A twig breaks off sideways part way along each limb to a child, ending in a small tuft of leaves.
      const side = (i % 2 === 0 ? -1 : 1) * (rand() < 0.2 ? -1 : 1)
      const tx = fx + reach * 0.62
      const ty = fy - (fy - ey) * 0.56
      const ex = tx + side * (26 + rand() * 18)
      const eyy = ty + 6 + rand() * 18
      twigs += taperPath(cubic(tx, ty, tx + side * 8, ty + 12, ex - side * 10, eyy - 12, ex, eyy), Math.max(3, w1 * 0.55), 1.2, 10)
      front += leaf(ex, eyy, side > 0 ? -0.5 : Math.PI + 0.5, 12, 4.5) + leaf(ex, eyy, side > 0 ? 0.4 : Math.PI - 0.4, 10, 4)
    })

    const lo = Math.min(...[...outline.map((p) => p[0]), mx])
    const hi = Math.max(...[...outline.map((p) => p[0]), mx])
    const box: Box = { x0: lo, y0: Math.min(...outline.map((p) => p[1])), x1: hi, y1: py }
    const lit = (n: number) => (n % 3) as 0 | 1 | 2
    if (shared) {
      // The second parent's limb is added to the first one's canopy instead of drawing a second canopy.
      const first = branches.find((x) => x.kids.join(',') === key)
      if (first) {
        first.limb += limb
        first.stub += stub
        first.light += light
        first.twigs += twigs
        first.parents = [...new Set([...first.parents, ...parents])]
        first.box = { x0: Math.min(first.box.x0, box.x0), y0: Math.min(first.box.y0, box.y0), x1: Math.max(first.box.x1, box.x1), y1: Math.max(first.box.y1, box.y1) }
        continue
      }
    }
    allBoxes.push(box)
    branches.push({
      id: e.id, parents, kids, members, gen, size,
      tone: lit(Math.floor(hash(e.id) * 3)),
      box,
      fork: { x: r1(fx), y: r1(fy) },
      canopy, back, front, blossoms: flowers, limb, stub, light, twigs,
      center: { x: r1(ccx), y: r1(ccy) },
    })
  }

  // ---- the trunk: one big trunk holding the oldest generations, wide enough for every row of them, on the ground ----
  const rootRow = Math.max(...layout.nodes.map((n) => n.y))
  const gy = rootRow + BODY_BOTTOM + 52
  const minX = Math.min(...layout.nodes.map((n) => n.x))
  const maxX = Math.max(...layout.nodes.map((n) => n.x + NODE_W))
  type Row = { y: number; l: number; r: number }
  const rows: Row[] = []
  for (let g = 0; g < trunkGens; g++) {
    const ns = layout.nodes.filter((n) => n.gen === g)
    if (ns.length === 0) continue
    let l = Math.min(...ns.map((n) => n.x)) - 36
    let r = Math.max(...ns.map((n) => n.x + NODE_W)) + 36
    if (r - l < 220) { const c = (l + r) / 2; l = c - 110; r = c + 110 }
    rows.push({ y: ns[0].y, l, r })
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
  const trunks: Canopy['trunks'] = []
  let trunkL = minX
  let trunkR = maxX
  let trunkTop = rootRow
  if (rows.length) {
    const bottomRow = rows[0]
    const topRow = rows[rows.length - 1]
    trunkTop = topRow.y - 6
    const w0 = bottomRow.r - bottomRow.l
    const flare = clamp(w0 * 0.22, 60, 240)
    const left: [number, number][] = [...rows].reverse().flatMap((r) => [[r.l, r.y + 2], [r.l, r.y + 78]] as [number, number][])
    left.push([bottomRow.l - flare * 0.2, gy - 44], [bottomRow.l - flare * 0.7, gy - 14], [bottomRow.l - flare * 1.3, gy + 4])
    const right: [number, number][] = [...rows].reverse().flatMap((r) => [[r.r, r.y + 2], [r.r, r.y + 78]] as [number, number][])
    right.push([bottomRow.r + flare * 0.2, gy - 44], [bottomRow.r + flare * 0.7, gy - 14], [bottomRow.r + flare * 1.3, gy + 4])
    const rightUp = [...right].reverse()
    const cTop = (topRow.l + topRow.r) / 2
    const body =
      `M${r1(topRow.l + 14)} ${r1(trunkTop + 6)}${through(left)}L${r1(rightUp[0][0])} ${r1(rightUp[0][1])}${through(rightUp)}` +
      `Q${r1(cTop)} ${r1(trunkTop - 26)} ${r1(topRow.l + 14)} ${r1(trunkTop + 6)}Z`
    const light = ''
    const rb = seeded('trunk-bark')
    const width = topRow.r - topRow.l
    let bark = ''
    const strands = clamp(Math.round(Math.max(w0, width) / 70), 5, 24)
    for (let i = 0; i < strands; i++) {
      const bx = bottomRow.l + ((i + 0.5) / strands) * w0 + (rb() - 0.5) * 18
      const b0 = trunkTop + 30 + rb() * (gy - trunkTop - 220)
      const len = 120 + rb() * 140
      bark += `M${r1(bx)} ${r1(b0)} C${r1(bx + 9)} ${r1(b0 + len * 0.3)} ${r1(bx - 9)} ${r1(b0 + len * 0.65)} ${r1(bx + (rb() - 0.5) * 12)} ${r1(b0 + len)}`
    }
    let roots = ''
    const perSide = clamp(2 + Math.round(w0 / 500), 2, 5)
    for (const side of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        const sx = (side < 0 ? bottomRow.l - flare * 0.5 : bottomRow.r + flare * 0.5) + side * i * (flare * 0.55)
        const reach = 70 + rb() * 50 + i * 30
        roots += taperPath(cubic(sx, gy - 10, sx + side * reach * 0.3, gy + 6, sx + side * reach * 0.65, gy + 16 + i * 4, sx + side * reach, gy + 22 + i * 7), 12 - i * 1.6, 1.6, 12)
      }
    }
    trunks.push({ id: 'trunk', body, light, bark, roots })
    trunkL = Math.min(minX, bottomRow.l - flare * 1.3)
    trunkR = Math.max(maxX, bottomRow.r + flare * 1.3)
  }

  // ---- ground ----
  const gx0 = trunkL - 140
  const gx1 = trunkR + 140
  const gw = gx1 - gx0
  const ground =
    `M${r1(gx0)} ${r1(gy + 4)} C${r1(gx0 + gw * 0.2)} ${r1(gy - 24)} ${r1(gx0 + gw * 0.4)} ${r1(gy - 6)} ${r1(gx0 + gw * 0.5)} ${r1(gy - 14)} ` +
    `C${r1(gx0 + gw * 0.62)} ${r1(gy - 24)} ${r1(gx0 + gw * 0.8)} ${r1(gy - 8)} ${r1(gx1)} ${r1(gy + 4)} L${r1(gx1)} ${r1(gy + 70)} L${r1(gx0)} ${r1(gy + 70)}Z`

  // ---- sky: banner above the tallest canopy, a moon, stars, fireflies and butterflies ----
  const topY = branches.length ? Math.min(...branches.map((b) => b.box.y0)) : trunkTop - 30
  const highest = branches.length ? branches.reduce((p, q) => (q.box.y0 < p.box.y0 ? q : p)) : null
  const bx = highest ? highest.center.x : (trunkL + trunkR) / 2
  const banner = { x: r1(bx - 130), y: r1(topY - 62), w: 260, h: 44, tx: r1(bx), ty: r1(topY - 32) }
  const fx0 = Math.min(trunkL, ...allBoxes.map((b) => b.x0)) - 110
  const fx1 = Math.max(trunkR, ...allBoxes.map((b) => b.x1)) + 110
  const fy0 = banner.y - 80
  const fy1 = gy + 70
  const mr = 30
  const mx0 = fx0 + 50 + mr
  const my0 = fy0 + 34 + mr
  const moon = { path: `M${r1(mx0)} ${r1(my0 - mr)} A${mr} ${mr} 0 1 0 ${r1(mx0)} ${r1(my0 + mr)} A${r1(mr * 0.78)} ${r1(mr * 0.78)} 0 1 1 ${r1(mx0)} ${r1(my0 - mr)}Z` }

  const rand = seeded('sky:' + layout.nodes.length + ':' + Math.round(layout.width))
  const stars: Canopy['stars'] = []
  const starCount = clamp(Math.round(((fx1 - fx0) * (gy - fy0)) / 22000), 18, 60)
  for (let tries = 0; tries < 500 && stars.length < starCount; tries++) {
    const x = fx0 + rand() * (fx1 - fx0)
    const y = fy0 + rand() * (gy - fy0 - 80)
    if (allBoxes.some((q) => x > q.x0 - 10 && x < q.x1 + 10 && y > q.y0 - 10 && y < q.y1 + 10) || Math.hypot(x - mx0, y - my0) < mr * 1.8) continue
    stars.push({ x: r1(x), y: r1(y), r: r1(1.1 + rand() * 1.9), delay: r1(rand() * 5) })
  }
  const flies: Canopy['flies'] = []
  const swarm = clamp(branches.length, 0, 10)
  for (let i = 0; i < swarm; i++) {
    const b = branches[Math.floor(rand() * branches.length)]
    flies.push({ x: r1(b.center.x + (rand() - 0.5) * (b.box.x1 - b.box.x0) * 0.8), y: r1(b.center.y + (rand() - 0.5) * 50), dx: r1((rand() * 2 - 1) * 40), dy: r1((rand() * 2 - 1) * 30), delay: r1(rand() * 6), dur: r1(7 + rand() * 6) })
  }
  const butterflies: Canopy['butterflies'] = branches.length
    ? [
        { x: r1(fx0 + 130), y: r1((topY + gy) / 2), s: 1, delay: 0 },
        { x: r1(fx1 - 130), y: r1((topY + gy) / 2 + 60), s: 0.85, delay: 1.3 },
      ]
    : []

  return {
    frame: { x: r1(fx0), y: r1(fy0), w: r1(fx1 - fx0), h: r1(fy1 - fy0) },
    branches, trunks, inTrunk, ground, banner, moon, butterflies, stars, flies,
  }
}

// How many people there are in a branch: used by the camera to know how close it can come.
export const BODY = { top: BODY_TOP, bottom: BODY_BOTTOM, w: NODE_W, h: NODE_H }
