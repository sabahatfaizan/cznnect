import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { NODE_H, NODE_W, type Person, type TreeLayout } from '../lib/tree'
import { rootlets, taperPath } from '../lib/roots'

type View = { x: number; y: number; k: number }
const MIN_K = 0.1
const MAX_K = 2.4
// Open at a size where names can be read. Only a small tree is shown whole.
const READABLE_K = 0.85
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

type Measure = (text: string, px: number, weight?: number) => number

// How much room names get, per theme. The box is the same size everywhere, but each theme draws it with a
// different border and font, so the usable width and the largest and smallest type size differ.
const NAME_FIT: Record<string, { w: number; base: number; min: number }> = {
  light: { w: 118, base: 15, min: 11.5 },
  dark: { w: 118, base: 15, min: 11.5 },
  glass: { w: 118, base: 15, min: 11.5 },
  rdr2: { w: 116, base: 15, min: 11.5 },
  uncharted: { w: 114, base: 14.5, min: 11 },
}

// Longest start of the text that fits, ending in an ellipsis when something was cut.
function clipToWidth(measure: Measure, text: string, px: number, maxW: number, weight = 400): string {
  if (measure(text, px, weight) <= maxW) return text
  const chars = Array.from(text)
  for (let n = chars.length - 1; n > 0; n--) {
    const cut = chars.slice(0, n).join('').trimEnd() + '…'
    if (measure(cut, px, weight) <= maxW) return cut
  }
  return '…'
}

// One line of text: shrink it until it fits, and cut it only if the smallest size still does not.
function fitLine(measure: Measure, text: string, maxW: number, base: number, min: number, weight = 400): { text: string; size: number } {
  for (let s = base; s >= min; s -= 0.5) if (measure(text, s, weight) <= maxW) return { text, size: s }
  return { text: clipToWidth(measure, text, min, maxW, weight), size: min }
}

// A person's name: one line if it fits at a readable size, otherwise two balanced lines, and only then cut.
function fitName(measure: Measure, text: string, maxW: number, base: number, min: number): { lines: string[]; size: number } {
  const name = text.trim()
  for (let s = base; s >= min; s -= 0.5) if (measure(name, s, 700) <= maxW) return { lines: [name], size: s }
  const words = name.split(/\s+/)
  const split = (s: number): { lines: string[]; width: number } | null => {
    if (words.length < 2) return null
    let best: string[] | null = null
    let bestW = Infinity
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ')
      const b = words.slice(i).join(' ')
      const w = Math.max(measure(a, s, 700), measure(b, s, 700))
      if (w < bestW) { bestW = w; best = [a, b] }
    }
    return best ? { lines: best, width: bestW } : null
  }
  for (let s = Math.min(base - 1.5, 13.5); s >= min; s -= 0.5) {
    const two = split(s)
    if (two && two.width <= maxW) return { lines: two.lines, size: s }
  }
  // Still too long: two lines at the smallest size, each cut if it must be.
  const two = split(min)
  if (two) return { lines: two.lines.map((l) => clipToWidth(measure, l, min, maxW, 700)), size: min }
  // One very long word: fill the first line, then the rest on the second.
  const chars = Array.from(name)
  let n = chars.length
  while (n > 1 && measure(chars.slice(0, n).join(''), min, 700) > maxW) n--
  return { lines: [chars.slice(0, n).join(''), clipToWidth(measure, chars.slice(n).join(''), min, maxW, 700)].filter(Boolean), size: min }
}

