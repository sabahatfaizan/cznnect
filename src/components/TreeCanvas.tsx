import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { NODE_H, NODE_W, type Link, type Person, type TreeLayout } from '../lib/tree'

type View = { x: number; y: number; k: number }
const MIN_K = 0.3
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
  links,
  selectedId,
  meId,
  focus,
  onSelect,
}: {
  layout: TreeLayout
  people: Map<string, Person>
  links: Link[]
  selectedId: string | null
  meId: string | null
  focus: { id: string; tick: number } | null
  onSelect: (id: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [familyFocus, setFamilyFocus] = useState<string | null>(null)
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

  const fit = useCallback(() => {
    if (size.w === 0 || layout.width === 0) return
    const k = clamp(Math.min(size.w / layout.width, size.h / layout.height), MIN_K, 1)
    setView({ k, x: (size.w - layout.width * k) / 2, y: Math.max(8, (size.h - layout.height * k) / 2) })
  }, [size.w, size.h, layout.width, layout.height])

  // First view: on you if you are in the tree, otherwise the whole tree across the screen.
  useEffect(() => {
    if (started.current || size.w === 0 || layout.nodes.length === 0) return
    started.current = true
    const k = clamp(size.w / layout.width, 0.6, 1)
    if (meId && centerOn(meId, k)) return
    setView({ k, x: (size.w - layout.width * k) / 2, y: 12 })
  }, [size.w, layout, meId, centerOn])

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

  // Every person with descendants can open a family cluster. Partners and all
  // descendants are included; stored relationships are never edited here.
  const familyMembers = useMemo(() => {
    const children = new Map<string, string[]>()
    const partners = new Map<string, string[]>()
    for (const link of links) {
      const map = link.kind === 'parent' ? children : partners
      const key = link.kind === 'parent' ? link.a_id : link.a_id
      const value = link.b_id
      const list = map.get(key)
      if (list) list.push(value)
      else map.set(key, [value])
      if (link.kind === 'partner') {
        const reverse = partners.get(link.b_id)
        if (reverse) reverse.push(link.a_id)
        else partners.set(link.b_id, [link.a_id])
      }
    }
    const result = new Map<string, Set<string>>()
    for (const root of people.keys()) {
      const members = new Set<string>([root])
      const queue = [root]
      while (queue.length) {
        const id = queue.shift() as string
        for (const partner of partners.get(id) ?? []) {
          if (!members.has(partner)) {
            members.add(partner)
            queue.push(partner)
          }
        }
        for (const child of children.get(id) ?? []) {
          if (!members.has(child)) {
            members.add(child)
            queue.push(child)
          }
        }
      }
      result.set(root, members)
    }
    return result
  }, [links, people])

  const focusedMembers = familyFocus ? familyMembers.get(familyFocus) ?? new Set([familyFocus]) : null
  // Keep the tree compact: show the oldest generation and their children/partners.
  // A glossy bubble on a second-generation person reveals that person's descendants.
  const visibleIds = useMemo(() => {
    const expanded = familyFocus ? familyMembers.get(familyFocus) ?? new Set([familyFocus]) : null
    return new Set(layout.nodes.filter((node) => node.gen <= 1 || (expanded?.has(node.id) ?? false)).map((node) => node.id))
  }, [layout.nodes, familyFocus, familyMembers])
  const focusNodes = focusedMembers
    ? layout.nodes.filter((node) => focusedMembers.has(node.id) && visibleIds.has(node.id))
    : []
  const focusBounds = focusNodes.length ? {
    x: Math.min(...focusNodes.map((node) => node.x)) - 30,
    y: Math.min(...focusNodes.map((node) => node.y)) - 42,
    w: Math.max(...focusNodes.map((node) => node.x + NODE_W)) - Math.min(...focusNodes.map((node) => node.x)) + 60,
    h: Math.max(...focusNodes.map((node) => node.y + NODE_H)) - Math.min(...focusNodes.map((node) => node.y)) + 84,
  } : null

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
      const branch = hit?.closest('[data-branch-id]')?.getAttribute('data-branch-id')
      if (branch) {
        setFamilyFocus((current) => current === branch ? null : branch)
        const center = nodeCenter(branch)
        if (center) centerOn(branch, Math.max(view.k, 0.9))
        return
      }

      // While a family is focused, tapping anywhere outside its highlighted
      // sphere/bounds exits focus. Taps inside the family still select people.
      if (familyFocus && focusBounds) {
        const rect = box.current?.getBoundingClientRect()
        if (rect) {
          const worldX = (e.clientX - rect.left - view.x) / view.k
          const worldY = (e.clientY - rect.top - view.y) / view.k
          const outside = worldX < focusBounds.x || worldX > focusBounds.x + focusBounds.w ||
            worldY < focusBounds.y || worldY > focusBounds.y + focusBounds.h
          if (outside) {
            setFamilyFocus(null)
            return
          }
        }
      }

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
        aria-label="Family tree. Tap a glossy bubble to reveal that branch. Drag to move and pinch to zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="h-[60dvh] min-h-[22rem] w-full touch-none select-none overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface"
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
          {focusBounds && (
            <g pointerEvents="none">
              <rect
                x={focusBounds.x}
                y={focusBounds.y}
                width={focusBounds.w}
                height={focusBounds.h}
                rx={28}
                fill="var(--accent)"
                fillOpacity={0.055}
                stroke="var(--accent)"
                strokeOpacity={0.65}
                strokeWidth={2}
                strokeDasharray="7 5"
              />
              <text x={focusBounds.x + 16} y={focusBounds.y + 23} fill="var(--accent-text)" fontSize={13} fontWeight={700}>
                FAMILY FOCUS
              </text>
            </g>
          )}
          {layout.edges.filter((e) => {
            if (e.id.startsWith('stem:')) {
              const [, , childIds = ''] = e.id.split(':')
              return childIds.split(',').some((id) => visibleIds.has(id))
            }
            const link = links.find((item) => item.id === e.id)
            return !link || (visibleIds.has(link.a_id) && visibleIds.has(link.b_id))
          }).map((e) => (
            <path
              key={e.id}
              d={e.d}
              className={e.kind === 'partner' ? 'fill-none stroke-accent' : 'fill-none stroke-muted'}
              strokeWidth={e.kind === 'partner' ? 3 : 1.5}
              strokeOpacity={familyFocus ? 0.22 : e.kind === 'partner' ? 0.7 : 0.55}
              style={{ filter: familyFocus ? 'blur(0.6px)' : undefined }}
            />
          ))}
          {layout.nodes.filter((n) => visibleIds.has(n.id)).map((n) => {
            const p = people.get(n.id)
            if (!p) return null
            const sub = p.nickname ? `“${clip(p.nickname, 12)}”` : p.birth_date ? p.birth_date.slice(0, 4) : ''
            const overview = n.gen === 1
            const inFocus = !focusedMembers || focusedMembers.has(n.id)
            const scale = familyFocus ? (inFocus ? 1.08 : 0.72) : 1
            const transform = `translate(${n.x + NODE_W / 2} ${n.y + NODE_H / 2}) scale(${scale}) translate(${-NODE_W / 2} ${-NODE_H / 2})`
            const classes = ['tnode-rect']
            if (n.id === meId) classes.push('tnode-me')
            if (n.id === selectedId) classes.push('tnode-sel')
            if (p.is_deceased) classes.push('tnode-gone')
            return (
              <g
                key={n.id}
                data-pid={n.id}
                data-branch-id={overview && (familyMembers.get(n.id)?.size ?? 1) > 1 ? n.id : undefined}
                transform={transform}
                opacity={inFocus ? 1 : 0.18}
                style={{ filter: inFocus ? undefined : 'blur(1.4px)', transition: 'opacity 220ms ease, filter 220ms ease' }}
                tabIndex={0}
                role="button"
                aria-label={overview ? `Open ${p.full_name}'s family roots` : `${p.full_name}${n.id === meId ? ' (you)' : ''}${p.is_deceased ? ', passed away' : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (overview && (familyMembers.get(n.id)?.size ?? 1) > 1) setFamilyFocus((current) => current === n.id ? null : n.id)
                    else onSelect(n.id)
                  }
                }}
              >
                {overview ? (
                  <g>
                    <circle cx={NODE_W / 2} cy={NODE_H / 2} r={38} fill="var(--glass-regular, var(--surface))" stroke="var(--accent)" strokeOpacity={0.85} strokeWidth={1.6} style={{ filter: 'drop-shadow(0 5px 11px color-mix(in srgb, var(--accent) 26%, transparent))' }} />
                    <circle cx={NODE_W / 2 - 11} cy={NODE_H / 2 - 17} r={20} fill="white" fillOpacity={0.09} />
                    <text x={NODE_W / 2} y={NODE_H / 2 - 3} textAnchor="middle" className="fill-ink" fontSize="12" fontWeight="800">{clip(p.full_name, 10)}</text>
                    <text x={NODE_W / 2} y={NODE_H / 2 + 13} textAnchor="middle" className="fill-muted" fontSize="9">{(familyMembers.get(n.id)?.size ?? 1) - 1} family</text>
                  </g>
                ) : (
                  <>
                    <rect className={classes.join(' ')} width={NODE_W} height={NODE_H} />
                    <text x={NODE_W / 2} y={26} textAnchor="middle" className="fill-ink" fontSize="13" fontWeight="700">{clip(p.full_name, 15)}</text>
                    <text x={NODE_W / 2} y={44} textAnchor="middle" className="fill-muted" fontSize="11">{sub}</text>
                  </>
                )}
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
