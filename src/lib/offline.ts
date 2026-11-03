import { useSyncExternalStore } from 'react'
import { saveResponse, savedResponse } from './savedData'

// One place that knows whether the phone can reach the internet, and that turns network failures into a plain
// sentence. Without it, every screen showed the browser's raw "TypeError: Failed to fetch" while offline.
export const OFFLINE_MESSAGE = "You're offline. This needs an internet connection."

let failing = false // the last request failed because of the network (navigator.onLine can still say true)
let showingSaved = false // an answer came from the saved copy instead of the internet
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((l) => l())

export function isOffline(): boolean {
  return (typeof navigator !== 'undefined' && navigator.onLine === false) || failing
}

/** Called after every request: a failure marks us offline, any answer from the server marks us back online. */
export function reportNetwork(reachable: boolean) {
  if (reachable && showingSaved) { showingSaved = false; tell() }
  if (failing === !reachable) return
  failing = !reachable
  tell()
}

function markShowingSaved() {
  if (showingSaved) return
  showingSaved = true
  tell()
}

export const isShowingSaved = () => showingSaved

let wired = false
function wire() {
  if (wired || typeof window === 'undefined') return
  wired = true
  window.addEventListener('online', () => { failing = false; showingSaved = false; tell() })
  window.addEventListener('offline', tell)
}

function subscribe(cb: () => void) {
  wire()
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, isOffline, () => false)
}

/** True while what is on screen came from the saved copy. */
export function useShowingSaved(): boolean {
  return useSyncExternalStore(subscribe, isShowingSaved, () => false)
}

/** Resolves as soon as the app knows it is offline (immediately if it already does). */
export function whenOffline(): Promise<void> {
  return new Promise((resolve) => {
    if (isOffline()) return resolve()
    wire()
    const check = () => {
      if (!isOffline()) return
      listeners.delete(check)
      resolve()
    }
    listeners.add(check)
  })
}

/** Runs the callback each time the phone comes back online. */
export function onBackOnline(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('online', cb)
  return () => window.removeEventListener('online', cb)
}

const NETWORK_TEXT = /failed to fetch|load failed|networkerror|network request failed|network error|fetch failed|timeout|timed out|offline/i

/** True for the errors a browser throws when a request could not reach the server at all. */
export function isNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return typeof e === 'string' && NETWORK_TEXT.test(e)
  if (e.name === 'AbortError') return false
  return e instanceof TypeError || NETWORK_TEXT.test(e.message)
}

/** A readable sentence for any error. Network problems become the offline message. */
export function friendlyError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isNetworkError(e)) return OFFLINE_MESSAGE
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string' && e) return e
  return fallback
}

/** The answer the app gives for a request that could not be sent. Supabase turns it into a normal, readable error. */
export function offlineResponse(): Response {
  return new Response(JSON.stringify({ message: OFFLINE_MESSAGE, msg: OFFLINE_MESSAGE, error: OFFLINE_MESSAGE, code: 'offline' }), {
    // 502, not 503: Supabase's data client retries 503 several times (a long wait for nothing), while its login
    // client treats 502 as a network hiccup and keeps the saved login instead of signing the person out.
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Used instead of fetch for every Supabase request. */
export async function offlineAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // With no internet: the saved copy of what the person last looked at, or a readable "you're offline" error.
  const unreachable = async () => {
    reportNetwork(false)
    const saved = await savedResponse(input, init)
    if (saved) {
      markShowingSaved()
      return saved
    }
    return offlineResponse()
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return unreachable()
  try {
    const res = await fetch(input, init)
    reportNetwork(true)
    void saveResponse(input, init, res)
    return res
  } catch (e) {
    if (isNetworkError(e)) return unreachable()
    throw e
  }
}
