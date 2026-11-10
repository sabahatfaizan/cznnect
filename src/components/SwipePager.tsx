import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ScreenVisible } from '../lib/screenVisible'

// WhatsApp-style tabs on a native horizontal scroller. The browser does the touch handling: the pages follow the
// finger, fling with natural momentum and snap one page at a time (scroll-snap), so nothing runs in JavaScript while
// the finger is down. Vertical scrolling stays with the page (the document), and anything that scrolls sideways on
// its own (maps, carousels, text fields) keeps working because the browser gives the gesture to the innermost scroller.
//
// - The tab only changes once the pager has come to rest, so there are no re-renders while you drag.
// - Tapping a tab in the bottom bar jumps there at once; swiping moves the bar's highlight along with the page.
// - Only the page on show is un-clipped; the others are cut to one screen so they never stretch the document.
// - Neighbouring pages are built shortly after load (and the rest a little later) so a swipe never lands on a blank page.
//   `data-pager` / `data-pager-index` let a fixed element inside a page (the Chat message bar) slide with its page.
const SETTLE_MS = 90
const NEAR_MS = 350
const REST_MS = 1800

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
  const idx = order.indexOf(current)
  // A screen that is not one of the pager's pages (Settings, Admin, …) is shown on its own.
  if (idx < 0) return <>{render(current)}</>
  return <Pager order={order} current={current} idx={idx} enabled={enabled} onChange={onChange} render={render} />
}

function Pager<T extends string>({
  order,
  current,
  idx,
  enabled,
  onChange,
  render,
}: {
  order: readonly T[]
  current: T
  idx: number
  enabled: boolean
  onChange: (id: T) => void
  render: (id: T) => ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const pages = useRef<(HTMLDivElement | null)[]>([])
  const cur = useRef({ idx, current, onChange })
  cur.current = { idx, current, onChange }
  const touching = useRef(false)
  const timer = useRef(0)
  const first = useRef(true)

  // Pages that have been built. The one on show first, its neighbours when idle, the rest a little later.
  const [built, setBuilt] = useState<Set<number>>(() => new Set([idx]))
  useEffect(() => {
    const add = (ids: number[]) => setBuilt((s) => (ids.every((i) => s.has(i)) ? s : new Set([...s, ...ids])))
    const near = window.setTimeout(() => add([idx - 1, idx + 1].filter((i) => i >= 0 && i < order.length)), NEAR_MS)
    const rest = window.setTimeout(() => add(order.map((_, i) => i)), REST_MS)
    return () => { window.clearTimeout(near); window.clearTimeout(rest) }
  }, [idx, order])
  // A page asked for by a tap or a swipe is built straight away.
  useEffect(() => { setBuilt((s) => (s.has(idx) ? s : new Set([...s, idx]))) }, [idx])

  // While another page is sliding in beside the one on show, it is drawn at the same height on screen as the page
  // the document is scrolled to, so it does not look blank. Written straight to the elements, not through React.
  const syncTops = useCallback(() => {
    const y = window.scrollY
    pages.current.forEach((el, i) => { if (el) el.style.top = i === cur.current.idx ? '' : `${y}px` })
  }, [])
  useEffect(() => {
    let raf = 0
    const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; syncTops() }) }
    window.addEventListener('scroll', on, { passive: true })
    return () => { window.removeEventListener('scroll', on); if (raf) cancelAnimationFrame(raf) }
  }, [syncTops])

  // A page beside the one on show cannot be tapped or focused until it has come to rest in front of you.
  useLayoutEffect(() => {
    pages.current.forEach((el, i) => { if (el) el.toggleAttribute('inert', i !== idx) })
  }, [idx, built])

  const width = () => box.current?.clientWidth || 1

  // The page on show changed: put the document back to the top and bring the pager to the matching page.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const left = idx * width()
    if (first.current) {
      first.current = false
      el.scrollLeft = left
      syncTops()
      return
    }
    window.scrollTo(0, 0)
    syncTops()
    // Moved by a tap on the bar, not by a swipe: jump there at once.
    if (Math.abs(el.scrollLeft - left) > 2) el.scrollLeft = left
  }, [idx, syncTops])

  const settle = useCallback(() => {
    const el = box.current
    if (!el || touching.current) return
    const w = width()
    const i = Math.max(0, Math.min(order.length - 1, Math.round(el.scrollLeft / w)))
    if (Math.abs(el.scrollLeft - i * w) > 2) return // still moving
    if (i !== cur.current.idx) cur.current.onChange(order[i])
  }, [order])

  useEffect(() => {
    const el = box.current
    if (!el) return
    // The bottom bar follows the page as it passes the halfway mark, so it moves in step with the swipe.
    let lit = -1
    const live = () => {
      const i = Math.max(0, Math.min(order.length - 1, Math.round(el.scrollLeft / width())))
      if (i === lit) return
      lit = i
      document.querySelectorAll<HTMLElement>('.app-nav [data-tab-id]').forEach((b) => {
        const on = b.dataset.tabId === order[i]
        b.classList.toggle('tab-active', on)
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current')
      })
    }
    const later = () => { live(); window.clearTimeout(timer.current); timer.current = window.setTimeout(settle, SETTLE_MS) }
    const down = () => { touching.current = true }
    const up = () => { touching.current = false; later() }
    el.addEventListener('scroll', later, { passive: true })
    el.addEventListener('scrollend', settle)
    el.addEventListener('touchstart', down, { passive: true })
    el.addEventListener('touchend', up, { passive: true })
    el.addEventListener('touchcancel', up, { passive: true })
    // Keep the page lined up when the width changes (turning the phone, split screen).
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (!touching.current) el.scrollLeft = cur.current.idx * width()
    })
    ro?.observe(el)
    return () => {
      window.clearTimeout(timer.current)
      el.removeEventListener('scroll', later)
      el.removeEventListener('scrollend', settle)
      el.removeEventListener('touchstart', down)
      el.removeEventListener('touchend', up)
      el.removeEventListener('touchcancel', up)
      ro?.disconnect()
    }
  }, [settle, order])

  return (
    <div
      ref={box}
      data-pager=""
      className="swipe-pager -mx-4"
      style={{ overflowX: enabled ? 'auto' : 'hidden' }}
    >
      {order.map((id, i) => {
        const shown = i === idx
        return (
          <div
            key={id}
            ref={(el) => { pages.current[i] = el }}
            data-pager-index={i}
            className={`swipe-page px-4 ${shown ? '' : 'swipe-page-off'}`}
            aria-hidden={shown ? undefined : true}
          >
            {built.has(i) ? <ScreenVisible.Provider value={shown}>{render(id)}</ScreenVisible.Provider> : null}
          </div>
        )
      })}
    </div>
  )
}
