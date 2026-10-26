import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { NODE_H, NODE_W, type Person, type TreeLayout } from '../lib/tree'
import { rootlets, taperPath } from '../lib/roots'

type View = { x: number; y: number; k: number }
const MIN_K = 0.1
const MAX_K = 2.2
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function clip(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : text
}

// The drawn tree. Drag to move, pinch or use the buttons to zoom, tap a person to open them.
export default function TreeCanvas({
  layout,
  people,
  selectedId,
  meId,
  focus,
  onSelect,
}: {
  layout: TreeLayout
  people: Map<string, Person>
  selectedId: string | null
  meId: string | null
  focus: { id: string; tick: number } | null
  onSelect: (id: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
    const started = useRef(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ moved: false, startX: 0, startY: 0, dist: 0 })

  // Keep track of the box size.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const nodeCenter = useCallback(
    (id: string) => {
      const n = layout.nodes.find((x) => x.id === id)
      return n ? { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 } : null
    },
    [layout],
  )

  const centerOn = useCallback(
    (id: string, k: number) => {
      const c = nodeCenter(id)
      if (!c || size.w === 0) return false
      setView({ k, x: size.w / 2 - c.x * k, y: size.h / 2 - c.y * k })
      return true
    },
    [nodeCenter, size.w, size.h],
  )

  // The whole tree on screen at once.
  const fit = useCallback(() => {
    if (size.w === 0 || layout.width === 0) return
    const k = clamp(Math.min(size.w / layout.width, size.h / layout.height), MIN_K, 1)
    setView({ k, x: (size.w - layout.width * k) / 2, y: Math.max(8, (size.h - layout.height * k) / 2) })
  }, [size.w, size.h, layout.width, layout.height])

  // First view: the full tree.
  useEffect(() => {
    if (started.current || size.w === 0 || layout.nodes.length === 0) return
    started.current = true
    fit()
  }, [size.w, layout, fit])

  // Jump to someone chosen from the search box.
  useEffect(() => {
    if (focus) centerOn(focus.id, Math.max(view.k, 0.9))
    // Only when a new jump is asked for, not on every pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.tick])

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K)
      const f = k / v.k
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f }
    })
  }, [])

  // Mouse wheel zoom. Added by hand so the page does not scroll at the same time.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const pinchDistance = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      gesture.current = { moved: false, startX: e.clientX, startY: e.clientY, dist: 0 }
    } else if (pointers.current.size === 2) {
      gesture.current.moved = true
      gesture.current.dist = pinchDistance()
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const last = pointers.current.get(e.pointerId)
    if (!last) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (pointers.current.size === 1) {
      if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 6) g.moved = true
      if (g.moved) {
        const dx = e.clientX - last.x
        const dy = e.clientY - last.y
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
      }
    } else if (pointers.current.size === 2 && g.dist > 0) {
      const [a, b] = [...pointers.current.values()]
      const now = pinchDistance()
      const r = e.currentTarget.getBoundingClientRect()
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, now / g.dist)
      g.dist = now
    }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const wasOne = pointers.current.size === 1
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current.dist = 0
    if (wasOne && !gesture.current.moved && e.type === 'pointerup') {
      // A tap, not a drag: find which person was under the finger.
      const hit = document.elementFromPoint(e.clientX, e.clientY)
      const id = hit?.closest('[data-pid]')?.getAttribute('data-pid')
      if (id) onSelect(id)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const step = 60
    const r = box.current?.getBoundingClientRect()
    const cx = r ? r.width / 2 : 0
    const cy = r ? r.height / 2 : 0
    if (e.key === 'ArrowLeft') setView((v) => ({ ...v, x: v.x + step }))
    else if (e.key === 'ArrowRight') setView((v) => ({ ...v, x: v.x - step }))
    else if (e.key === 'ArrowUp') setView((v) => ({ ...v, y: v.y + step }))
    else if (e.key === 'ArrowDown') setView((v) => ({ ...v, y: v.y - step }))
    else if (e.key === '+' || e.key === '=') zoomAt(cx, cy, 1.2)
    else if (e.key === '-') zoomAt(cx, cy, 1 / 1.2)
    else return
    e.preventDefault()
  }

  const centerButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-plain !min-h-11 !min-w-11 !px-3 shadow-[var(--shadow-card)]"
    >
      {label}
    </button>
  )

  return (
    <div className="relative">
      <div
        ref={box}
        tabIndex={0}
        role="group"
        aria-label="Family tree. Tap a person to see who they are. Drag to move and pinch to zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="family-tree-stage h-[72dvh] min-h-[26rem] w-full touch-none select-none overflow-hidden rounded-[var(--radius-card)] border border-line"
      >
        <svg
          width={layout.width}
          height={layout.height}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: '0 0',
            overflow: 'visible',
            display: 'block',
          }}
        >
          {(() => {
            const roots = layout.edges.filter((e) => e.segs)
            const partners = layout.edges.filter((e) => e.kind === 'partner')
            // Every root is a ribbon: wide where it leaves the parents, thin where it reaches the child.
            const parts = roots.flatMap((e) =>
              (e.segs ?? []).flatMap((seg, i) => [
                { seg, tip: e.kind === 'tip', hairs: e.kind === 'parent' ? rootlets(seg, `${e.id}:${i}`) : [] },
              ]),
            )
            return (
              <g pointerEvents="none">
                <g className="root-aura">
                  {parts.map(({ seg }, i) => <path key={i} d={taperPath(seg.d, seg.w0 * 2.6 + 6, seg.w1 * 2.6 + 4)} />)}
                </g>
                <g className="root-body">
                  {parts.map(({ seg, tip, hairs }, i) => (
                    <g key={i} className={tip ? 'root-tip' : undefined}>
                      <path d={taperPath(seg.d, seg.w0, seg.w1)} />
                      {hairs.map((h, j) => <path key={j} d={taperPath(h.d, h.w0, h.w1)} />)}
                    </g>
                  ))}
                </g>
                <g className="root-core">
                  {parts.map(({ seg }, i) => <path key={i} d={taperPath(seg.d, seg.w0 * 0.3, Math.max(0.5, seg.w1 * 0.3))} />)}
                </g>
                {partners.map((e) => <path key={e.id} d={e.d} className="root-partner" />)}
              </g>
            )
          })()}
          {layout.nodes.map((n) => {
            const p = people.get(n.id)
            if (!p) return null
            const sub = p.nickname ? `“${clip(p.nickname, 12)}”` : p.birth_date ? p.birth_date.slice(0, 4) : ''
            const classes = ['tnode-rect']
            if (n.id === meId) classes.push('tnode-me')
            if (n.id === selectedId) classes.push('tnode-sel')
            if (p.is_deceased) classes.push('tnode-gone')
            return (
              <g
                key={n.id}
                data-pid={n.id}
                transform={`translate(${n.x} ${n.y})`}
                tabIndex={0}
                role="button"
                aria-label={`${p.full_name}${n.id === meId ? ' (you)' : ''}${p.is_deceased ? ', passed away' : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(n.id)
                  }
                }}
              >
                <rect className={classes.join(' ')} width={NODE_W} height={NODE_H} />
                <text x={NODE_W / 2} y={26} textAnchor="middle" className="fill-ink" fontSize="13" fontWeight="700">{clip(p.full_name, 15)}</text>
                <text x={NODE_W / 2} y={44} textAnchor="middle" className="fill-muted" fontSize="11">{sub}</text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        {centerButton('+', () => zoomAt(size.w / 2, size.h / 2, 1.25))}
        {centerButton('−', () => zoomAt(size.w / 2, size.h / 2, 1 / 1.25))}
        {centerButton('Fit', fit)}
      </div>
    </div>
  )
}
