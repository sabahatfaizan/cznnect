import { describe, expect, it, vi } from 'vitest'
import { applyPromoChoice, readPromoChoice, savePromoChoice } from './promoEmails'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const justNow = () => new Date().toISOString()

describe('promo email choice', () => {
  it('is ticked by default and remembers a change', () => {
    const s = memory()
    expect(readPromoChoice(s)).toBe(true)
    savePromoChoice(false, s)
    expect(readPromoChoice(s)).toBe(false)
  })

  it('turns promo emails off for a new account that unticked the box, once', async () => {
    const s = memory()
    savePromoChoice(false, s)
    const optOut = vi.fn().mockResolvedValue(true)
    await applyPromoChoice('u1', justNow(), optOut, s)
    expect(optOut).toHaveBeenCalledWith('u1')
    await applyPromoChoice('u1', justNow(), optOut, s)
    expect(optOut).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the box stayed ticked', async () => {
    const s = memory()
    savePromoChoice(true, s)
    const optOut = vi.fn().mockResolvedValue(true)
    await applyPromoChoice('u1', justNow(), optOut, s)
    expect(optOut).not.toHaveBeenCalled()
  })

  it('does not change an older account that signs in on the same phone', async () => {
    const s = memory()
    savePromoChoice(false, s)
    const optOut = vi.fn().mockResolvedValue(true)
    await applyPromoChoice('old', '2020-01-01T00:00:00Z', optOut, s)
    expect(optOut).not.toHaveBeenCalled()
    expect(s.getItem('cznnect-promo-emails')).toBeNull()
  })

  it('keeps the choice to retry when saving it failed', async () => {
    const s = memory()
    savePromoChoice(false, s)
    await applyPromoChoice('u1', justNow(), async () => false, s)
    expect(s.getItem('cznnect-promo-emails')).toBe('0')
  })
})
