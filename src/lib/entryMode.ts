import { useSyncExternalStore } from 'react'

// How the owner chose to enter the app this time: as the Administrator (a supervisor view over the whole app) or as
// a Family member (the normal app). It is only a choice of screens: it is the same login, and every admin action is
// still checked on the server against the owner's email. It is forgotten when the app closes or on sign-out, so the
// choice is offered at every entry.
export type EntryMode = 'admin' | 'family'

let current: EntryMode | null = null
let unlocked = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setEntryMode(mode: EntryMode | null) {
  if (current === mode) return
  current = mode
  if (mode !== 'admin') unlocked = false // leaving the Administrator view locks it again
  emit()
}

export function useEntryMode(): EntryMode | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => current,
    () => null,
  )
}

// The Administrator view also asks for a code each time it is entered. This is a screen lock for a phone that is
// handed around; the real protection is still the server check of the owner's email on every admin action.
export function unlockAdmin() {
  unlocked = true
  emit()
}

export function useAdminUnlocked(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => unlocked,
    () => false,
  )
}
