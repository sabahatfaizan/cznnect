import { describe, expect, it } from 'vitest'
import { buildHeaderValue, mustUpdate } from './updateGate'

const base = { minBuild: 100, build: 90, native: true, owner: false }

describe('mustUpdate', () => {
  it('blocks an installed app older than the minimum', () => {
    expect(mustUpdate(base)).toBe(true)
  })

  it('lets an app at or above the minimum through', () => {
    expect(mustUpdate({ ...base, build: 100 })).toBe(false)
    expect(mustUpdate({ ...base, build: 150 })).toBe(false)
  })

  it('does nothing when no minimum is set', () => {
    expect(mustUpdate({ ...base, minBuild: 0 })).toBe(false)
  })

  it('never blocks the website or the owner', () => {
    expect(mustUpdate({ ...base, native: false })).toBe(false)
    expect(mustUpdate({ ...base, owner: true })).toBe(false)
  })

  it('treats an installed app with no build number as the oldest', () => {
    expect(mustUpdate({ ...base, build: null })).toBe(true)
  })
})

describe('buildHeaderValue', () => {
  it('sends a whole positive build number', () => {
    expect(buildHeaderValue('85')).toBe('85')
    expect(buildHeaderValue(85)).toBe('85')
  })

  it('sends nothing for a missing or invalid build', () => {
    expect(buildHeaderValue(undefined)).toBeNull()
    expect(buildHeaderValue('')).toBeNull()
    expect(buildHeaderValue('abc')).toBeNull()
    expect(buildHeaderValue('0')).toBeNull()
    expect(buildHeaderValue('1.5')).toBeNull()
  })
})
