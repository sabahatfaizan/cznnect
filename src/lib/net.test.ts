import { describe, expect, it } from 'vitest'
import { withTimeout } from './net'

describe('withTimeout', () => {
  it('returns the value when the request completes in time', async () => {
    await expect(withTimeout(Promise.resolve({ ok: true }), 100)).resolves.toEqual({ ok: true })
  })

  it('preserves the original request error', async () => {
    const failure = new Error('network unavailable')
    await expect(withTimeout(Promise.reject(failure), 100)).rejects.toBe(failure)
  })

  it('rejects a request that takes too long', async () => {
    const slow = new Promise<string>(() => {})
    await expect(withTimeout(slow, 10)).rejects.toThrow('timeout')
  })
})
