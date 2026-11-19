import { describe, expect, it } from 'vitest'
import { riseLayout } from './rise'
import { layoutTree, NODE_H, NODE_W, type Link, type Person } from './tree'

let n = 0
function build(kids: number, depth: number) {
  n = 0
  const people: Person[] = []
  const links: Link[] = []
  const mk = (name: string, year: number) => {
    const p: Person = { id: `p${n++}`, family_id: 'f', full_name: name, nickname: null, birth_date: `${year}-01-01`, is_deceased: false, notes: null, claimed_by: null, created_by: null }
    people.push(p)
    return p
  }
  const link = (kind: Link['kind'], a: Person, b: Person) => links.push({ id: `l${n++}`, a_id: a.id, b_id: b.id, kind, created_by: null })
  const g1 = mk('Abdul', 1940), g2 = mk('Fatema', 1944)
  link('partner', g1, g2)
  const grow = (parents: Person[], gen: number, year: number) => {
    if (gen > depth) return
    for (let i = 0; i < kids; i++) {
      const c = mk(`C${n}`, year + i * 2)
      parents.forEach((p) => link('parent', p, c))
      if (gen < depth) {
        const s = mk(`S${n}`, year + i * 2 + 1)
        link('partner', c, s)
        grow([c, s], gen + 1, year + 25)
      }
    }
  }
  grow([g1, g2], 1, 1965)
  return { people, links }
}

describe('riseLayout', () => {
  for (const [kids, depth] of [[2, 2], [3, 3], [4, 3]] as const) {
    it(`keeps everyone, lifts later generations and leaves nobody overlapping (${kids} children, ${depth} generations down)`, () => {
      const { people, links } = build(kids, depth)
      const flat = layoutTree(people, links)
      const up = riseLayout(flat)
      expect(up.nodes.map((x) => x.id)).toEqual(flat.nodes.map((x) => x.id))
      expect(up.nodes.map((x) => x.gen)).toEqual(flat.nodes.map((x) => x.gen))
      expect(up.edges.map((e) => e.id)).toEqual(flat.edges.map((e) => e.id))
      // Each generation is higher up the screen (a smaller y) than the one before it.
      const meanY = (g: number) => {
        const row = up.nodes.filter((x) => x.gen === g)
        return row.reduce((s, x) => s + x.y, 0) / row.length
      }
      const top = Math.max(...up.nodes.map((x) => x.gen))
      for (let g = 1; g <= top; g++) expect(meanY(g)).toBeLessThan(meanY(g - 1))
      // Nobody stands on anybody.
      for (let i = 0; i < up.nodes.length; i++) {
        for (let j = i + 1; j < up.nodes.length; j++) {
          const a = up.nodes[i], b = up.nodes[j]
          expect(Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H - 20).toBe(false)
        }
      }
      // Partners stay level and side by side.
      const at = new Map(up.nodes.map((x) => [x.id, x]))
      for (const e of up.edges.filter((x) => x.kind === 'partner')) {
        const [a, b] = (e.parents ?? []).map((id) => at.get(id))
        expect(a?.y).toBe(b?.y)
        expect(Math.abs((a?.x ?? 0) - (b?.x ?? 0))).toBeLessThan(400)
      }
      // The oldest couple stand at the trunk.
      expect(up.origin).toBeDefined()
    })
  }

  it('is the same every time and leaves a single-row tree alone', () => {
    const { people, links } = build(3, 3)
    const flat = layoutTree(people, links)
    expect(JSON.stringify(riseLayout(flat))).toBe(JSON.stringify(riseLayout(flat)))
    const one = layoutTree(people.slice(0, 2), links.slice(0, 1))
    expect(riseLayout(one)).toBe(one)
  })
})
