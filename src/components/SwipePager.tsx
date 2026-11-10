import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

// Swipe left or right anywhere on the screen to move between the screens in the bottom bar, the way WhatsApp's tabs
// work: the screens slide with your finger and the next one settles into place.
//
// - The finger movement moves the screens directly, without re-drawing them, so it stays smooth even in Chat.
// - The neighbouring screen is only mounted while a swipe is under way, so nothing extra loads until you swipe.
// - It is not started on text fields, sliders, dialogs (the full-screen map is one) or anything that scrolls sideways.
const NO_SWIPE = 'input, textarea, select, canvas, [data-no-swipe], [role="slider"], [contenteditable="true"], [role="dialog"], [aria-modal="true"], dialog'
const SETTLE_MS = 240
const START_PX = 7

function scrollsSideways(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n)
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true
  }
  return false
}

type Track = { x: number; y: number; id: number; lastX: number; lastT: number; v: number; dx: number; width: number; drag: boolean }

export default function SwipePager<T extends string>({
  order,
  current,
  enabled,
  onChange,
  render,
}: {
  order: readonly T[]
  current: T
  enabled: boolean
  onChange: (id: T) => void
  render: (id: T) => ReactNode
}) {
  const rootEl = useRef<HTMLDivElement>(null)
  const trackEl = useRef<HTMLDivElement>(null)
  const noAnim = useRef<Set<T>>(new Set())
  const [engaged, setEngaged] = useState(false)
  const [top, setTop] = useState(0)

  const idx = order.indexOf(current)
  const prev = idx > 0 ? order[idx - 1] : null
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null

  const live = useRef({ enabled, prev, next, onChange })
  useEffect(() => { live.current = { enabled, prev, next, onChange } })

  // A screen that arrived by swiping is already on show, so it must not play its entrance animation again.
  useEffect(() => {
    for (const id of [...noAnim.current]) if (id !== current) noAnim.current.delete(id)
  }, [current])

  // Sideways moves have to reach the page as they are, so only vertical scrolling is left to the browser.
  useEffect(() => {
    if (!enabled) return
    const el = document.documentElement
    const before = el.style.touchAction
    el.style.touchAction = 'pan-y pinch-zoom'
    return () => { el.style.touchAction = before }
  }, [enabled])

  useEffect(() => {
    let t: Track | null = null
    let settling = false
    let timer: number | null = null

    const down = (e: PointerEvent) => {
      const L = live.current
      if (!L.enabled || settling || e.pointerType === 'mouse' || !e.isPrimary) return
      const target = e.target instanceof Element ? e.target : null
      if (!target) return
      if (target.closest(NO_SWIPE)) return
      if (scrollsSideways(target)) return
      t = { x: e.clientX, y: e.clientY, id: e.pointerId, lastX: e.clientX, lastT: e.timeStamp, v: 0, dx: 0, width: rootEl.current?.clientWidth || window.innerWidth, drag: false }
    }

    const move = (e: PointerEvent) => {
      if (!t || e.pointerId !== t.id) return
      const mx = e.clientX - t.x
      const my = e.clientY - t.y
      if (!t.drag) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { t = null; return } // an ordinary scroll
        if (Math.abs(mx) < START_PX || Math.abs(mx) < Math.abs(my) * 1.3) return
        t.drag = true
        setTop(Math.max(0, -(rootEl.current?.getBoundingClientRect().top ?? 0)))
        document.documentElement.style.overflowX = 'clip'
        if (trackEl.current) trackEl.current.style.willChange = 'transform'
        setEngaged(true)
      }
      const dt = e.timeStamp - t.lastT
      if (dt > 0) t.v = (e.clientX - t.lastX) / dt
      t.lastX = e.clientX
      t.lastT = e.timeStamp
      const L = live.current
      const blocked = (mx < 0 && !L.next) || (mx > 0 && !L.prev)
      t.dx = blocked ? mx * 0.22 : Math.max(-t.width, Math.min(t.width, mx))
      if (trackEl.current) trackEl.current.style.transform = `translate3d(${t.dx}px,0,0)`
    }

    const reset = () => {
      if (trackEl.current) {
        trackEl.current.style.transition = 'none'
        trackEl.current.style.transform = ''
        trackEl.current.style.willChange = ''
      }
      document.documentElement.style.overflowX = ''
    }

    const up = (e: PointerEvent) => {
      if (!t || e.pointerId !== t.id) return
      const g = t
      t = null
      if (!g.drag) return
      const L = live.current
      const goNext = g.dx < 0
      const target = goNext ? L.next : L.prev
      const commit = Boolean(target) && (Math.abs(g.dx) > g.width * 0.28 || (Math.abs(g.v) > 0.45 && (g.v < 0) === goNext))
      const done = () => {
        timer = null
        // Show the new screen first, then put the track back, so there is never a frame of the old one.
        flushSync(() => {
          if (commit && target) {
            noAnim.current.add(target)
            L.onChange(target)
          }
          setEngaged(false)
        })
        if (commit) window.scrollTo({ top: 0 })
        reset()
        settling = false
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !trackEl.current) { done(); return }
      settling = true
      trackEl.current.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(0.22, 0.8, 0.3, 1)`
      trackEl.current.style.transform = `translate3d(${commit ? (goNext ? -g.width : g.width) : 0}px,0,0)`
      timer = window.setTimeout(done, SETTLE_MS + 30)
    }

    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (timer) window.clearTimeout(timer)
      reset()
    }
  }, [])

  const pane = (id: T, style?: CSSProperties) => (
    <div key={id} className={id === current && !noAnim.current.has(id) ? 'screen-in' : undefined} style={style} aria-hidden={id === current ? undefined : true}>
      {render(id)}
    </div>
  )

  return (
    <div ref={rootEl} style={{ position: 'relative' }}>
      {/* No transform at rest: a transform would trap fixed sheets and menus inside the screen. */}
      <div ref={trackEl}>
        {engaged && prev && pane(prev, { position: 'absolute', top, left: '-100%', width: '100%', pointerEvents: 'none' })}
        {pane(current)}
        {engaged && next && pane(next, { position: 'absolute', top, left: '100%', width: '100%', pointerEvents: 'none' })}
      </div>
    </div>
  )
}
