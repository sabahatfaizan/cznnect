import { describe, expect, it } from 'vitest'
import { isPasswordRecoveryEvent, nextAuthMode } from './auth'

describe('authentication navigation', () => {
  it('returns from password reset to sign-in, not sign-up', () => {
    expect(nextAuthMode('reset')).toBe('up')
  })

  it('switches between sign-in and sign-up', () => {
    expect(nextAuthMode('in')).toBe('up')
    expect(nextAuthMode('up')).toBe('in')
  })

  it('recognizes only Supabase password recovery events', () => {
    expect(isPasswordRecoveryEvent('PASSWORD_RECOVERY')).toBe(true)
    expect(isPasswordRecoveryEvent('SIGNED_IN')).toBe(false)
    expect(isPasswordRecoveryEvent('TOKEN_REFRESHED')).toBe(false)
  })
})
