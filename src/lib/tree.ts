// Family tree logic with no screens in it: who is whose parent, which generation
// someone is in, where to draw them, how two people are related, and which
// existing people look like a new name being typed (to avoid duplicates).
// Everything here is plain functions, so it can be tested without a browser.

export type Person = {
  id: string
  family_id: string
  full_name: string
  nickname: string | null
  birth_date: string | null // 'YYYY-MM-DD'
  is_deceased: boolean
  notes: string | null
  claimed_by: string | null
  created_by: string | null
}

// kind 'parent': a is a parent of b.  kind 'partner': a and b are partners.
export type Link = {
  id: string
  a_id: string
  b_id: string
  kind: 'parent' | 'partner'
  created_by: string | null
}

export type TreeIndex = {
  byId: Map<string, Person>
  parentsOf: Map<string, string[]>
  childrenOf: Map<string, string[]>
  partnersOf: Map<string, string[]>
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key)
  if (list) {
    if (!list.includes(value)) list.push(value)
  } else {
    map.set(key, [value])
  }
}

export function buildIndex(people: Person[], links: Link[]): TreeIndex {
  const byId = new Map<string, Person>()
  for (const p of people) byId.set(p.id, p)
  const parentsOf = new Map<string, string[]>()
  const childrenOf = new Map<string, string[]>()
  const partnersOf = new Map<string, string[]>()
  for (const l of links) {
    // Ignore a link whose person is missing (for example while data is still loading).
    if (!byId.has(l.a_id) || !byId.has(l.b_id)) continue
    if (l.kind === 'parent') {
      push(childrenOf, l.a_id, l.b_id)
      push(parentsOf, l.b_id, l.a_id)
    } else {
      push(partnersOf, l.a_id, l.b_id)
      push(partnersOf, l.b_id, l.a_id)
    }
  }
  return { byId, parentsOf, childrenOf, partnersOf }
}

const get = (map: Map<string, string[]>, id: string): string[] => map.get(id) ?? []

// ---------- sorting helpers ----------

function personKey(p: Person): string {
  return (p.birth_date ?? '9999-99-99') + '|' + p.full_name.toLowerCase()
}

export function byAgeThenName(a: Person, b: Person): number {
  const ka = personKey(a)
  const kb = personKey(b)
  return ka < kb ? -1 : ka > kb ? 1 : 0
}

// ---------- generations ----------

// Generation 0 is the oldest row. A person is one row below their parents, and
// partners always share a row (someone who married in sits beside their partner).
export function computeGenerations(index: TreeIndex): Map<string, number> {
  const gen = new Map<string, number>()
  for (const id of index.byId.keys()) gen.set(id, 0)
  const limit = index.byId.size + 2 // bad data (a loop) cannot make this run forever
  for (let round = 0; round < limit; round++) {
    let changed = false
    for (const id of index.byId.keys()) {
      let g = gen.get(id) ?? 0
      for (const parent of get(index.parentsOf, id)) g = Math.max(g, (gen.get(parent) ?? 0) + 1)
      for (const partner of get(index.partnersOf, id)) g = Math.max(g, gen.get(partner) ?? 0)
      if (g !== gen.get(id)) {
        gen.set(id, g)
        changed = true
      }
    }
    if (!changed) break
  }
  return gen
}

export function groupByGeneration(people: Person[], gen: Map<string, number>): Person[][] {
  const rows: Person[][] = []
  for (const p of people) {
    const g = gen.get(p.id) ?? 0
    while (rows.length <= g) rows.push([])
    rows[g].push(p)
  }
  for (const row of rows) row.sort(byAgeThenName)
  return rows
}

// ---------- family questions ----------

function ancestorDistances(index: TreeIndex, id: string): Map<string, number> {
  const dist = new Map<string, number>([[id, 0]])
  let frontier = [id]
  let d = 0
  while (frontier.length > 0 && d < 40) {
    d++
    const next: string[] = []
    for (const person of frontier) {
      for (const parent of get(index.parentsOf, person)) {
        if (!dist.has(parent)) {
          dist.set(parent, d)
          next.push(parent)
        }
      }
    }
    frontier = next
  }
  return dist
}

