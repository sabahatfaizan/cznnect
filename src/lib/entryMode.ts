import { useSyncExternalStore } from 'react'

// How the owner chose to enter the app this time: as the Administrator (a supervisor view over the whole app) or as
// a Family member (the normal app). It is only a choice of screens: it is the same login, and every admin action is
// still checked on the server against the owner's email. It is forgotten when the app closes or on sign-out, so the
// choice is offered at every entry.
export type EntryMode = 'admin' | 'family'

let current: EntryMode | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setEntryMode(mode: EntryMode | null) {
  if (current === mode) return
  current = mode
  emit()
}

export function useEntryMode(): EntryMode | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => current,
    () => null,
  )
}

// "Switch to Administrator" from the family menu: straight in, no code.
export function requestAdmin() {
  setEntryMode('admin')
}
