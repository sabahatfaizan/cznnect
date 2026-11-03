import type { Family } from '../types'

// What the app remembers so it can still open with no internet: who is signed in, and which family they are in.
// Nothing else is stored. The family copy is removed when someone signs out.

type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const FAMILY_PREFIX = 'cznnect-family-'

/** Supabase keeps the signed-in session under this key. */
export function supabaseSessionKey(url: string): string {
  try {
    return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
  } catch {
    return 'sb-unknown-auth-token'
  }
}

export type StoredUser = { id: string; email: string }

/** The signed-in person, read from the saved session without any network call. Null when nobody is signed in. */
export function readStoredUser(store: KeyValue, url: string): StoredUser | null {
  try {
    const raw = store.getItem(supabaseSessionKey(url))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { user?: { id?: unknown; email?: unknown }; currentSession?: { user?: { id?: unknown; email?: unknown } } }
    const user = parsed.user ?? parsed.currentSession?.user
    if (!user || typeof user.id !== 'string' || !user.id) return null
    return { id: user.id, email: typeof user.email === 'string' ? user.email : '' }
  } catch {
    return null
  }
}

export function saveFamily(store: KeyValue, userId: string, family: Family) {
  try {
    store.setItem(FAMILY_PREFIX + userId, JSON.stringify(family))
  } catch {
    /* storage full or blocked: the app just needs the internet next time */
  }
}

export function readFamily(store: KeyValue, userId: string): Family | null {
  try {
    const raw = store.getItem(FAMILY_PREFIX + userId)
    if (!raw) return null
    const f = JSON.parse(raw) as Partial<Family>
    return typeof f.id === 'string' && typeof f.name === 'string' ? { id: f.id, name: f.name, invite_code: typeof f.invite_code === 'string' ? f.invite_code : '' } : null
  } catch {
    return null
  }
}

export function clearFamilies(store: Storage) {
  try {
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i)
      if (key && key.startsWith(FAMILY_PREFIX)) store.removeItem(key)
    }
  } catch {
    /* nothing to clear */
  }
}