// True if `ancestor` is a parent, grandparent, and so on of `person`.
export function isAncestor(index: TreeIndex, ancestor: string, person: string): boolean {
  return ancestor !== person && ancestorDistances(index, person).has(ancestor)
}

// Would "parentId is a parent of childId" make someone their own ancestor?
export function wouldCreateLoop(index: TreeIndex, parentId: string, childId: string): boolean {
  return parentId === childId || isAncestor(index, childId, parentId)
}

export function siblingsOf(index: TreeIndex, id: string): Person[] {
  const found = new Map<string, Person>()
  for (const parent of get(index.parentsOf, id)) {
    for (const child of get(index.childrenOf, parent)) {
      const person = index.byId.get(child)
      if (person && child !== id) found.set(child, person)
    }
  }
  return [...found.values()].sort(byAgeThenName)
}

export function relativesOf(index: TreeIndex, id: string) {
  const pick = (ids: string[]) =>
    ids
      .map((x) => index.byId.get(x))
      .filter((p): p is Person => p !== undefined)
      .sort(byAgeThenName)
  return {
    parents: pick(get(index.parentsOf, id)),
    partners: pick(get(index.partnersOf, id)),
    children: pick(get(index.childrenOf, id)),
    siblings: siblingsOf(index, id),
  }
}

function greatPrefix(n: number): string {
  // n = 1 gives "Great-", n = 2 gives "Great-great-", and so on.
  return n <= 0 ? '' : n === 1 ? 'Great-' : 'Great-' + 'great-'.repeat(n - 1)
}

function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return n + 'th'
  const last = n % 10
  return n + (last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th')
}

// Names the blood relationship of `other` to `me`, or null when they share no ancestor.
function bloodLabel(index: TreeIndex, me: string, other: string): string | null {
  if (me === other) return 'You'
  const mine = ancestorDistances(index, me)
  const theirs = ancestorDistances(index, other)
  let best: { d1: number; d2: number } | null = null
  for (const [id, d1] of mine) {
    const d2 = theirs.get(id)
    if (d2 === undefined) continue
    if (!best || d1 + d2 < best.d1 + best.d2 || (d1 + d2 === best.d1 + best.d2 && Math.max(d1, d2) < Math.max(best.d1, best.d2))) {
      best = { d1, d2 }
    }
  }
  if (!best) return null
  const { d1, d2 } = best // d1: steps up from me, d2: steps up from them
  if (d1 === 0) return d2 === 1 ? 'Child' : d2 === 2 ? 'Grandchild' : greatPrefix(d2 - 2) + 'grandchild'
  if (d2 === 0) return d1 === 1 ? 'Parent' : d1 === 2 ? 'Grandparent' : greatPrefix(d1 - 2) + 'grandparent'
  if (d1 === 1 && d2 === 1) return 'Sibling'
  if (d1 === 1) return d2 === 2 ? 'Niece/Nephew' : greatPrefix(d2 - 2) + 'niece/nephew'
  if (d2 === 1) return d1 === 2 ? 'Aunt/Uncle' : greatPrefix(d1 - 2) + 'aunt/uncle'
  const degree = Math.min(d1, d2) - 1
  const removed = Math.abs(d1 - d2)
  const base = ordinal(degree) + ' cousin'
  if (removed === 0) return base
  return base + (removed === 1 ? ' once removed' : removed === 2 ? ' twice removed' : ` ${removed} times removed`)
}

const lower = (s: string) => s.toLowerCase()

// "How is <other> related to <me>?" in everyday words. Null when it cannot be worked out.
export function relationLabel(index: TreeIndex, me: string, other: string): string | null {
  const blood = bloodLabel(index, me, other)
  if (blood) return blood
  if (get(index.partnersOf, me).includes(other)) return 'Partner'
  for (const partner of get(index.partnersOf, other)) {
    const label = bloodLabel(index, me, partner)
    if (label && label !== 'You') return 'Partner of your ' + lower(label)
  }
  for (const partner of get(index.partnersOf, me)) {
    const label = bloodLabel(index, partner, other)
    if (label && label !== 'You') return "Your partner's " + lower(label)
  }
  return null
}

