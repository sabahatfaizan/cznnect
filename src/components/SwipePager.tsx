import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

// Swipe left or right to move between the screens in the bottom bar, the way WhatsApp's tabs work: the screens slide
// with your finger and the next one settles into place. The neighbouring screen is only mounted while a swipe is
// under way, so nothing extra loads until you actually swipe.
//
// Not started on text fields, maps, canvases, sliders or anything that scrolls sideways, so those keep their own drags.
const NO_SWIPE = 'input, textarea, select, canvas, [data-no-swipe], .leaflet-container, [role="slider"], [contenteditable="true"]'
const SETTLE_MS = 260

function scrollsSideways(el: Element | null, root: Element): boolean {
  for (let n = el; n && n !== root; n = n.parentElement) {
    const s = getComputedStyle(n)
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true
  }
  return false
}

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
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<{ x: number; y: number; id: number; lastX: number; lastT: number; v: number; width: number; drag: boolean } | null>(null)
  const settleTimer = useRef<number | null>(null)
  const noAnim = useRef<Set<T>>(new Set())
  const [engaged, setEngaged] = useState(false)
  const [settling, setSettling] = useState(false)
  const [dx, setDx] = useState(0)
  const [top, setTop] = useState(0)

  const idx = order.indexOf(current)
  const prev = idx > 0 ? order[idx - 1] : null
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null

  // A screen that arrived by swiping is already on show, so it must not play its entrance animation again.
  useEffect(() => {
    for (const id of [...noAnim.current]) if (id !== current) noAnim.current.delete(id)
  }, [current])
  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current) }, [])

  function down(e: PointerEvent<HTMLDivElement>) {
    if (!enabled || settling || e.pointerType === 'mouse' || !e.isPrimary) return
    const root = viewport.current
    const target = e.target as Element
    if (!root || target.closest(NO_SWIPE) || scrollsSideways(target, root)) return
    track.current = { x: e.clientX, y: e.clientY, id: e.pointerId, lastX: e.clientX, lastT: e.timeStamp, v: 0, width: root.clientWidth, drag: false }
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const t = track.current
    if (!t || e.pointerId !== t.id) return
    const mx = e.clientX - t.x
    const my = e.clientY - t.y
    if (!t.drag) {
      if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) { track.current = null; return } // a normal scroll
      if (Math.abs(mx) < 12 || Math.abs(mx) < Math.abs(my) * 1.4) return
      t.drag = true
      try { viewport.current?.setPointerCapture(e.pointerId) } catch { /* the swipe still works without it */ }
      setTop(Math.max(0, -(viewport.current?.getBoundingClientRect().top ?? 0)))
      setEngaged(true)
    }
    const dt = e.timeStamp - t.lastT
    if (dt > 0) t.v = (e.clientX - t.lastX) / dt
    t.lastX = e.clientX
    t.lastT = e.timeStamp
    const blocked = (mx < 0 && !next) || (mx > 0 && !prev)
    setDx(blocked ? mx * 0.22 : Math.max(-t.width, Math.min(t.width, mx)))
  }

  function finish(e: PointerEvent<HTMLDivElement>) {
    const t = track.current
    if (!t || e.pointerId !== t.id) return
    track.current = null
    if (!t.drag) return
    const goNext = dx < 0
    const target = goNext ? next : prev
    const far = Math.abs(dx) > t.width * 0.28
    const fast = Math.abs(t.v) > 0.45 && (t.v < 0) === goNext
    const commit = Boolean(target) && (far || fast)
    const done = () => {
      settleTimer.current = null
      if (commit && target) {
        noAnim.current.add(target)
        window.scrollTo({ top: 0 })
        onChange(target)
      }
      setSettling(false)
      setEngaged(false)
      setDx(0)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return }
    setSettling(true)
    setDx(commit ? (goNext ? -t.width : t.width) : 0)
    settleTimer.current = window.setTimeout(done, SETTLE_MS + 40)
  }

  const pane = (id: T, style?: CSSProperties) => (
    <div key={id} className={id === current && !noAnim.current.has(id) ? 'screen-in' : undefined} style={style} aria-hidden={id === current ? undefined : true}>
      {render(id)}
    </div>
  )

  return (
    <div
      ref={viewport}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      style={{ touchAction: 'pan-y pinch-zoom', overflowX: 'clip', position: 'relative', minHeight: '60dvh' }}
    >
      <div
        style={{
          // No transform at rest: a transform would trap fixed sheets and menus inside the screen.
          transform: engaged ? `translate3d(${dx}px,0,0)` : undefined,
          transition: settling ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 0.8, 0.3, 1)` : 'none',
          willChange: engaged ? 'transform' : undefined,
        }}
      >
        {engaged && prev && pane(prev, { position: 'absolute', top, left: '-100%', width: '100%', pointerEvents: 'none' })}
        {pane(current)}
        {engaged && next && pane(next, { position: 'absolute', top, left: '100%', width: '100%', pointerEvents: 'none' })}
      </div>
    </div>
  )
}
