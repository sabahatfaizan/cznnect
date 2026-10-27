import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Family } from '../types'
import { getThemePref, getUnlockedThemes, onThemeUnlocked, setThemePref, type ThemePref } from '../theme'
import { ICONS, ICON_GROUPS, getIconPref, renderIcon, setIconPref, type IconId } from '../appIcon'

const OWNER_EMAIL = 'faizanplayz11@gmail.com'

const THEMES: { id: ThemePref; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'Clean, bright, everyday use' },
  { id: 'dark', label: 'Dark', hint: 'Clean, comfortable low-light use' },
  { id: 'rdr2', label: 'Red Dead', hint: 'Outlaw frontier' },
  { id: 'uncharted', label: 'Uncharted', hint: 'Treasure-map adventure' },
  { id: 'glass', label: 'Liquid Glass', hint: 'Glass-inspired finish' },
]

export default function Settings({ family, userId, onFamilyChanged }: { family: Family; userId: string; onFamilyChanged: () => void }) {
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [unlockedThemes, setUnlockedThemes] = useState(() => getUnlockedThemes())
  const [icon, setIcon] = useState<IconId>(getIconPref())
  const previews = useMemo(() => ICONS.map((i) => ({ ...i, src: renderIcon(i.id, 120) })), [])
  const [email, setEmail] = useState('')
  const [isFamilyOwner, setIsFamilyOwner] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [familyName, setFamilyName] = useState(family.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => onThemeUnlocked(() => { setUnlockedThemes(getUnlockedThemes()); setTheme(getThemePref()) }), [])

  const availableIconGroups = ICON_GROUPS.filter((group) =>
    group === 'Classic' ||
    (group === 'Uncharted' && unlockedThemes.includes('uncharted')) ||
    (group === 'Red Dead' && unlockedThemes.includes('rdr2'))
  )
  const isIconAvailable = (id: IconId) => {
    const item = ICONS.find((candidate) => candidate.id === id)
    return Boolean(item && (item.group === 'Classic' || availableIconGroups.includes(item.group)))
  }

  useEffect(() => {
    if (!isIconAvailable(icon)) {
      setIconPref('ocean')
      setIcon('ocean')
    }
  }, [icon, unlockedThemes])

  useEffect(() => {
    supabase.from('family_members').select('role').eq('family_id', family.id).eq('user_id', userId).maybeSingle()
      .then(({ data }) => setIsFamilyOwner(data?.role === 'owner'))
  }, [family.id, userId])

  async function saveName() {
    setBusy(true); setError(''); setSaved(false)
    const { error } = await supabase.rpc('update_family_name', { fid: family.id, new_name: familyName })
    setBusy(false)
    if (error) { setError(error.message); return }
    setEditingName(false); setSaved(true); onFamilyChanged()
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  function pickTheme(id: ThemePref) {
    setThemePref(id)
    setTheme(id)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">Settings</h1>
      {isFamilyOwner && (
        <section className="card flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Family settings</h2>
            <p className="mt-1 text-sm text-muted">Only you, the owner, can change these.</p>
          </div>
          {editingName ? (
            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void saveName() }}>
              <label className="label" htmlFor="family-name-edit">Family name</label>
              <input id="family-name-edit" className="input" value={familyName} onChange={(e) => setFamilyName(e.target.value)} maxLength={60} required />
              <div className="flex gap-2">
                <button className="btn btn-primary" type="submit" disabled={busy || !familyName.trim()}>Save name</button>
                <button className="btn btn-plain" type="button" onClick={() => { setFamilyName(family.name); setEditingName(false); setError('') }}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted">Family name</p>
                <p className="truncate font-semibold">{family.name}</p>
              </div>
              <button className="btn btn-plain" type="button" onClick={() => { setFamilyName(family.name); setSaved(false); setEditingName(true) }}>Change</button>
            </div>
          )}
          {saved && <p className="text-sm font-bold text-accent-text">Name updated.</p>}
          {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
        </section>
      )}
      <details className="card expander" aria-label="Appearance themes">
        <summary>
          <span className="min-w-0">
            <span className="font-display block text-lg font-bold">Appearance</span>
            <span className="block text-sm text-muted">Choose your theme · {theme === 'rdr2' ? 'Red Dead' : theme === 'uncharted' ? 'Uncharted' : theme === 'glass' ? 'Liquid Glass' : theme === 'dark' ? 'Dark' : 'Light'}</span>
          </span>
          <span aria-hidden="true" className="expander-chevron">›</span>
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {THEMES.filter((t) => (t.id !== 'glass' || email.toLowerCase() === OWNER_EMAIL) && (t.id !== 'rdr2' || unlockedThemes.includes('rdr2')) && (t.id !== 'uncharted' || unlockedThemes.includes('uncharted'))).map((t) => {
            const preview = ({
              light: { page: '#f1f4f8', surface: '#ffffff', ink: '#172333', muted: '#657287', accent: '#2457d6', soft: '#e5edff', border: '#d9e0ea' },
              dark: { page: '#111318', surface: '#1b1e25', ink: '#edf0f5', muted: '#a0a7b4', accent: '#7ea7ff', soft: '#26334d', border: '#343945' },
              rdr2: { page: '#211710', surface: '#392719', ink: '#f6e7c9', muted: '#c3a987', accent: '#d49a4e', soft: '#4d3421', border: '#745034' },
              uncharted: { page: '#14251f', surface: '#203b31', ink: '#e9f3df', muted: '#a9c2aa', accent: '#d5b76a', soft: '#354b35', border: '#4c6850' },
              glass: { page: '#101b35', surface: 'rgba(116,151,213,.24)', ink: '#eaf1ff', muted: '#b6c8e8', accent: '#75b8ff', soft: 'rgba(117,184,255,.18)', border: 'rgba(205,225,255,.3)' },
            } as Record<string, { page: string; surface: string; ink: string; muted: string; accent: string; soft: string; border: string }>)[t.id]
            return (
              <div key={t.id} className={`overflow-hidden rounded-xl border ${theme === t.id ? 'border-accent ring-2 ring-accent/30' : 'border-line'}`}>
                <div className="p-2" style={{ background: preview.page, color: preview.ink }}>
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-bold">{t.label}</span>
                    <span className="h-2 w-2 flex-none rounded-full" style={{ background: preview.accent }} />
                  </div>
                  <div className="rounded-lg border p-2" style={{ background: preview.surface, borderColor: preview.border }}>
                    <div className="mb-2 h-1.5 w-2/3 rounded-full" style={{ background: preview.ink, opacity: 0.8 }} />
                    <div className="mb-2 h-1 w-1/2 rounded-full" style={{ background: preview.muted, opacity: 0.85 }} />
                    <div className="flex items-center gap-1">
                      <span className="h-4 flex-1 rounded-md" style={{ background: preview.soft, border: `1px solid ${preview.border}` }} />
                      <span className="h-4 w-8 rounded-md" style={{ background: preview.accent }} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-2">
                  <p className="min-h-8 text-xs text-muted">{t.hint}</p>
                  <button
                    type="button"
                    aria-pressed={theme === t.id}
                    className={`btn w-full !min-h-0 !px-2 !py-1.5 text-xs ${theme === t.id ? 'btn-primary' : 'btn-plain'}`}
                    onClick={() => pickTheme(t.id)}
                  >
                    {theme === t.id ? 'Selected' : 'Use theme'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </details>
      <details className="card expander" aria-label="Custom app icon">
        <summary>
          <span className="flex min-w-0 items-center gap-3">
            <img src={previews.find((p) => p.id === (isIconAvailable(icon) ? icon : 'ocean'))?.src} alt="" width={36} height={36} className="h-9 w-9 flex-none rounded-[22%]" />
            <span className="min-w-0">
              <span className="font-display block text-lg font-bold">Custom app icon</span>
              <span className="block text-sm text-muted">{ICONS.find((i) => i.id === (isIconAvailable(icon) ? icon : 'ocean'))?.label}</span>
            </span>
          </span>
          <span aria-hidden="true" className="expander-chevron">›</span>
        </summary>
        <div className="mt-3 flex flex-col gap-4" role="radiogroup" aria-label="App icon colour">
          {availableIconGroups.map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <h3 className="eyebrow">{group}</h3>
              <div className="grid grid-cols-3 gap-3">
                {previews.filter((v) => v.group === group).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={icon === v.id}
                    className={`icon-tile ${icon === v.id ? 'icon-tile-on' : ''}`}
                    onClick={() => { setIconPref(v.id); setIcon(v.id) }}
                  >
                    <img src={v.src} alt="" width={60} height={60} />
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-sm text-muted">
            It recolours the logo in the app and the icon for new Home Screen shortcuts. An icon already on your Home Screen
            keeps its look until you remove it and add Cznnect again.
          </p>
        </div>
      </details>
    </div>
  )
}