// ---------- searching and duplicate warnings ----------

export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function distance(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 3) return 99
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

// People whose name or nickname matches what was typed, best first. Used by every picker.
export function searchPeople(people: Person[], query: string, limit = 8): Person[] {
  const tokens = normalizeName(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return []
  const scored: { p: Person; score: number }[] = []
  for (const p of people) {
    const name = normalizeName(p.full_name)
    const nick = p.nickname ? normalizeName(p.nickname) : ''
    const hay = name + ' ' + nick
    if (!tokens.every((t) => hay.includes(t))) continue
    let score = 1
    if (name === tokens.join(' ')) score += 50
    if (name.startsWith(tokens[0])) score += 10
    if (name.split(' ').some((w) => w.startsWith(tokens[0]))) score += 5
    scored.push({ p, score })
  }
  scored.sort((x, y) => y.score - x.score || byAgeThenName(x.p, y.p))
  return scored.slice(0, limit).map((s) => s.p)
}

export type Similar = { person: Person; reason: string }

// Existing people who may be the same person as the one being added.
export function similarPeople(
  people: Person[],
  name: string,
  birth: string | null,
  limit = 4,
): Similar[] {
  const typed = normalizeName(name)
  if (typed.length < 2) return []
  const typedTokens = typed.split(' ')
  const found: { s: Similar; score: number }[] = []
  for (const p of people) {
    const pn = normalizeName(p.full_name)
    const nick = p.nickname ? normalizeName(p.nickname) : ''
    const tokens = pn.split(' ')
    let score = 0
    let reason = ''
    if (pn === typed) {
      score = 100
      reason = 'Same name'
    } else if (nick && nick === typed) {
      score = 70
      reason = 'Same as their nickname'
    } else {
      const [small, large] = typedTokens.length <= tokens.length ? [typedTokens, tokens] : [tokens, typedTokens]
      const contained = small.length > 0 && small.every((t) => large.some((w) => w === t || (t.length >= 3 && w.startsWith(t))))
      if (contained && (small.length >= 2 || small[0].length >= 4)) {
        score = 80
        reason = 'Similar name'
      } else if (typed.length >= 5 && distance(pn, typed) <= 2) {
        score = 60
        reason = 'Similar spelling'
      }
    }
    if (score === 0) continue
    if (birth && p.birth_date === birth) score += 10
    found.push({ s: { person: p, reason }, score })
  }
  found.sort((x, y) => y.score - x.score)
  return found.slice(0, limit).map((f) => f.s)
}

// ---------- display helpers ----------

export function birthText(p: Person): string {
  if (!p.birth_date) return ''
  const [y, m, d] = p.birth_date.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = Array.from(parts[0])[0] ?? '?'
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] ?? '' : ''
  return (first + last).toUpperCase()
}

// ---------- drawing the tree ----------

export const NODE_W = 112
export const NODE_H = 60
const SLOT = 156
const ROW_H = 156
const PAD = 28

export type TreeNode = { id: string; x: number; y: number; gen: number }
export type TreeEdge = { id: string; kind: 'parent' | 'partner'; d: string }
export type TreeLayout = { nodes: TreeNode[]; edges: TreeEdge[]; width: number; height: number }

type Cluster = { members: string[]; gen: number; start: number }

