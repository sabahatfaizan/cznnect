// A birthday typed or picked by someone, checked before it is saved. Returns a message to show, or null when it is fine.
export const BIRTHDAY_MIN = '1900-01-01'

export const todayISO = (now: Date = new Date()): string => {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function checkBirthday(value: string, now: Date = new Date()): string | null {
  if (!value) return 'Please add your birthday.'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return 'Please pick a real date for your birthday.'
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const real = new Date(Date.UTC(y, mo - 1, d))
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== d) return 'Please pick a real date for your birthday.'
  if (value < BIRTHDAY_MIN) return 'Please check the year of your birthday.'
  if (value > todayISO(now)) return 'Your birthday cannot be in the future.'
  return null
}
