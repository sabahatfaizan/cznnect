import { describe, expect, it } from 'vitest'
import { canopyFor } from './canopy'
import { layoutTree, type Link, type Person } from './tree'

let n = 0
const person = (name: string, year: number): Person => ({
  id: `p${n++}`, family_id: 'f', full_name: name, nickname: null, birth_date: `${year}-01-01`,
  is_deceased: false, notes: null, claimed_by: null, created_by: null,
})
const link = (kind: Link['kind'], a: Person, b: Person): Link => ({ id: `l${n++}`, a_id: a.id, b_id: b.id, kind, created_by: null })

// Two grandparents, two children (each with a partner), and a grandchild under the first couple.
function family() {
  const g1 = person('Abdul', 1940), g2 = person('Fatema', 1944)
  const a = person('Faizan', 1965), aa = person('Nadia', 1966)
  const b = person('Sara', 1968), bb = person('Imran', 1967)
  const c = person('Rafi', 1990)
  const links = [
    link('partner', g1, g2), link('partner', a, aa), link('partner', b, bb),
    link('parent', g1, a), link('parent', g2, a), link('parent', g1, b), link('parent', g2, b),
    link('parent', a, c), link('parent', aa, c),
  ]
  return { people: [g1, g2, a, aa, b, bb, c], links, ids: { a: a.id, aa: aa.id, b: b.id, bb: bb.id, c: c.id, g1: g1.id } }
}

describe('canopyFor', () => {
  it('gives each child of the oldest couple its own family canopy, following the real links', () => {
    const f = family()
    const deco = canopyFor(layoutTree(f.people, f.links))
    expect(deco?.families).toHaveLength(2)
    const byHead = new Map(deco?.families.map((x) => [x.id, x.ids]))
    expect(new Set(byHead.get(f.ids.a))).toEqual(new Set([f.ids.a, f.ids.aa, f.ids.c]))
    expect(new Set(byHead.get(f.ids.b))).toEqual(new Set([f.ids.b, f.ids.bb]))
    // The oldest couple stand on the trunk, in no canopy.
    expect(deco?.families.some((x) => x.ids.includes(f.ids.g1))).toBe(false)
  })

  it('draws wood for every stem and is the same every time', () => {
    const f = family()
    const layout = layoutTree(f.people, f.links)
    const one = canopyFor(layout)
    const two = canopyFor(layout)
    expect(one?.wood.length).toBeGreaterThan(0)
    expect(one?.wood.every((w) => w.legs.length > 0 && w.limbs.length > 0)).toBe(true)
    expect(JSON.stringify(one)).toBe(JSON.stringify(two))
  })

  it('has nothing to draw for an empty tree', () => {
    expect(canopyFor(layoutTree([], []))).toBeNull()
  })
})
