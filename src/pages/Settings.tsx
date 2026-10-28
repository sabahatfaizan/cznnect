import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Family } from '../types'
import { getThemePref, getUnlockedThemes, onThemeUnlocked, onUnlocksChanged, setThemePref, type ExclusiveTheme, type ThemePref } from '../theme'
import { themeLabel } from '../themes/catalog'
import { ICONS, ICON_GROUPS, getIconPref, iconGroupAvailable, renderIcon, setIconPref, type IconId } from '../appIcon'
import { isOwnerEmail } from '../owner'
import ThemePicker from '../components/ThemePicker'
import RedeemCard from '../components/RedeemCard'

export default function Settings({ family, userId, onFamilyChanged }: { family: Family; userId: string; onFamilyChanged: () => void }) {
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [unlockedThemes, setUnlockedThemes] = useState(() => getUnlockedThemes())
  const [icon, setIcon] = useState<IconId>(getIconPref())
  const [fresh, setFresh] = useState<ExclusiveTheme | null>(null)
  const previews = useMemo(() => ICONS.map((i) => ({ ...i, src: renderIcon(i.id, 120) })), [])
  const [email, setEmail] = useState('')
  const [isFamilyOwner, setIsFamilyOwner] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [familyName, setFamilyName] = useState(family.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // Keep the theme list in step with unlocks from a code, the secret coin, or an owner re-lock.
  useEffect(() => onUnlocksChanged(() => { setUnlockedThemes(getUnlockedThemes()); setTheme(getThemePref()) }), [])
  useEffect(() => onThemeUnlocked(setFresh), [])

  const availableIconGroups = ICON_GROUPS.filter((group) => iconGroupAvailable(group, unlockedThemes))
  const isIconAvailable = (id: IconId) => {
    const item = ICONS.find((candidate) => candidate.id === id)
    return Boolean(item && availableIconGroups.includes(item.group))
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
      <RedeemCard isOwner={isOwnerEmail(email)} onRedeemed={(t) => { setTheme(t); setUnlockedThemes(getUnlockedThemes()) }} />
      <details className="card expander" aria-label="Appearance themes">
        <summary>
          <span className="min-w-0">
            <span className="font-display block text-lg font-bold">Appearance</span>
            <span className="block text-sm text-muted">Choose your theme · {themeLabel(theme)}</span>
          </span>
          <span aria-hidden="true" className="expander-chevron">›</span>
        </summary>
        <ThemePicker theme={theme} unlocked={unlockedThemes} isOwner={isOwnerEmail(email)} fresh={fresh} onPick={pickTheme} />
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
