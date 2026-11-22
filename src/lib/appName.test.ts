import { describe, expect, it } from 'vitest'
import { APP_NAME, appName } from './appName'

describe('appName', () => {
  it('is Cznnect for everyone, and Cznnect+ for an account that has it', () => {
    expect(appName(false)).toBe(APP_NAME)
    expect(appName(false)).toBe('Cznnect')
    expect(appName(true)).toBe('Cznnect+')
  })
})
