import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { NODE_H, NODE_W, type Person, type TreeLayout } from '../lib/tree'
import { rootlets, taperPath } from '../lib/roots'

type View = { x: number; y: number; k: number }
const MIN_K = 0.1
const MAX_K = 2.4
// Open at a size where names can be read. Only a small tree is shown whole.
const READABLE_K = 0.85
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
  litId,
  onSelect,
  onClear,
}: {
  layout: TreeLayout
  people: Map<string, Person>
  selectedId: string | null
  meId: string | null
  focus: { id: string; tick: number } | null
  // The person whose line of descent is lit; everyone else is dimmed.
  litId: string | null
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  // True only while the view glides to a new place (Me, Fit, search). Dragging and pinching stay instant.
  const [gliding, setGliding] = useState(false)
  const glideTimer = useRef<number | undefined>(undefined)
  const glide = useCallback((next: View) => {
    setGliding(true)
    setView(next)
    window.clearTimeout(glideTimer.current)
    glideTimer.current = window.setTimeout(() => setGliding(false), 520)
  }, [])
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

  // Who is in the lit person's line: ancestors, descendants and partners. Read from the drawn stems.
  const kin = useMemo(() => {
    if (!litId) return null
    const up = new Map<string, string[]>()
    const down = new Map<string, string[]>()
    const mates = new Map<string, string[]>()
    const add = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v])
    for (const e of layout.edges) {
      if (e.kind === 'parent') {
        for (const parent of e.parents ?? []) for (const kid of e.kids ?? []) {
          add(down, parent, kid)
          add(up, kid, parent)
        }
      } else if (e.kind === 'partner' && e.parents) {
        add(mates, e.parents[0], e.parents[1])
        add(mates, e.parents[1], e.parents[0])
      }
    }
    const out = new Set<string>([litId])
    const walk = (start: string, map: Map<string, string[]>) => {
      const todo = [start]
      while (todo.length) {
        const id = todo.pop() as string
        for (const next of map.get(id) ?? []) if (!out.has(next)) { out.add(next); todo.push(next) }
      }
    }
    walk(litId, up)
    walk(litId, down)
    for (const m of mates.get(litId) ?? []) out.add(m)
    return out
  }, [layout, litId])

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
      glide({ k, x: size.w / 2 - c.x * k, y: size.h / 2 - c.y * k })
      return true
    },
    [nodeCenter, size.w, size.h, glide],
  )

  // The whole tree on screen at once.
  const fit = useCallback(() => {
    if (size.w === 0 || layout.width === 0) return
    const k = clamp(Math.min(size.w / layout.width, size.h / layout.height), MIN_K, 1)
    glide({ k, x: (size.w - layout.width * k) / 2, y: Math.max(8, (size.h - layout.height * k) / 2) })
  }, [size.w, size.h, layout.width, layout.height, glide])

  // First view: a small tree is shown whole; a bigger one opens on you (or the oldest couple) at a readable size.
  useEffect(() => {
    if (started.current || size.w === 0 || layout.nodes.length === 0) return
    started.current = true
    const whole = Math.min(size.w / layout.width, size.h / layout.height)
    if (whole >= 0.6) fit()
    else centerOn(((meId && layout.nodes.find((n) => n.id === meId)) || layout.nodes[0]).id, READABLE_K)
    // The opening view appears in place; only later moves glide.
    window.clearTimeout(glideTimer.current)
    setGliding(false)
  }, [size.w, layout, fit, centerOn, meId])

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
    window.clearTimeout(glideTimer.current)
    setGliding(false)
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
      else onClear()
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

  // The drawing itself. It is built once per change of people, selection or lit line, not on every drag
  // frame, so panning and pinching only move the picture and stay smooth.
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const scene = useMemo(
    () => (
      <>
    {(() => {
      const dimmed = (e: (typeof layout.edges)[number]) => {
        if (!kin) return false
        if (e.kind === 'tip') return !kin.has(e.person ?? '')
        if (e.kind === 'partner') return !((e.parents ?? []).every((id) => kin.has(id)) && (litId ? (e.parents ?? []).includes(litId) : false))
        return !((e.parents ?? []).some((id) => kin.has(id)) && (e.kids ?? []).some((id) => kin.has(id)))
      }
      const roots = layout.edges
        .filter((e) => e.segs)
        .map((e) => ({
          e,
          dim: dimmed(e),
          parts: (e.segs ?? []).map((seg, i) => ({ seg, hairs: e.kind === 'parent' ? rootlets(seg, `${e.id}:${i}`) : [] })),
        }))
      const partners = layout.edges.filter((e) => e.kind === 'partner')
      return (
        <g pointerEvents="none">
          <g className="root-aura">
            {roots.map(({ e, dim, parts }) => (
              <g key={e.id} className={dim ? 'root-dim' : 'root-lit'}>
                {parts.map(({ seg }, i) => <path key={i} d={taperPath(seg.d, seg.w0 * 2.6 + 6, seg.w1 * 2.6 + 4)} />)}
              </g>
            ))}
          </g>
          <g className="root-body">
            {roots.map(({ e, dim, parts }) => (
              <g key={e.id} className={`${e.kind === 'tip' ? 'root-tip ' : ''}${dim ? 'root-dim' : 'root-lit'}`}>
                {parts.map(({ seg, hairs }, i) => (
                  <g key={i}>
                    <path d={taperPath(seg.d, seg.w0, seg.w1)} />
                    {hairs.map((h, j) => <path key={j} d={taperPath(h.d, h.w0, h.w1)} />)}
                  </g>
                ))}
              </g>
            ))}
          </g>
          <g className="root-core">
            {roots.map(({ e, dim, parts }) => (
              <g key={e.id} className={dim ? 'root-dim' : 'root-lit'}>
                {parts.map(({ seg }, i) => <path key={i} d={taperPath(seg.d, seg.w0 * 0.3, Math.max(0.5, seg.w1 * 0.3))} />)}
              </g>
            ))}
          </g>
          {partners.map((e) => <path key={e.id} d={e.d} className={`root-partner ${dimmed(e) ? 'root-dim' : ''}`} />)}
        </g>
      )
    })()}
    {layout.nodes.map((n) => {
      const p = people.get(n.id)
      if (!p) return null
      const year = p.birth_date ? p.birth_date.slice(0, 4) : ''
      const classes = ['tnode-rect']
      if (n.id === meId) classes.push('tnode-me')
      if (n.id === selectedId || n.id === litId) classes.push('tnode-sel')
      if (p.is_deceased) classes.push('tnode-gone')
      const dim = kin ? !kin.has(n.id) : false
      return (
        <g
          key={n.id}
          data-pid={n.id}
          className={`tnode ${dim ? 'tnode-dim' : ''}`}
          transform={`translate(${n.x} ${n.y})`}
          tabIndex={0}
          role="button"
          aria-label={`${p.full_name}${n.id === meId ? ' (you)' : ''}${p.is_deceased ? ', passed away' : ''}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              selectRef.current(n.id)
            }
          }}
        >
          <rect className={classes.join(' ')} width={NODE_W} height={NODE_H} />
          <text x={NODE_W / 2} y={p.nickname ? 30 : 36} textAnchor="middle" className="fill-ink" fontSize="15" fontWeight="700">{clip(p.full_name, 13)}</text>
          {p.nickname && <text x={NODE_W / 2} y={50} textAnchor="middle" className="fill-muted" fontSize="13">{`“${clip(p.nickname, 14)}”`}</text>}
          <text x={NODE_W / 2} y={p.nickname ? 69 : 60} textAnchor="middle" className="fill-muted" fontSize="12.5">
            {n.id === meId ? (year ? `You · ${year}` : 'You') : p.is_deceased ? (year ? `† b. ${year}` : '†') : year ? `b. ${year}` : ''}
          </text>
        </g>
      )
    })}
      </>
    ),
    [layout, people, kin, litId, selectedId, meId],
  )

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
    <div className="relative h-full w-full">
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
        className="family-tree-stage h-full w-full touch-none select-none overflow-hidden"
      >
        <svg
          width={layout.width}
          height={layout.height}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: '0 0',
            transition: gliding ? 'transform 0.45s cubic-bezier(.2,.8,.2,1)' : 'none',
            willChange: 'transform',
            overflow: 'visible',
            display: 'block',
          }}
        >
          {scene}
        </svg>
      </div>

      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 flex flex-col gap-2">
        {centerButton('+', () => zoomAt(size.w / 2, size.h / 2, 1.25))}
        {centerButton('−', () => zoomAt(size.w / 2, size.h / 2, 1 / 1.25))}
        {centerButton('Fit', fit)}
        {meId && centerButton('Me', () => centerOn(meId, Math.max(view.k, READABLE_K)))}
      </div>
    </div>
  )
}
