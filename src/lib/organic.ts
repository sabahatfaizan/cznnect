import { NODE_H, NODE_W, type TreeLayout, type TreeNode } from './tree'
import { canopyFor, type Canopy } from './canopy'

// Turns the existing tidy family hierarchy into a vertically growing tree.
// The layout already reserves a separate horizontal subtree for every family line;
// preserve that ancestry-aware geometry instead of rearranging each generation into a fan.
export type Organic = Canopy & { nodes: TreeNode[] }

const round = (n: number) => Math.round(n * 10) / 10

export function organicFor(layout: TreeLayout, _aspect = 1.1): Organic | null {
  if (!layout.nodes.length) return null

  const oldest = layout.nodes.filter((n) => n.gen === 0)
  const rootMid = oldest.reduce((sum, n) => sum + n.x + NODE_W / 2, 0) / Math.max(1, oldest.length)
  const rootY = Math.max(...oldest.map((n) => n.y))

  // Slightly widen the existing descendant subtrees. Crucially, a person's x-position
  // remains attached to their own descendants, so cousin branches cannot become a
  // generation-wide semicircle disconnected from their parents.
  const HORIZONTAL_SCALE = 1.12
  const VERTICAL_SCALE = 1.06
  const nodes = layout.nodes.map((n) => ({
    ...n,
    x: round((n.x + NODE_W / 2 - rootMid) * HORIZONTAL_SCALE - NODE_W / 2),
    y: round((n.y - rootY) * VERTICAL_SCALE),
  }))

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
    return {
      ...edge,
      d: `M${round(x1)} ${round(y1)}C${round(x1 + bend)} ${round(y1 - 20)},${round(x2 - bend)} ${round(y2 - 20)},${round(x2)} ${round(y2)}`,
    }
  })

  const visual: TreeLayout = { ...layout, nodes, edges, origin: 0 }
  const canopy = canopyFor(visual)
  if (!canopy) return null

  // Keep all foliage, roots, and the full widened family silhouette inside the fit frame.
  const minX = Math.min(...nodes.map((n) => n.x)) - 190
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + 190
  const minY = Math.min(...nodes.map((n) => n.y)) - 150
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H), 400) + 140
  const x = Math.min(canopy.frame.x, minX)
  const y = Math.min(canopy.frame.y, minY)
  const frame = {
    x: round(x),
    y: round(y),
    w: round(Math.max(canopy.frame.x + canopy.frame.w, maxX) - x),
    h: round(Math.max(canopy.frame.y + canopy.frame.h, maxY) - y),
  }
  return { ...canopy, frame, nodes }
}
