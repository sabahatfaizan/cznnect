import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { NODE_H, NODE_W, type Person, type TreeLayout } from '../lib/tree'
import { rootlets, taperPath } from '../lib/roots'
import { canopyFor } from '../lib/canopy'

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
  midnight: { w: 118, base: 15, min: 11.5 },
  dusk: { w: 118, base: 15, min: 11.5 },
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

type Orient = { lock?: (o: string) => Promise<void>; unlock?: () => void }
const orient = () => (typeof screen !== 'undefined' ? (screen.orientation as unknown as Orient | undefined) : undefined)

// The drawn tree. Drag to move, pinch or use the buttons to zoom, tap a person to open them.
export default function TreeCanvas({
  layout,
  people,
  selectedId,
  meId,
  focus,
  litId,
  title,
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
  // Written on the banner above the crown.
  title?: string
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const shell = useRef<HTMLDivElement>(null)
  // The crown, banner and trunk around the people, which widens with the widest generation.
  const deco = useMemo(() => canopyFor(layout), [layout])
  const frame = deco?.frame ?? { x: 0, y: 0, w: layout.width, h: layout.height }
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
    const k = clamp(Math.min(size.w / frame.w, size.h / frame.h), MIN_K, 1)
    glide({ k, x: (size.w - frame.w * k) / 2 - frame.x * k, y: Math.max(8, (size.h - frame.h * k) / 2) - frame.y * k })
  }, [size.w, size.h, layout.width, frame.x, frame.y, frame.w, frame.h, glide])

  // Landscape: the tree alone goes fullscreen and the phone is turned sideways (where the browser or app allows it).
  const canFlip = typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function'
  const [landscape, setLandscape] = useState(false)
  const flip = useCallback(async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return }
      await shell.current?.requestFullscreen()
      try { await orient()?.lock?.('landscape') } catch { /* needs the installed app on some browsers */ }
    } catch { /* fullscreen not allowed */ }
  }, [])
  useEffect(() => {
    let timer: number | undefined
    const onChange = () => {
      const on = document.fullscreenElement === shell.current
      setLandscape(on)
      if (!on) { try { orient()?.unlock?.() } catch { /* nothing locked */ } }
      window.clearTimeout(timer)
      timer = window.setTimeout(fit, 400)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => { document.removeEventListener('fullscreenchange', onChange); window.clearTimeout(timer) }
  }, [fit])

  // First view: a small tree is shown whole; a bigger one opens on you (or the oldest couple) at a readable size.
  useEffect(() => {
    if (started.current || size.w === 0 || layout.nodes.length === 0) return
    started.current = true
    const whole = Math.min(size.w / frame.w, size.h / frame.h)
    if (whole >= 0.6) fit()
    else centerOn(((meId && layout.nodes.find((n) => n.id === meId)) || layout.nodes[0]).id, READABLE_K)
    // The opening view appears in place; only later moves glide.
    window.clearTimeout(glideTimer.current)
    setGliding(false)
  }, [size.w, layout, frame.w, frame.h, fit, centerOn, meId])

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
    const fold = hit?.closest('[data-fold]')?.getAttribute('data-fold')
    if (fold) { toggleFold(fold); return }
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

  // Branches folded shut: the family's junction dot (or its +N badge) is tapped to fold or open the line below it.
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const tree = useMemo(() => {
    const down = new Map<string, string[]>()
    const mates = new Map<string, string[]>()
    const hasParent = new Set<string>()
    const add = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v])
    for (const e of layout.edges) {
      if (e.kind === 'parent') for (const p of e.parents ?? []) for (const k of e.kids ?? []) { add(down, p, k); hasParent.add(k) }
      else if (e.kind === 'partner' && e.parents) { add(mates, e.parents[0], e.parents[1]); add(mates, e.parents[1], e.parents[0]) }
    }
    return { down, mates, hasParent }
  }, [layout])
  const hidden = useMemo(() => {
    const out = new Set<string>()
    const counts = new Map<string, number>()
    for (const e of layout.edges) {
      if (e.kind !== 'parent' || !folded.has(e.id)) continue
      const mine = new Set<string>()
      const todo = [...(e.kids ?? [])]
      while (todo.length) {
        const id = todo.pop() as string
        if (mine.has(id)) continue
        mine.add(id)
        for (const k of tree.down.get(id) ?? []) todo.push(k)
        // Someone who married in goes with the branch they joined.
        for (const m of tree.mates.get(id) ?? []) if (!tree.hasParent.has(m)) todo.push(m)
      }
      for (const id of mine) out.add(id)
      counts.set(e.id, mine.size)
    }
    return { out, counts }
  }, [layout, folded, tree])
  const toggleFold = useCallback((id: string) => setFolded((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n }), [])
  // Fold every family below the first generation, or open everything again.
  const foldAll = useCallback(() => {
    setFolded((f) => {
      if (f.size > 0) return new Set()
      const top = new Set(layout.nodes.filter((n) => n.gen === 0).map((n) => n.id))
      return new Set(layout.edges.filter((e) => e.kind === 'parent' && (e.parents ?? []).some((p) => !top.has(p))).map((e) => e.id))
    })
  }, [layout])

  // The drawing itself. It is built once per change of people, selection or lit line, not on every drag
  // frame, so panning and pinching only move the picture and stay smooth.
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const scene = useMemo(
    () => (
      <>
    {deco && (
      <g pointerEvents="none" className="tree-crown">
        {deco.stars.map((st, i) => <circle key={`s${i}`} cx={st.x} cy={st.y} r={st.r} className="tree-star" style={{ animationDelay: `${st.delay}s` }} />)}
        <path d={deco.moon.path} className="tree-moon" />
        <path d={deco.trunk.ground} className="tree-ground" />
        {deco.trunk.roots.map((d, i) => <path key={`r${i}`} d={d} className="tree-root" />)}
        <path d={deco.trunk.body} className="tree-trunk" />
        {deco.trunk.bark.map((d, i) => <path key={`b${i}`} d={d} className="tree-bark" />)}
        <path d={deco.crown} className="tree-leaves" />
        {deco.branches.map((br, i) => <path key={`br${i}`} d={br.d} className="tree-branch" strokeWidth={br.w} />)}
        {deco.leaves.map((l, i) => (
          <path key={`l${i}`} d="M0 0C4 -7 15 -7 22 0C15 7 4 7 0 0Z" className="tree-leaf" opacity={l.dim ? 0.5 : 0.9} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.s})`} />
        ))}
        {deco.blossoms.map((f, i) => (
          <g key={`f${i}`} transform={`translate(${f.x} ${f.y}) scale(${f.s})`} className="tree-blossom">
            {[0, 72, 144, 216, 288].map((r) => <circle key={r} cx={0} cy={-5} r={4} transform={`rotate(${r})`} />)}
            <circle r={2.6} className="tree-blossom-eye" />
          </g>
        ))}
        {deco.flies.map((f, i) => (
          <circle key={`f${i}`} cx={f.x} cy={f.y} r={3} className="tree-fly" style={{ ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s` }} />
        ))}
        {deco.butterflies.map((bf, i) => (
          <g key={`bf${i}`} transform={`translate(${bf.x} ${bf.y}) scale(${bf.s})`}>
            <g className="tree-butterfly" style={{ animationDelay: `${bf.delay}s` }}>
              <path d="M0 0C-12 -16 -28 -8 -20 6C-15 14 -5 8 0 0Z M0 0C12 -16 28 -8 20 6C15 14 5 8 0 0Z" />
            </g>
          </g>
        ))}
        <rect x={deco.banner.x} y={deco.banner.y} width={deco.banner.w} height={deco.banner.h} rx={8} className="tree-banner" />
        <text x={deco.banner.tx} y={deco.banner.ty} textAnchor="middle" fontSize={22} fontWeight={700} className="tree-banner-text">{title || 'Family tree'}</text>
      </g>
    )}
    {(() => {
      const dimmed = (e: (typeof layout.edges)[number]) => {
        if (!kin) return false
        if (e.kind === 'partner') return !((e.parents ?? []).every((id) => kin.has(id)) && (litId ? (e.parents ?? []).includes(litId) : false))
        return !((e.parents ?? []).some((id) => kin.has(id)) && (e.kids ?? []).some((id) => kin.has(id)))
      }
      const at = new Map(layout.nodes.map((n) => [n.id, n]))
      const TOP = 17 // the pill sits in the middle of its 80-high box
      const BOTTOM = 63
      const cx = (id: string) => (at.get(id) as { x: number }).x + NODE_W / 2
      return (
        <g className="tree-lines">
          {layout.edges.filter((e) => e.kind === 'partner').map((e) => {
            const [pa, pb] = e.parents ?? []
            if (!pa || !pb || hidden.out.has(pa) || hidden.out.has(pb)) return null
            return <path key={e.id} d={e.d} className={`tree-tie ${dimmed(e) ? 'tree-dim' : ''}`} />
          })}
          {layout.edges.filter((e) => e.kind === 'parent').map((e) => {
            const parents = (e.parents ?? []).filter((id) => at.has(id))
            const kids = (e.kids ?? []).filter((id) => at.has(id))
            if (parents.length === 0 || kids.length === 0 || parents.some((id) => hidden.out.has(id))) return null
            // The tree rises: parents stand below their children, so lines leave the top of a parent and reach the bottom of a child.
            const py = Math.min(...parents.map((id) => (at.get(id) as { y: number }).y + TOP))
            const ky = Math.max(...kids.map((id) => (at.get(id) as { y: number }).y + BOTTOM))
            const jy = ky + (py - ky) * 0.5
            const mx = parents.reduce((sum, id) => sum + cx(id), 0) / parents.length
            const shut = folded.has(e.id)
            const xs = [...parents.map(cx), ...(shut ? [] : kids.map(cx))]
            let d = parents.map((id) => `M${cx(id)} ${(at.get(id) as { y: number }).y + TOP}V${jy}`).join('')
            d += `M${Math.min(...xs)} ${jy}H${Math.max(...xs)}`
            if (!shut) d += kids.map((id) => `M${cx(id)} ${jy}V${(at.get(id) as { y: number }).y + BOTTOM}`).join('')
            const n = hidden.counts.get(e.id) ?? 0
            return (
              <g key={e.id} className={dimmed(e) ? 'tree-dim' : ''}>
                <path d={d} className="tree-line" />
                <g data-fold={e.id} className="tree-fold" role="button" aria-label={shut ? `Show ${n} people above` : 'Fold this branch'}>
                  <circle cx={mx} cy={jy} r={22} fill="transparent" />
                  {shut ? (
                    <>
                      <rect x={mx - 22} y={jy - 11} width={44} height={22} rx={11} className="tree-fold-badge" />
                      <text x={mx} y={jy + 4.5} textAnchor="middle" fontSize={12} fontWeight={700} className="tree-fold-text">+{n}</text>
                    </>
                  ) : (
                    <circle cx={mx} cy={jy} r={5} className="tree-dot" />
                  )}
                </g>
              </g>
            )
          })}
        </g>
      )
    })()}
    {layout.nodes.filter((n) => !hidden.out.has(n.id)).map((n) => {
      const p = people.get(n.id)
      if (!p) return null
      const year = p.birth_date ? p.birth_date.slice(0, 4) : ''
      const classes = ['tnode-rect']
      if (n.id === meId) classes.push('tnode-me')
      if (n.id === selectedId || n.id === litId) classes.push('tnode-sel')
      if (p.is_deceased) classes.push('tnode-gone')
      const dim = kin ? !kin.has(n.id) : false
      // The tree grows upward: the oldest row (at the trunk) appears first, then each younger row above it.
      const order = n.gen * 130 + (n.x % 97) * 1.2
      const nameFit = fitName(measure, p.full_name, nameBox.w - 14, 15, 11.5)
      const two = nameFit.lines.length > 1
      const sub = [p.nickname ? `“${p.nickname}”` : '', n.id === meId ? (year ? `you · ${year}` : 'you') : year ? `b. ${year}` : ''].filter(Boolean).join(' · ')
      const subFit = sub ? fitLine(measure, sub, nameBox.w - 14, 11, 9) : null
      const h = (two ? 54 : 46) + (subFit && two ? 0 : 0)
      const top = (NODE_H - h) / 2
      const nameY = two ? [top + 19, top + 33] : [top + (subFit ? 20 : 28)]
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
          <g className="tnode-in" style={{ animationDelay: `${Math.round(order)}ms` }}>
          <rect className={classes.join(' ')} x={0} y={top} width={NODE_W} height={h} rx={h / 2} ry={h / 2} />
          {nameFit.lines.map((line, i) => (
            <text key={i} x={NODE_W / 2} y={nameY[i]} textAnchor="middle" className="tchip-name fill-ink" fontSize={nameFit.size}>{line}</text>
          ))}
          {subFit && <text x={NODE_W / 2} y={top + h - (two ? 9 : 10)} textAnchor="middle" className="fill-muted" fontSize={subFit.size}>{subFit.text}</text>}
          </g>
        </g>
      )
    })}
      </>
    ),
    [layout, people, kin, litId, selectedId, meId, measure, nameBox, deco, title, hidden, folded],
  )

  const centerButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-plain tree-ctl !min-h-11 !min-w-11 !px-3 shadow-[var(--shadow-card)]"
    >
      {label}
    </button>
  )

  return (
    <div ref={shell} className="relative h-full w-full">
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
        {canFlip && (
          <button
            type="button"
            onClick={() => void flip()}
            aria-pressed={landscape}
            aria-label={landscape ? 'Leave landscape view' : 'Landscape view'}
            className="btn btn-plain tree-ctl !min-h-11 !min-w-11 !px-3 shadow-[var(--shadow-card)]"
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {landscape ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <><rect x={3} y={7} width={18} height={11} rx={2} /><path d="M12 3v2M7 3.5l1 1.5M17 3.5l-1 1.5" /></>}
            </svg>
          </button>
        )}
        {centerButton('Fit', fit)}
        {layout.edges.some((e) => e.kind === 'parent') && centerButton(folded.size > 0 ? 'Open' : 'Fold', foldAll)}
        {meId && centerButton('Me', () => centerOn(meId, Math.max(view.k, READABLE_K)))}
      </div>
    </div>
  )
}
