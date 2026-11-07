import { useEffect, useRef } from 'react'

// Android's Back button. Every popup, the menu and every screen other than Home takes a place in this stack, and each
// one also takes a place in the browser history. Back then closes the top one instead of leaving the app, and only
// Home (nothing open) lets Back close the app.
const stack: Array<{ close: () => void }> = []
let skip = 0
let listening = false

function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('popstate', () => {
    if (skip > 0) { skip--; return } // this one came from us closing something ourselves
    stack.pop()?.close()
  })
}

// Opens a layer. Returns a function that closes it from our own code (a Close button, a tap outside).
export function pushBackLayer(close: () => void): () => void {
  listen()
  const layer = { close }
  stack.push(layer)
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
