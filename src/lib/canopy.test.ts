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
  it('gives people clouds that follow the real links: nobody is in two clouds, and every person in a cloud is real', () => {
    const f = family()
    const layout = layoutTree(f.people, f.links)
    const deco = canopyFor(layout)
    expect(deco?.families.length).toBeGreaterThan(0)
    const known = new Set(layout.nodes.map((n) => n.id))
    const seen = new Set<string>()
    for (const fam of deco?.families ?? []) {
      for (const id of fam.ids) {
        expect(known.has(id)).toBe(true)
        expect(seen.has(id)).toBe(false) // a person is in one cloud only
        seen.add(id)
      }
    }
  })

  it('draws wood for every stem and is the same every time', () => {
    const f = family()
    const layout = layoutTree(f.people, f.links)
    const one = canopyFor(layout)
    const two = canopyFor(layout)
    expect(one?.wood.length).toBeGreaterThan(0)
    // Every stem has a fork; it is drawn as wood, or (when its children stand inside the trunk) as a fine carved line.
    expect(one?.wood.every((w) => (w.inside ? w.vein.length > 0 : w.legs.length > 0 && w.limbs.length > 0))).toBe(true)
    expect(JSON.stringify(one)).toBe(JSON.stringify(two))
  })

  it('has nothing to draw for an empty tree', () => {
    expect(canopyFor(layoutTree([], []))).toBeNull()
  })
})

describe('canopyFor with many generations', () => {
  it('keeps people who stand inside the trunk out of the canopies above it', () => {
    const people: Person[] = [person('Root', 1900)]
    const links: Link[] = []
    let row = [people[0]]
    for (let g = 1; g <= 6; g++) {
      const next: Person[] = []
      for (const parent of row) {
        const kid = person(`Gen${g}-${next.length}`, 1900 + g * 25)
        people.push(kid); next.push(kid); links.push(link('parent', parent, kid))
      }
      row = next
    }
    const layout = layoutTree(people, links)
    const deco = canopyFor(layout)
    // Whatever stands inside the trunk is in no canopy, and the rest of the tree is in canopies above it.
    const inCloud = new Set((deco?.families ?? []).flatMap((x) => x.ids))
    for (const w of deco?.wood.filter((x) => x.inside) ?? []) expect(w.kids.some((id) => inCloud.has(id))).toBe(false)
    expect(deco?.families.length).toBeGreaterThan(0)
  })
})
