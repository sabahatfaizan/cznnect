import { describe, expect, it } from 'vitest'
import { BUILD_FLAG_MAX_AGE_MS, buildHeaderValue, deviceKind, isBuildActive, mustUpdate } from './updateGate'

const base = { minBuild: 100, build: 90, native: true }

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

  it('never blocks the website', () => {
    expect(mustUpdate({ ...base, native: false })).toBe(false)
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

describe('deviceKind', () => {
  it('recognises iPhones and iPads', () => {
    expect(deviceKind('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari')).toBe('ios')
    expect(deviceKind('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('ios')
  })

  it('recognises Android', () => {
    expect(deviceKind('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari')).toBe('android')
  })

  it('treats anything else as a computer', () => {
    expect(deviceKind('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe('other')
    expect(deviceKind('')).toBe('other')
  })
})

describe('isBuildActive', () => {
  const now = Date.parse('2026-11-03T10:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()

  it('is on while the flag is set and recent', () => {
    expect(isBuildActive(true, ago(60_000), now)).toBe(true)
  })

  it('is off when the flag is off or missing', () => {
    expect(isBuildActive(false, ago(60_000), now)).toBe(false)
    expect(isBuildActive(undefined, undefined, now)).toBe(false)
    expect(isBuildActive(true, null, now)).toBe(false)
  })

  it('ignores a flag a killed build left behind', () => {
    expect(isBuildActive(true, ago(BUILD_FLAG_MAX_AGE_MS + 1000), now)).toBe(false)
  })

  it('ignores an unreadable time', () => {
    expect(isBuildActive(true, 'not a date', now)).toBe(false)
  })
})