// Follows the app theme so the boxes refit when it changes.
function useThemeId(): string {
  const [id, setId] = useState(() => document.documentElement.dataset.theme ?? 'light')
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setId(el.dataset.theme ?? 'light'))
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return id
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
  const drawing = useRef<SVGSVGElement>(null)
  const settle = useRef<number | undefined>(undefined)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const theme = useThemeId()
  const [fontTick, setFontTick] = useState(0)
  // Names are measured with the font the theme really draws them in; refit once web fonts have loaded.
  useEffect(() => {
    let live = true
    void document.fonts?.ready.then(() => { if (live) setFontTick((n) => n + 1) })
    return () => { live = false }
  }, [theme])
  const nameBox = NAME_FIT[theme] ?? NAME_FIT.light
  const measure = useMemo<Measure>(() => {
    const ctx = document.createElement('canvas').getContext('2d')
    const family = box.current ? getComputedStyle(box.current).fontFamily : 'system-ui, sans-serif'
    const cache = new Map<string, number>()
    return (text, px, weight = 400) => {
      if (!ctx) return Array.from(text).length * px * 0.6
      const key = `${weight}|${px}|${text}`
      let w = cache.get(key)
      if (w === undefined) {
        ctx.font = `${weight} ${px}px ${family}`
        w = ctx.measureText(text).width
        cache.set(key, w)
      }
      return w
    }
    // fontTick and theme are the reasons to measure again: the font behind `family` may have changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, fontTick])
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

  // The picture is lifted onto its own layer while it moves, so pan and pinch stay smooth, and let go a moment
  // after it stops, so the browser redraws it sharp at the new zoom instead of leaving it blurry.
  useEffect(() => {
    const el = drawing.current
    if (!el) return
    el.style.willChange = 'transform'
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => { el.style.willChange = 'auto' }, gliding ? 700 : 260)
    // Only the view matters here; whether it glides just sets how long to wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])
  useEffect(() => () => window.clearTimeout(settle.current), [])

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
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current.dist = 0
  }

  // A tap is handled on the click, not on pointerup. Opening the card on pointerup put its backdrop under the
  // finger just before the click arrived, and that click closed the card again straight away.
  function onClick(e: MouseEvent<HTMLDivElement>) {
    if (gesture.current.moved) return
    const hit = document.elementFromPoint(e.clientX, e.clientY)
    const id = hit?.closest('[data-pid]')?.getAttribute('data-pid')
    if (id) onSelect(id)
    else onClear()
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
      // Name, nickname and year share an 80-high box: a two-line name moves everything up and shrinks the year.
      const nameFit = fitName(measure, p.full_name, nameBox.w, nameBox.base, nameBox.min)
      const nick = p.nickname ? fitLine(measure, `“${p.nickname}”`, nameBox.w, 13, 10.5) : null
      const two = nameFit.lines.length > 1
      const names = {
        lines: nameFit.lines,
        size: nameFit.size,
        y: two ? (nick ? [24, 39] : [28, 44]) : [nick ? 30 : 36],
        nickY: two ? 55 : 50,
        yearY: two ? (nick ? 71 : 66) : nick ? 69 : 60,
        yearSize: two ? 11.5 : 12.5,
      }
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
          {theme === 'rdr2' ? (
            <path className="tnode-shadow" transform="translate(0 3)" pointerEvents="none" d="M10 0 H122 L132 11 V69 L122 80 H10 L0 69 V11 Z" />
          ) : theme === 'uncharted' ? (
            <path className="tnode-shadow" transform="translate(0 3)" pointerEvents="none" d="M0 15 L15 0 H117 L132 15 V65 L117 80 H15 L0 65 Z" />
          ) : null}
          {theme === 'rdr2' ? (
            <path className={classes.join(' ')} d="M10 0 H122 L132 11 V69 L122 80 H10 L0 69 V11 Z" />
          ) : theme === 'uncharted' ? (
            <path className={classes.join(' ')} d="M0 15 L15 0 H117 L132 15 V65 L117 80 H15 L0 65 Z" />
          ) : (
            <rect className={classes.join(' ')} width={NODE_W} height={NODE_H} />
          )}
          {theme === 'rdr2' && (
            <g className="tnode-ornament" pointerEvents="none">
              <path d="M8 17 V11 L14 5 H118 L124 11 V17 M8 63 V69 L14 75 H118 L124 69 V63" />
              <path d="M61 5 L66 10 L71 5 M61 75 L66 70 L71 75" />
            </g>
          )}
          {theme === 'uncharted' && (
            <g className="tnode-ornament" pointerEvents="none">
              <path d="M7 18 L18 7 H114 L125 18 V62 L114 73 H18 L7 62 Z" />
              <path d="M66 4 l3 5 -3 5 -3 -5 Z" />
            </g>
          )}
          {names.lines.map((line, i) => (
            <text key={i} x={NODE_W / 2} y={names.y[i]} textAnchor="middle" className="fill-ink" fontSize={names.size} fontWeight="700">{line}</text>
          ))}
          {nick && <text x={NODE_W / 2} y={names.nickY} textAnchor="middle" className="fill-muted" fontSize={nick.size}>{nick.text}</text>}
          <text x={NODE_W / 2} y={names.yearY} textAnchor="middle" className="fill-muted" fontSize={names.yearSize}>
            {n.id === meId ? (year ? `You · ${year}` : 'You') : p.is_deceased ? (year ? `† b. ${year}` : '†') : year ? `b. ${year}` : ''}
          </text>
        </g>
      )
    })}
      </>
    ),
    [layout, people, kin, litId, selectedId, meId, measure, nameBox],
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
        onClick={onClick}
        onKeyDown={onKeyDown}
        className="family-tree-stage h-full w-full touch-none select-none overflow-hidden"
      >
        <svg
          ref={drawing}
          width={layout.width}
          height={layout.height}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: '0 0',
            transition: gliding ? 'transform 0.45s cubic-bezier(.2,.8,.2,1)' : 'none',
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