// Partners (and people who share a partner) sit side by side as one cluster.
function makeClusters(index: TreeIndex, gen: Map<string, number>): Cluster[][] {
  const seen = new Set<string>()
  const rows: Cluster[][] = []
  const ids = [...index.byId.values()].sort(byAgeThenName)
  for (const first of ids) {
    if (seen.has(first.id)) continue
    const g = gen.get(first.id) ?? 0
    const group: string[] = []
    const stack = [first.id]
    seen.add(first.id)
    while (stack.length > 0) {
      const id = stack.pop() as string
      group.push(id)
      for (const partner of get(index.partnersOf, id)) {
        if (!seen.has(partner) && (gen.get(partner) ?? 0) === g) {
          seen.add(partner)
          stack.push(partner)
        }
      }
    }
    // Order the group as a chain so each partner is next to the one they are linked with.
    const degree = (id: string) => get(index.partnersOf, id).filter((x) => group.includes(x)).length
    const sorted = group
      .map((id) => index.byId.get(id) as Person)
      .sort(byAgeThenName)
      .map((p) => p.id)
    const startId = [...sorted].sort((a, b) => degree(a) - degree(b))[0]
    const ordered: string[] = []
    const visit = (id: string) => {
      if (ordered.includes(id)) return
      ordered.push(id)
      for (const next of sorted) if (get(index.partnersOf, id).includes(next)) visit(next)
    }
    visit(startId)
    for (const id of sorted) if (!ordered.includes(id)) ordered.push(id)
    while (rows.length <= g) rows.push([])
    rows[g].push({ members: ordered, gen: g, start: 0 })
  }
  return rows
}

const width = (c: Cluster) => c.members.length * SLOT
const center = (c: Cluster) => c.start + width(c) / 2

// Space kept between two neighbours in a row. Single brothers and sisters sit close.
// A couple sits clearly apart from their brother's or sister's family, and different
// branches sit further apart still, so an uncle and aunt never look like they belong
// to the family next to them.
const GAP_SIBLINGS = 36 // keep sibling cards and their connector lanes distinct
const GAP_COUPLES = 112 // separate a couple from a sibling's family
const GAP_BRANCHES = 220 // leave room between unrelated family branches
type Gap = (a: Cluster, b: Cluster) => number

function place(row: Cluster[], desired: (c: Cluster) => number | null, gap: Gap) {
  const wanted = new Map<Cluster, number>()
  for (const c of row) wanted.set(c, desired(c) ?? center(c))
  // Sort by where each cluster wants to be; ties keep their earlier order.
  const order = new Map<Cluster, number>(row.map((c, i) => [c, i]))
  row.sort((a, b) => (wanted.get(a) as number) - (wanted.get(b) as number) || (order.get(a) as number) - (order.get(b) as number))
  // Clusters that want the very same spot (brothers and sisters under one couple) are
  // centred on it together, instead of the first one taking the spot and the rest sliding right.
  let edge = -Infinity
  let prev: Cluster | null = null
  let k = 0
  while (k < row.length) {
    const target = wanted.get(row[k]) as number
    let m = k + 1
    while (m < row.length && Math.abs((wanted.get(row[m]) as number) - target) < 0.5) m++
    const group = row.slice(k, m)
    let total = 0
    group.forEach((c, i) => {
      total += width(c) + (i > 0 ? gap(group[i - 1], c) : 0)
    })
    let x = Math.max(target - total / 2, prev ? edge + gap(prev, group[0]) : -Infinity)
    group.forEach((c, i) => {
      if (i > 0) x += gap(group[i - 1], c)
      c.start = x
      x += width(c)
    })
    prev = group[group.length - 1]
    edge = prev.start + width(prev)
    k = m
  }
}

