import { useMemo, useState, type CSSProperties } from 'react'
import { Icon } from './Icons'
import type { Achievement } from '../lib/irl'

const C = 2 * Math.PI * 28
const ratio = (a: Achievement) => (a.need > 0 ? a.have / a.need : 0)

type Fx = { id: string; n: number; kind: 'pop' | 'wiggle' }

// One medal: a progress ring around a glyph. Locked medals are grey with a lock; earned ones shine.
function Medal({ a, size, fx }: { a: Achievement; size: string; fx?: Fx | null }) {
  const pct = a.earned ? 1 : Math.min(1, ratio(a))
  const mine = fx && fx.id === a.id ? fx : null
  return (
    <span
      key={mine ? mine.n : 0}
      className={`ach-disc tier-${a.tier} ${a.earned ? 'ach-on' : ''} ${mine ? `ach-${mine.kind}` : ''}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="ach-track" cx="32" cy="32" r="28" />
        <circle className="ach-arc" cx="32" cy="32" r="28" transform="rotate(-90 32 32)" strokeDasharray={`${pct * C} ${C}`} />
      </svg>
      <span className="ach-face" style={{ fontSize: `calc(${size} * 0.38)` }} aria-hidden="true">{a.glyph}</span>
      {!a.earned && <span className="ach-lock" aria-hidden="true"><Icon name="lock" size={11} /></span>}
      {mine?.kind === 'pop' && (
        <span className="ach-sparks" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <span key={i} className="ach-spark" style={{ '--a': `${i * 36}deg` } as CSSProperties} />)}
        </span>
      )}
    </span>
  )
}

// The trophy case: a grid of medals; tap one to see what it takes and how close you are.
export default function AchievementCase({ items }: { items: Achievement[] }) {
  const earned = items.filter((a) => a.earned).length
  const nextUp = useMemo(() => [...items].filter((a) => !a.earned).sort((x, y) => ratio(y) - ratio(x))[0] ?? null, [items])
  const [sel, setSel] = useState<string | null>(null)
  const [fx, setFx] = useState<Fx | null>(null)
  const picked = items.find((a) => a.id === sel) ?? nextUp ?? items[0]
  if (!picked) return null

  const tap = (a: Achievement) => {
    setSel(a.id)
    setFx({ id: a.id, n: Date.now(), kind: a.earned ? 'pop' : 'wiggle' })
    if (a.earned) { try { navigator.vibrate?.(12) } catch { /* not supported */ } }
  }

  const numeric = /^\d+\/\d+$/.test(picked.progress)
  const left = Math.max(0, picked.need - picked.have)

  return (
    <section aria-label="Your achievements" className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="eyebrow">Your achievements</h2>
        <span className="ach-count">{earned} of {items.length}</span>
      </div>
      <div className="ach-total" aria-hidden="true"><span style={{ width: `${Math.round((earned / items.length) * 100)}%` }} /></div>

      <ul className="ach-grid">
        {items.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className="ach-medal"
              aria-pressed={picked.id === a.id}
              aria-label={`${a.title}, ${a.earned ? 'earned' : a.progress}`}
              onClick={() => tap(a)}
            >
              <Medal a={a} size="4.25rem" fx={fx} />
              <span className="ach-name">{a.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className={`ach-detail tier-${picked.tier}`} aria-live="polite">
        <Medal a={picked} size="3.5rem" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold leading-tight">{picked.title}</p>
          <p className="text-sm text-muted">{picked.hint}</p>
          {picked.earned ? (
            <p className="mt-1 flex items-center gap-1 text-sm font-bold text-accent-text"><Icon name="check" size={16} />Earned</p>
          ) : (
            <>
              <div className="ach-bar mt-2" aria-hidden="true"><span style={{ width: `${Math.round(ratio(picked) * 100)}%` }} /></div>
              <p className="mt-1 text-xs font-bold text-accent-text">{numeric ? `${picked.progress} · ${left} to go` : picked.progress}</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
