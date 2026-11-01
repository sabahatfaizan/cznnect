import { describe, expect, it } from 'vitest'
import { parseScanned, pointsFor, pointsSince, rankRows, readableCode } from './irl'

describe('Convoy QR parsing', () => {
  it('accepts a valid person QR and normalizes case/separators', () => {
    expect(parseScanned('czn1-1234abcd-0123456789')).toEqual({
      type: 'person',
      payload: 'CZN1.1234ABCD.0123456789',
    })
  })

  it('accepts a valid group QR', () => {
    expect(parseScanned('CZN1G.A1B2C3D4')).toEqual({
      type: 'group',
      payload: 'CZN1G.A1B2C3D4',
    })
  })

  it('rejects URLs, truncated codes and invalid characters', () => {
    expect(parseScanned('https://example.com')).toBeNull()
    expect(parseScanned('CZN1.1234ABCD')).toBeNull()
    expect(parseScanned('CZN1G.A1B2C3D!')).toBeNull()
  })

  it('formats valid codes for manual entry and leaves invalid input unchanged', () => {
    expect(readableCode('CZN1G.A1B2C3D4')).toBe('CZN1G A1B2 C3D4')
    expect(readableCode('not a code')).toBe('not a code')
  })
})

describe('Convoy points and ranking', () => {
  it('calculates pair and capped group points', () => {
    expect(pointsFor('pair', 2)).toBe(10)
    expect(pointsFor('group', 3)).toBe(15)
    expect(pointsFor('group', 12)).toBe(40)
  })

  it('ranks a copy of the input and shares ranks on equal points', () => {
    const input = [
      { name: 'C', points: 10 },
      { name: 'A', points: 20 },
      { name: 'B', points: 20 },
      { name: 'D', points: 5 },
    ]
    const result = rankRows(input)
    expect(result.map((r) => [r.name, r.rank])).toEqual([
      ['A', 1], ['B', 1], ['C', 3], ['D', 4],
    ])
    expect(input[0].name).toBe('C')
  })

  it('sums only ledger entries on or after the requested date', () => {
    const totals = pointsSince([
      { user_id: 'a', points: 10, created_at: '2026-01-01T00:00:00.000Z' },
      { user_id: 'a', points: 5, created_at: '2026-02-01T00:00:00.000Z' },
      { user_id: 'b', points: 20, created_at: '2026-02-02T00:00:00.000Z' },
    ], '2026-02-01T00:00:00.000Z')
    expect(totals.get('a')).toBe(5)
    expect(totals.get('b')).toBe(20)
  })
})