export function layoutTree(people: Person[], links: Link[]): TreeLayout {
  const index = buildIndex(people, links)
  if (index.byId.size === 0) return { nodes: [], edges: [], width: 0, height: 0 }
  const gen = computeGenerations(index)
  const rows = makeClusters(index, gen)

  const shareParent = (a: Cluster, b: Cluster) => {
    const parentsOfA = new Set(a.members.flatMap((id) => get(index.parentsOf, id)))
    return b.members.some((id) => get(index.parentsOf, id).some((p) => parentsOfA.has(p)))
  }
  const gap: Gap = (a, b) => {
    if (!shareParent(a, b)) return GAP_BRANCHES
    return a.members.length > 1 || b.members.length > 1 ? GAP_COUPLES : GAP_SIBLINGS
  }

  // Build a hierarchy of descendant clusters before assigning any coordinates.
  // Each partner group is one cluster. A cluster's descendants reserve their own
  // horizontal subtrees, so a large aunt/uncle branch cannot push into a neighbour.
  const clusterOf = new Map<string, Cluster>()
  for (const row of rows) for (const c of row) for (const id of c.members) clusterOf.set(id, c)

  const parentVotes = new Map<Cluster, Map<Cluster, number>>()
  for (const child of rows.flat()) {
    if (!parentVotes.has(child)) parentVotes.set(child, new Map())
  }
  for (const link of links) {
    if (link.kind !== 'parent') continue
    const parentCluster = clusterOf.get(link.a_id)
    const childCluster = clusterOf.get(link.b_id)
    if (!parentCluster || !childCluster || parentCluster === childCluster) continue
    if (parentCluster.gen >= childCluster.gen) continue
    const votes = parentVotes.get(childCluster) as Map<Cluster, number>
    votes.set(parentCluster, (votes.get(parentCluster) ?? 0) + 1)
  }

  // A child can have two parents in separate clusters (for example, when partner
  // information is missing). Use the strongest parent cluster for branch placement;
  // all real parent links are still drawn below, unchanged.
  const primaryParent = new Map<Cluster, Cluster>()
  for (const [child, votes] of parentVotes) {
    const candidates = [...votes.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      const pa = index.byId.get(a[0].members[0]) as Person
      const pb = index.byId.get(b[0].members[0]) as Person
      return byAgeThenName(pa, pb)
    })
    if (candidates.length) primaryParent.set(child, candidates[0][0])
  }

  const childrenByCluster = new Map<Cluster, Cluster[]>()
  for (const [child, parent] of primaryParent) {
    const children = childrenByCluster.get(parent)
    if (children) children.push(child)
    else childrenByCluster.set(parent, [child])
  }
  const clusterOrder = (a: Cluster, b: Cluster) =>
    byAgeThenName(index.byId.get(a.members[0]) as Person, index.byId.get(b.members[0]) as Person)
  for (const children of childrenByCluster.values()) children.sort(clusterOrder)

  const branchGap = GAP_BRANCHES
  const subtreeWidths = new Map<Cluster, number>()
  const measuring = new Set<Cluster>()
  const subtreeWidth = (cluster: Cluster): number => {
    const cached = subtreeWidths.get(cluster)
    if (cached !== undefined) return cached
    // Defensive cycle guard; parent links should already progress by generation.
    if (measuring.has(cluster)) return width(cluster)
    measuring.add(cluster)
    const children = childrenByCluster.get(cluster) ?? []
    const childrenWidth = children.reduce((sum, child) => sum + subtreeWidth(child), 0)
      + Math.max(0, children.length - 1) * branchGap
    const result = Math.max(width(cluster), childrenWidth)
    measuring.delete(cluster)
    subtreeWidths.set(cluster, result)
    return result
  }

  const roots = rows.flat()
    .filter((cluster) => !primaryParent.has(cluster))
    .sort(clusterOrder)
  const positioned = new Set<Cluster>()
  const positionSubtree = (cluster: Cluster, left: number) => {
    if (positioned.has(cluster)) return
    positioned.add(cluster)
    const span = subtreeWidth(cluster)
    const middle = left + span / 2
    cluster.start = middle - width(cluster) / 2

    const children = childrenByCluster.get(cluster) ?? []
    const total = children.reduce((sum, child) => sum + subtreeWidth(child), 0)
      + Math.max(0, children.length - 1) * branchGap
    let childLeft = middle - total / 2
    for (const child of children) {
      positionSubtree(child, childLeft)
      childLeft += subtreeWidth(child) + branchGap
    }
  }

  let rootLeft = 0
  for (const root of roots) {
    positionSubtree(root, rootLeft)
    rootLeft += subtreeWidth(root) + branchGap
  }
  // Keep any unusual disconnected/cyclic data visible rather than dropping it.
  for (const row of rows) {
    for (const cluster of row) {
      if (!positioned.has(cluster)) {
        positionSubtree(cluster, rootLeft)
        rootLeft += subtreeWidth(cluster) + branchGap
      }
    }
  }

  let minX = Infinity
  let maxX = -Infinity
  for (const row of rows) {
    for (const c of row) {
      minX = Math.min(minX, c.start)
      maxX = Math.max(maxX, c.start + width(c))
    }
  }
  const shift = PAD - minX
  const nodes: TreeNode[] = []
  const at = new Map<string, TreeNode>()
  for (const row of rows) {
    for (const c of row) {
      c.members.forEach((id, i) => {
        const node: TreeNode = {
          id,
          gen: c.gen,
          x: c.start + shift + i * SLOT + (SLOT - NODE_W) / 2,
          y: PAD + c.gen * ROW_H,
        }
        nodes.push(node)
        at.set(id, node)
      })
    }
  }

  const edges: TreeEdge[] = []
  const partnerPairs = new Map<string, Link>()
  for (const l of links) if (l.kind === 'partner') partnerPairs.set([l.a_id, l.b_id].sort().join('|'), l)

  for (const l of links) {
    if (l.kind !== 'partner') continue
    const a = at.get(l.a_id)
    const b = at.get(l.b_id)
    if (!a || !b) continue
    const [left, right] = a.x <= b.x ? [a, b] : [b, a]
    const y = left.y + NODE_H / 2
    edges.push({ id: l.id, kind: 'partner', d: `M${left.x + NODE_W} ${y}H${right.x}` })
  }

  // Children of a couple hang from one stem that starts on the line between the two
  // partners, so it is clear they are that couple's children and nobody else's.
  // A child with one known parent, or with parents who are not a couple, hangs from each parent.
  const byChild = new Map<string, string[]>()
  for (const l of links) {
    if (l.kind !== 'parent') continue
    const list = byChild.get(l.b_id)
    if (list) list.push(l.a_id)
    else byChild.set(l.b_id, [l.a_id])
  }
  const stems = new Map<string, { sx: number; sy: number; kids: TreeNode[] }>()
  for (const [childId, parentIds] of byChild) {
    const child = at.get(childId)
    if (!child) continue
    const nodes2 = parentIds.map((p) => at.get(p)).filter((n): n is TreeNode => !!n)
    const sources: { key: string; sx: number; sy: number }[] = []
    const used = new Set<string>()
    for (const p of nodes2) {
      if (used.has(p.id)) continue
      const mate = nodes2.find((q) => q.id !== p.id && !used.has(q.id) && partnerPairs.has([p.id, q.id].sort().join('|')) && q.y === p.y)
      if (mate) {
        const [l, r] = p.x <= mate.x ? [p, mate] : [mate, p]
        used.add(p.id)
        used.add(mate.id)
        sources.push({ key: [p.id, mate.id].sort().join('|'), sx: (l.x + NODE_W + r.x) / 2, sy: l.y + NODE_H / 2 })
      } else {
        used.add(p.id)
        sources.push({ key: p.id, sx: p.x + NODE_W / 2, sy: p.y + NODE_H })
      }
    }
    for (const src of sources) {
      const stem = stems.get(src.key)
      if (stem) stem.kids.push(child)
      else stems.set(src.key, { sx: src.sx, sy: src.sy, kids: [child] })
    }
  }
  for (const [key, stem] of stems) {
    const top = Math.min(...stem.kids.map((k) => k.y))
    const mid = stem.sy + (top - stem.sy) / 2
    const parts = [`M${stem.sx} ${stem.sy} C${stem.sx} ${stem.sy + 24}, ${stem.sx} ${mid - 18}, ${stem.sx} ${mid}`]
    for (const k of stem.kids) {\n      const childX = k.x + NODE_W / 2\n      const bend = Math.max(16, Math.abs(childX - stem.sx) * 0.32)\n      parts.push(`M${stem.sx} ${mid} C${stem.sx} ${mid + bend}, ${childX} ${mid + bend}, ${childX} ${k.y}`)\n    }
    edges.push({ id: `stem:${key}`, kind: 'parent', d: parts.join('') })
  }

  return {
    nodes,
    edges,
    width: maxX - minX + PAD * 2,
    height: PAD * 2 + (rows.length - 1) * ROW_H + NODE_H,
  }
}
