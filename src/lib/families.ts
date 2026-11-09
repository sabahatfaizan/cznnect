// One account can be in up to three families. The one on screen is remembered per person on this phone, so the app
// opens in the family that was open when it was last closed (which is also the one used most recently).
export const MAX_FAMILIES = 3

const KEY = 'cznnect-active-family-'

export function readActiveFamilyId(userId: string): string | null {
  try {
    return localStorage.getItem(KEY + userId)
  } catch {
    return null
  }
}

export function saveActiveFamilyId(userId: string, familyId: string) {
  try {
    localStorage.setItem(KEY + userId, familyId)
  } catch {
    // Storage can be blocked: the app then opens in the first family next time.
  }
}
