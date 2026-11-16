import { useEffect, useMemo, useState } from 'react'
import type { Place } from '../lib/places'

// What the map shows with no internet: a still picture of where the saved places sit, drawn from the saved list.
// The real map needs the internet for its pictures, so tapping this says so instead of opening it.
const W = 320
const H = 224

export default function OfflineMapPicture({ places }: { places: Place[] }) {
  const [hint, setHint] = useState(false)
  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(false), 3000)
    return () => window.clearTimeout(t)
  }, [hint])
  const pins = useMemo(() => {
    if (places.length === 0) return []
    const lats = places.map((p) => p.lat)
    const lngs = places.map((p) => p.lng)
    const s = Math.min(...lats), n = Math.max(...lats), w = Math.min(...lngs), e = Math.max(...lngs)
    const spanY = n - s || 1, spanX = e - w || 1
    return places.map((p) => ({
      id: p.id,
      x: 36 + (n === s && e === w ? 0.5 : (p.lng - w) / spanX) * (W - 72),
      y: 32 + (n === s && e === w ? 0.5 : 1 - (p.lat - s) / spanY) * (H - 64),
      square: p.kind === 'restaurant',
      been: p.status === 'been',
    }))
  }, [places])

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-56 w-full" role="img" aria-label="Still picture of where your saved places are" preserveAspectRatio="xMidYMid slice">
        <rect width={W} height={H} fill="color-mix(in srgb, var(--accent) 7%, var(--surface))" />
        {[1, 2, 3, 4, 5].map((i) => <line key={'v' + i} x1={(W / 6) * i} y1="0" x2={(W / 6) * i} y2={H} stroke="var(--line)" strokeWidth="1" />)}
        {[1, 2, 3].map((i) => <line key={'h' + i} x1="0" y1={(H / 4) * i} x2={W} y2={(H / 4) * i} stroke="var(--line)" strokeWidth="1" />)}
        <path d={`M0 ${H * 0.7} C ${W * 0.3} ${H * 0.5}, ${W * 0.6} ${H * 0.9}, ${W} ${H * 0.55}`} fill="none" stroke="var(--line)" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
        {pins.map((p) =>
          p.square ? (
            <rect key={p.id} x={p.x - 6} y={p.y - 6} width="12" height="12" rx="2.5" fill={p.been ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" strokeWidth="2" />
          ) : (
            <circle key={p.id} cx={p.x} cy={p.y} r="6.5" fill={p.been ? 'var(--accent)' : 'var(--surface)'} stroke="var(--accent)" strokeWidth="2" />
          ),
        )}
      </svg>
      <button type="button" className="absolute inset-0 z-10" aria-label="Enlarge the map" onClick={() => setHint(true)} />
      {hint && (
        <p role="status" className="pointer-events-none absolute inset-x-6 top-1/2 z-20 -translate-y-1/2 rounded-2xl bg-surface px-4 py-3 text-center text-sm font-bold ring-1 ring-[var(--line)]">
          You need an internet connection to view this.
        </p>
      )}
      <span className="pointer-events-none absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-bold ring-1 ring-[var(--line)]">
        Enlarge
      </span>
    </div>
  )
}
