import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Family } from '../types'
import { getThemePref, getUnlockedThemes, onThemeUnlocked, onUnlocksChanged, setThemePref, type ExclusiveTheme, type ThemePref } from '../theme'
import { themeLabel } from '../themes/catalog'
import { ICONS, ICON_GROUPS, getIconPref, iconGroupAvailable, renderIcon, setIconPref, type IconId } from '../appIcon'
import { isOwnerEmail } from '../owner'
import ThemePicker from '../components/ThemePicker'
import RedeemCard from '../components/RedeemCard'
import Sheet from '../components/Sheet'
import { Icon, type IconName } from '../components/Icons'

type Panel = 'family' | 'theme' | 'icon' | 'redeem'

// Picking a theme also picks a matching home-screen/browser icon. Exclusive themes
// choose one of their own unlocked icon variants; the user can still change it manually.
function iconForTheme(theme: ThemePref): IconId {
  const group = theme === 'rdr2' ? 'Red Dead'
    : theme === 'uncharted' ? 'Uncharted'
    : theme === 'moonknight' || theme === 'moonpaper' ? 'Moon Knight'
    : 'Classic'
  const choices = ICONS.filter((item) => item.group === group)
  if (theme === 'rdr2' || theme === 'uncharted' || theme === 'moonknight' || theme === 'moonpaper') {
    return choices[Math.floor(Math.random() * choices.length)]?.id ?? 'ocean'
  }
  const matching: Record<'light' | 'dark' | 'glass', IconId> = {
    light: 'ocean',
    dark: 'graphite',
    glass: 'aurora',
  }
  return matching[theme as 'light' | 'dark' | 'glass'] ?? 'ocean'
}

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
  const [panel, setPanel] = useState<Panel | null>(null)
  const buildNumber = import.meta.env.VITE_BUILD_NUMBER || 'Local build'
  const buildCommit = import.meta.env.VITE_BUILD_COMMIT?.slice(0, 7) || ''

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
    const nextIcon = iconForTheme(id)
    setIconPref(nextIcon)
    setIcon(nextIcon)
  }

  const currentIcon = previews.find((p) => p.id === (isIconAvailable(icon) ? icon : 'ocean'))
  const tile = (id: Panel, label: string, name: IconName, hint: string) => (
    <button key={id} type="button" className="set-tile" onClick={() => setPanel(id)} aria-haspopup="dialog">
      <span className="set-tile-icon" aria-hidden="true">
        {id === 'icon' && currentIcon ? <img src={currentIcon.src} alt="" width={30} height={30} className="rounded-[22%]" /> : <Icon name={name} size={26} />}
      </span>
      <span className="set-tile-label">{label}</span>
    </button>
  )

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Settings</h1>
      <div className="set-grid">
        {isFamilyOwner && tile('family', 'Family', 'family', family.name)}
        {tile('theme', 'Theme', 'palette', themeLabel(theme))}
        {tile('icon', 'App icon', 'phone', currentIcon?.label ?? '')}
      </div>

      <button type="button" className="set-redeem" onClick={() => setPanel('redeem')} aria-haspopup="dialog">
        <span className="set-tile-icon" aria-hidden="true"><Icon name="key" size={22} /></span>
        <span className="set-tile-label flex-1 text-left">Redeem code</span>
        <span aria-hidden="true" className="expander-chevron">›</span>
      </button>

      <p className="text-center text-xs text-muted" aria-label="App build version">Build {buildNumber}{buildCommit ? ` · ${buildCommit}` : ''}</p>

      {panel === 'family' && isFamilyOwner && (
        <Sheet title="Family settings" onClose={() => { setPanel(null); setEditingName(false); setError('') }}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">Only you, the owner, can change these.</p>
            {editingName ? (
              <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void saveName() }}>
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
          </div>
        </Sheet>
      )}

      {panel === 'theme' && (
        <Sheet title="Theme" onClose={() => setPanel(null)}>
          <ThemePicker theme={theme} unlocked={unlockedThemes} isOwner={isOwnerEmail(email)} fresh={fresh} onPick={pickTheme} />
        </Sheet>
      )}

      {panel === 'icon' && (
        <Sheet title="App icon" onClose={() => setPanel(null)}>
          <div className="flex flex-col gap-4" role="radiogroup" aria-label="App icon colour">
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
          </div>
        </Sheet>
      )}

      {panel === 'redeem' && (
        <Sheet title="Redeem code" onClose={() => setPanel(null)}>
          <RedeemCard isOwner={isOwnerEmail(email)} onRedeemed={(t) => { setTheme(t); setUnlockedThemes(getUnlockedThemes()) }} />
        </Sheet>
      )}
    </div>
  )
}
