import { useEffect, useRef } from 'react'

// Android's Back button. Every popup, the menu and every screen other than Home takes a place in this stack, and
// Back closes the top one instead of leaving the app. Only Home (nothing open) lets Back close the app.
//
// In the Android app, MainActivity asks the page through window.__cznnectBack() whether something was closed; if not,
// the app closes. In a browser there is no such hook, so each layer also takes a browser history entry and the
// browser's own Back button pops it.
const stack: Array<{ close: () => void }> = []
let skip = 0
let listening = false
let lastHandled = 0

const isNative = () =>
  typeof window !== 'undefined' && Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())

function closeTop(): boolean {
  const top = stack.pop()
  if (!top) return false
  lastHandled = Date.now()
  top.close()
  return true
}

function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  ;(window as unknown as { __cznnectBack: () => boolean }).__cznnectBack = () => {
    if (closeTop()) return true
    // A panel that is still sliding away counts as handled, so a quick second press does not close the app.
    return Date.now() - lastHandled < 300
  }
  window.addEventListener('popstate', () => {
    if (skip > 0) { skip--; return } // this one came from us closing something ourselves
    closeTop()
  })
}

// Opens a layer. Returns a function that closes it from our own code (a Close button, a tap outside).
export function pushBackLayer(close: () => void): () => void {
  listen()
  const layer = { close }
  stack.push(layer)
  if (isNative()) {
    return () => {
      const i = stack.indexOf(layer)
      if (i >= 0) stack.splice(i, 1)
    }
  }
  window.history.pushState({ cznnectLayer: true }, '')
  return () => {
    const i = stack.indexOf(layer)
    if (i < 0) return // already closed by the Back button
    stack.splice(i, 1)
    skip++
    window.history.back()
  }
}

// While `active` is true, the Back button calls `onClose` instead of leaving the app.
export function useBackClose(onClose: () => void, active = true) {
  const latest = useRef(onClose)
  latest.current = onClose
  useEffect(() => {
    if (!active) return
    return pushBackLayer(() => latest.current())
  }, [active])
}
