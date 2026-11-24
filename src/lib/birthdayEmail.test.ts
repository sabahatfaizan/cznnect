import { describe, expect, it } from 'vitest'
import { birthdayIsToday, renderBirthday, todayIn } from '../../supabase/functions/_shared/birthday'

describe('birthday email', () => {
  it('finds birthdays that fall today, whatever the birth year', () => {
    const today = { year: 2026, month: 11, day: 22 }
    expect(birthdayIsToday('1990-11-22', today)).toBe(true)
    expect(birthdayIsToday('2012-11-22', today)).toBe(true)
    expect(birthdayIsToday('1990-11-23', today)).toBe(false)
    expect(birthdayIsToday(null, today)).toBe(false)
    expect(birthdayIsToday('not a date', today)).toBe(false)
  })

  it('celebrates 29 February on 28 February in years without one', () => {
    expect(birthdayIsToday('2000-02-29', { year: 2027, month: 2, day: 28 })).toBe(true)
    expect(birthdayIsToday('2000-02-29', { year: 2028, month: 2, day: 28 })).toBe(false)
    expect(birthdayIsToday('2000-02-29', { year: 2028, month: 2, day: 29 })).toBe(true)
  })

  it('uses the date where the people live, not the server date', () => {
    const lateNightUtc = new Date('2026-11-21T20:30:00Z')
    expect(todayIn('UTC', lateNightUtc).day).toBe(21)
    expect(todayIn('Asia/Dhaka', lateNightUtc).day).toBe(22)
  })

  it('greets the person by name and never lets a name become HTML', () => {
    const r = renderBirthday('<b>Ayesha</b>')
    expect(r.subject).toContain('Happy birthday')
    expect(r.html).not.toContain('<b>Ayesha</b>')
    expect(r.html).toContain('&lt;b&gt;Ayesha&lt;/b&gt;')
    expect(r.text).toContain('Open Cznnect: https://sabahatfaizan.github.io/cznnect/')
  })

  it('shows a gift card only when a gift is set, and escapes it', () => {
    expect(renderBirthday('Sam').html).not.toContain('A birthday gift for you')
    const r = renderBirthday('Sam', { title: 'A free month of <Cznnect+>', code: 'BDAY-1' })
    expect(r.html).toContain('A little something for you')
    expect(r.html).toContain('&lt;Cznnect+&gt;')
    expect(r.html).toContain('BDAY-1')
    expect(r.text).toContain('Code: BDAY-1')
  })

  it('still reads well when there is no name', () => {
    expect(renderBirthday('  ').subject).toContain('friend')
  })
})


describe('birthday email media', () => {
  it('renders a photo, linked video poster, caption and video link in text', () => {
    const media = {
      imageUrl: 'https://example.com/birthday.jpg',
      videoUrl: 'https://example.com/birthday.mp4',
      posterUrl: 'https://example.com/poster.jpg',
      caption: 'A little birthday message',
    }
    const result = renderBirthday('Sam', undefined, media)
    expect(result.html).toContain('src="https://example.com/birthday.jpg"')
    expect(result.html).toContain('href="https://example.com/birthday.mp4"')
    expect(result.html).toContain('A little birthday message')
    expect(result.text).toContain('Watch your birthday video: https://example.com/birthday.mp4')
  })

  it('does not render unsafe media URLs as HTML links', () => {
    const result = renderBirthday('Sam', undefined, {
      imageUrl: 'javascript:alert(1)',
      videoUrl: 'javascript:alert(1)',
      caption: '<script>bad</script>',
    })
    expect(result.html).not.toContain('javascript:')
    expect(result.html).not.toContain('<script>bad</script>')
    expect(result.html).not.toContain('bad')
  })
})
