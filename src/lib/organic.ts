import { NODE_H, NODE_W, type TreeLayout, type TreeNode } from './tree'
import { canopyFor, type Canopy } from './canopy'

// Repositions the existing family layout into a broad, upward-growing crown.
// Relationships remain untouched; only visual coordinates and derived artwork change.
export type Organic = Canopy & { nodes: TreeNode[] }

const round = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function organicFor(layout: TreeLayout, aspect = 1.1): Organic | null {
  if (!layout.nodes.length) return null

  const generations = Math.max(...layout.nodes.map((n) => n.gen))
  const roots = layout.nodes.filter((n) => n.gen === 0)
  const rootMid = roots.reduce((s, n) => s + n.x + NODE_W / 2, 0) / Math.max(1, roots.length)
  const byGeneration = new Map<number, TreeNode[]>()
  for (const node of layout.nodes) {
    const row = byGeneration.get(node.gen) ?? []
    row.push(node)
    byGeneration.set(node.gen, row)
  }

  const positions = new Map<string, { x: number; y: number }>()
  const safeAspect = clamp(aspect || 1.1, 0.65, 2.1)
  // Keep one shared horizontal coordinate system for every generation. This is the
  // important bit: a grandchild stays above their own family limb instead of being
  // independently stretched across the entire crown on their generation's row.
  const fan = clamp(0.48 + safeAspect * 0.36, 0.72, 1.18)
  const allCentres = layout.nodes.map((n) => n.x + NODE_W / 2)
  const minCentre = Math.min(...allCentres)
  const maxCentre = Math.max(...allCentres)
  const sourceSpan = Math.max(1, maxCentre - minCentre)

  for (const n of roots) {
    positions.set(n.id, { x: round(n.x + NODE_W / 2 - rootMid), y: 0 })
  }

  let previousRadius = 0
  for (let gen = 1; gen <= generations; gen++) {
    const row = [...(byGeneration.get(gen) ?? [])].sort((a, b) => a.x - b.x)
    if (!row.length) continue

    // A wider ring is used when a generation has many people. The angular gap is
    // calculated from the actual chip width, so names do not collide at the edges.
    let radius = Math.max(previousRadius + 178, 245 + (gen - 1) * 172)
    let angles: number[] = []
    for (let attempt = 0; attempt < 80; attempt++) {
      const minGap = 2 * Math.asin(clamp((NODE_W + 38) / (2 * radius), 0, 0.95))
      angles = []
      for (const n of row) {
        const raw = ((n.x + NODE_W / 2 - minCentre) / sourceSpan) * 2 - 1
        const desired = clamp(raw * fan, -fan, fan)
        const prior = angles[angles.length - 1]
        angles.push(prior === undefined ? desired : Math.max(desired, prior + minGap))
      }
      if (angles[angles.length - 1] <= fan + 1e-5) break
      radius *= 1.12
    }

    row.forEach((n, i) => {
      const angle = clamp(angles[i] ?? 0, -fan, fan)
      positions.set(n.id, {
        x: round(Math.sin(angle) * radius),
        y: round(-168 - Math.cos(angle) * radius * 0.84),
      })
    })
    previousRadius = radius
  }

  const nodes = layout.nodes.map((n) => {
    const p = positions.get(n.id) ?? { x: n.x + NODE_W / 2 - rootMid, y: n.y }
    return { ...n, x: round(p.x - NODE_W / 2), y: round(p.y - NODE_H / 2) }
  })

  // Rebuild partner ties in the new coordinate system. Parent limbs are generated
  // by canopyFor from the updated node positions.
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges = layout.edges.map((edge) => {
    if (edge.kind !== 'partner') return edge
    const [aId, bId] = edge.parents ?? []
    const a = aId ? byId.get(aId) : undefined
    const b = bId ? byId.get(bId) : undefined
    if (!a || !b) return edge
    const left = a.x <= b.x ? a : b
    const right = a.x <= b.x ? b : a
    const x1 = left.x + NODE_W
    const y1 = left.y + NODE_H / 2
    const x2 = right.x
    const y2 = right.y + NODE_H / 2
    const bend = Math.max(22, Math.min(52, (x2 - x1) * 0.28))
    return { ...edge, d: `M${round(x1)} ${round(y1)}C${round(x1 + bend)} ${round(y1 - 20)},${round(x2 - bend)} ${round(y2 - 20)},${round(x2)} ${round(y2)}` }
  })
  const visual: TreeLayout = { ...layout, nodes, edges, origin: 0 }
  const canopy = canopyFor(visual)
  if (!canopy) return null

  // The generated canopy frame already includes the tree, but expand it to include
  // the full extent of the new fan even when the last generation has few leaves.
  const minX = Math.min(...nodes.map((n) => n.x)) - 180
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + 180
  const minY = Math.min(...nodes.map((n) => n.y)) - 150
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H), 400) + 120
  const frame = {
    x: round(Math.min(canopy.frame.x, minX)),
    y: round(Math.min(canopy.frame.y, minY)),
    w: round(Math.max(canopy.frame.x + canopy.frame.w, maxX) - Math.min(canopy.frame.x, minX)),
    h: round(Math.max(canopy.frame.y + canopy.frame.h, maxY) - Math.min(canopy.frame.y, minY)),
  }
  return { ...canopy, frame, nodes }
}
