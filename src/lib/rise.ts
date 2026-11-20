import { NODE_H, NODE_W, type TreeLayout, type TreeNode } from './tree'

// Lifts the tree. The row-by-row layout puts every generation on one level, so a big family spreads far to the sides.
// This keeps who sits next to whom (couples together, siblings together, each family in its own stretch) and the
// generation of every person, but swings each generation onto a curve above the one before it. The oldest couple
// stand at the trunk; each family's branch fans up and out above them, and the youngest generation reaches the
// highest. Positions only: people, links and generations are not changed, and nothing is random.
export const RISE_SPAN = (70 * Math.PI) / 180 // how far the fan opens, from the far left branch to the far right
const SLOT = 192 // the width of one person in a couple, the same as the row layout uses
const STEP = 190 // compact vertical spacing; generations should not create an oversized trunk
const STAGGER = 84 // in a crowded generation, every other person sits this much higher so they can stand closer
const GAP = 40 // clear space between two people on the same level
const PAD = 60

type Cluster = { ids: string[]; gen: number; cx: number; w: number; th: number; x: number; y: number }

export function riseLayout(base: TreeLayout): TreeLayout {
  const nodes = base.nodes
  if (nodes.length < 2) return base
  const maxGen = Math.max(...nodes.map((n) => n.gen))
  if (maxGen === 0) return base

  // Partners (people who share a level and a partner link) move together as one cluster.
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const root = new Map<string, string>(nodes.map((n) => [n.id, n.id]))
  const find = (id: string): string => {
    let r = id
    while (root.get(r) !== r) r = root.get(r) as string
    root.set(id, r)
    return r
  }
  for (const e of base.edges) {
    if (e.kind !== 'partner' || !e.parents) continue
    const [a, b] = e.parents
    const na = byId.get(a)
    const nb = byId.get(b)
    if (na && nb && na.gen === nb.gen) root.set(find(a), find(b))
  }
  const groups = new Map<string, TreeNode[]>()
  for (const n of nodes) {
    const k = find(n.id)
    const list = groups.get(k)
    if (list) list.push(n)
    else groups.set(k, [n])
  }
  const clusters: Cluster[] = [...groups.values()].map((members) => {
    members.sort((a, b) => a.x - b.x)
    const x0 = members[0].x
    const x1 = members[members.length - 1].x + NODE_W
    return { ids: members.map((m) => m.id), gen: members[0].gen, cx: (x0 + x1) / 2, w: members.length * SLOT, th: 0, x: 0, y: 0 }
  })

  const oldest = clusters.filter((c) => c.gen === 0)
  const origin = oldest.length ? oldest.reduce((s, c) => s + c.cx, 0) / oldest.length : nodes.reduce((s, n) => s + n.x + NODE_W / 2, 0) / nodes.length
  const above = clusters.filter((c) => c.gen > 0)
  const half = Math.max(1, ...above.map((c) => Math.abs(c.cx - origin)))

  // The oldest couple (or couples) stand side by side at the foot of the trunk.
  oldest.sort((a, b) => a.cx - b.cx)
  const span = oldest.reduce((s, c) => s + c.w, 0) + (oldest.length - 1) * 60
  let at = -span / 2
  for (const c of oldest) { c.x = at + c.w / 2; c.y = 0; at += c.w + 60 }

  // Each younger generation is a curve above the last: the same spread of angles, but a bigger radius whenever the
  // people on it need more room. The radius grows until no two people on that level touch, with or without every
  // other person standing a little higher; whichever needs the smaller radius wins.
  const reach = (c: Cluster) => (c.w - (SLOT - NODE_W)) / 2 // half the width of the people in a cluster
  const put = (row: Cluster[], r0: number, stagger: boolean) =>
    row.forEach((c, i) => {
      const r = r0 + (stagger && i % 2 === 1 ? STAGGER : 0)
      c.x = r * Math.sin(c.th)
      c.y = -r * Math.cos(c.th)
    })
  const touching = (row: Cluster[]) => {
    for (let i = 0; i < row.length; i++) {
      for (let j = i + 1; j < row.length && j <= i + 4; j++) {
        if (Math.abs(row[i].x - row[j].x) < reach(row[i]) + reach(row[j]) + GAP && Math.abs(row[i].y - row[j].y) < NODE_H + 16) return true
      }
    }
    return false
  }
  const settle = (row: Cluster[], from: number, stagger: boolean) => {
    let r0 = from
    put(row, r0, stagger)
    for (let guard = 0; guard < 400 && touching(row); guard++) {
      r0 += 16
      put(row, r0, stagger)
    }
    return r0
  }
  let prev = 0
  for (let g = 1; g <= maxGen; g++) {
    const row = clusters.filter((c) => c.gen === g).sort((a, b) => a.cx - b.cx)
    if (row.length === 0) continue
    for (const c of row) c.th = ((c.cx - origin) / half) * (RISE_SPAN / 2)
    const flat = settle(row, prev + STEP, false)
    const zig = settle(row, prev + STEP, true)
    const stagger = flat > zig + 100
    prev = stagger ? zig : flat
    put(row, prev, stagger)
  }

  // Put people on their cluster: couples side by side, level with each other.
  const placed = new Map<string, TreeNode>()
  for (const c of clusters) {
    c.ids.forEach((id, i) => {
      const n = byId.get(id) as TreeNode
      placed.set(id, { ...n, x: c.x - c.w / 2 + i * SLOT + (SLOT - NODE_W) / 2, y: c.y - NODE_H / 2 })
    })
  }
  const minX = Math.min(...[...placed.values()].map((n) => n.x))
  const minY = Math.min(...[...placed.values()].map((n) => n.y))
  const dx = PAD - minX
  const dy = 130 - minY
  const out = nodes.map((n) => {
    const p = placed.get(n.id) as TreeNode
    return { ...p, x: Math.round((p.x + dx) * 10) / 10, y: Math.round((p.y + dy) * 10) / 10 }
  })
  const at2 = new Map(out.map((n) => [n.id, n]))

  // Only the line between partners is drawn from the layout; it follows the people to their new places.
  const edges = base.edges.map((e) => {
    if (e.kind === 'partner' && e.parents) {
      const a = at2.get(e.parents[0])
      const b = at2.get(e.parents[1])
      if (!a || !b) return e
      const [l, r] = a.x <= b.x ? [a, b] : [b, a]
      return { ...e, d: `M${l.x + NODE_W} ${l.y + NODE_H / 2}H${r.x}` }
    }
    return { ...e, d: '', segs: undefined }
  })
  return {
    nodes: out,
    edges,
    width: Math.max(...out.map((n) => n.x + NODE_W)) + PAD,
    height: Math.max(...out.map((n) => n.y + NODE_H)) + 170,
    origin: dx, // the oldest couple stood at 0 before the shift
  }
}
