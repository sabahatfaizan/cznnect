import { describe, expect, it } from 'vitest'
import { checkBirthday } from './birthdayInput'

const now = new Date('2026-11-23T12:00:00')

describe('checkBirthday', () => {
  it('accepts a normal birthday and today', () => {
    expect(checkBirthday('1998-04-09', now)).toBeNull()
    expect(checkBirthday('2026-11-23', now)).toBeNull()
  })
  it('asks for one when empty', () => {
    expect(checkBirthday('', now)).toMatch(/add your birthday/i)
  })
  it('refuses the future, ancient years and dates that do not exist', () => {
    expect(checkBirthday('2026-11-24', now)).toMatch(/future/i)
    expect(checkBirthday('1850-01-01', now)).toMatch(/year/i)
    expect(checkBirthday('2025-02-30', now)).toMatch(/real date/i)
    expect(checkBirthday('09/04/1998', now)).toMatch(/real date/i)
  })
  it('accepts 29 February in a leap year only', () => {
    expect(checkBirthday('2000-02-29', now)).toBeNull()
    expect(checkBirthday('2001-02-29', now)).toMatch(/real date/i)
  })
})
