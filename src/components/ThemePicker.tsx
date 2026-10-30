import { THEMES } from '../themes/catalog'
import type { ExclusiveTheme, ThemePref } from '../theme'

// The theme cards in Settings. Exclusive themes only appear once unlocked, Liquid Glass only for the owner.
export default function ThemePicker({
  theme,
  unlocked,
  isOwner,
  fresh,
  onPick,
}: {
  theme: ThemePref
  unlocked: ExclusiveTheme[]
  isOwner: boolean
  fresh: ExclusiveTheme | null
  onPick: (id: ThemePref) => void
}) {
  const visible = THEMES.filter((t) => {
    if (t.id === 'glass') return isOwner
    if (t.id === 'rdr2' || t.id === 'uncharted' || t.id === 'moonknight' || t.id === 'moonpaper') return unlocked.includes(t.id)
    return true
  })

  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {visible.map((t, i) => {
        const p = t.preview
        const on = theme === t.id
        return (
          <div key={t.id} style={{ ['--i' as string]: i }} className={`theme-card ${on ? 'theme-card-on' : ''}`}>
            <div className="p-2" style={{ background: p.page, color: p.ink }}>
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className="truncate text-xs font-bold">{t.label}</span>
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: p.accent }} />
              </div>
              <div className="rounded-lg border p-2" style={{ background: p.surface, borderColor: p.border }}>
                <div className="mb-2 h-1.5 w-2/3 rounded-full" style={{ background: p.ink, opacity: 0.8 }} />
                <div className="mb-2 h-1 w-1/2 rounded-full" style={{ background: p.muted, opacity: 0.85 }} />
                <div className="flex items-center gap-1">
                  <span className="h-4 flex-1 rounded-md" style={{ background: p.soft, border: `1px solid ${p.border}` }} />
                  <span className="h-4 w-8 rounded-md" style={{ background: p.accent }} />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 p-2">
              <div className="flex min-h-8 flex-col gap-1">
                {fresh === t.id ? (
                  <span className="theme-badge theme-badge-new">New</span>
                ) : (
                  t.badge && <span className="theme-badge">{t.badge}</span>
                )}
                <p className="text-xs text-muted">{t.hint}</p>
              </div>
              <button
                type="button"
                aria-pressed={on}
                className={`btn w-full !min-h-0 !px-2 !py-1.5 text-xs ${on ? 'btn-primary' : 'btn-plain'}`}
                onClick={() => onPick(t.id)}
              >
                {on ? 'Selected' : 'Use theme'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
