import { describe, expect, it } from 'vitest'
import { planReminders, type ReminderPrefs } from './birthdayReminders'
import { toUpcoming, type BirthdayPerson } from './birthdays'

const all: ReminderPrefs = { enabled: true, today: true, tomorrow: true, week: true }
const person = (birthday: string, name = 'Ayesha'): BirthdayPerson => ({ userId: name, name, birthday, isMe: false, isOwner: false, avatar: null })

describe('planReminders', () => {
  const now = new Date(2026, 9, 26, 15, 0) // 26 Oct 2026, 3 pm

  it('plans the day, the day before and the week before, each at 9:00 on its own morning', () => {
    const u = toUpcoming(person('1996-11-12'), now)!
    const plan = planReminders([u], all)
    expect(plan.map((r) => `${r.at.getMonth() + 1}/${r.at.getDate()} ${r.at.getHours()}:00`)).toEqual(['11/5 9:00', '11/11 9:00', '11/12 9:00'])
    expect(plan[2].body).toContain('birthday today')
  })

  it('leaves out the kinds that are switched off', () => {
    const u = toUpcoming(person('1996-11-12'), now)!
    const plan = planReminders([u], { ...all, week: false, tomorrow: false })
    expect(plan).toHaveLength(1)
  })

  it('ignores birthdays further away than two months and gives each reminder its own id', () => {
    const near = toUpcoming(person('1996-11-12', 'A'), now)!
    const far = toUpcoming(person('1996-03-01', 'B'), now)!
    const plan = planReminders([near, far], all)
    expect(plan).toHaveLength(3)
    expect(new Set(plan.map((r) => r.id)).size).toBe(3)
  })
})
