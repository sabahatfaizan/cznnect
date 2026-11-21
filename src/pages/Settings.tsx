import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Family } from '../types'
import { PLUS_THEMES, getThemePref, setThemePref, type ThemePref } from '../theme'
import { themeLabel } from '../themes/catalog'
import { ICONS, ICON_GROUPS, PLUS_GROUP, getIconPref, iconGroupAvailable, isPlusIcon, renderIcon, setIconPref, type IconId } from '../appIcon'
import { PLUS_NAME, hasPlus } from '../lib/plus'
import { isOwnerEmail } from '../owner'
import ThemePicker from '../components/ThemePicker'
import ChangePassword from '../components/ChangePassword'
import Sheet from '../components/Sheet'
import { Icon, type IconName } from '../components/Icons'
import { appUrl, canShare, isNative, shareText } from '../lib/native'
import { pushEnabled, setPushEnabled } from '../lib/push'
import { getPresenceVisible, setPresenceVisible } from '../lib/pulse'

type Panel = 'family' | 'theme' | 'icon' | 'password'
type FamilyConfirm = 'newcode' | 'leave' | 'delete' | null

// Picking a theme also picks a matching home-screen/browser icon. Exclusive themes
// choose one of their own unlocked icon variants; the user can still change it manually.
function iconForTheme(theme: ThemePref): IconId {
  const matching: Record<ThemePref, IconId> = {
    light: 'light',
    dark: 'dark',
    midnight: 'dark',
    dusk: 'dark',
    glass: 'dark',
  }
  return matching[theme] ?? 'light'
}

export default function Settings({ family, userId, onFamilyChanged }: { family: Family; userId: string; onFamilyChanged: () => void }) {
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [icon, setIcon] = useState<IconId>(getIconPref())
  const previews = useMemo(() => ICONS.map((i) => ({ ...i, src: renderIcon(i.id, 120) })), [])
  const [email, setEmail] = useState('')
  const [plus, setPlus] = useState<boolean | null>(null)
  const [plusNote, setPlusNote] = useState(false)
  const [themeNote, setThemeNote] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [isFamilyCreator, setIsFamilyCreator] = useState(false)
  const isFamilyOwner = role === 'owner'
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<FamilyConfirm>(null)
  const [deleteName, setDeleteName] = useState('')
  const [copied, setCopied] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [familyName, setFamilyName] = useState(family.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [notify, setNotify] = useState(pushEnabled)
  const [showOnline, setShowOnline] = useState(true)
  useEffect(() => { void getPresenceVisible().then(setShowOnline) }, [])
  const buildNumber = import.meta.env.VITE_BUILD_NUMBER || 'Local build'
  const buildCommit = import.meta.env.VITE_BUILD_COMMIT?.slice(0, 7) || ''

  const availableIconGroups = ICON_GROUPS.filter((group) => iconGroupAvailable(group))
  const isIconAvailable = (id: IconId) => {
    const item = ICONS.find((candidate) => candidate.id === id)
    return Boolean(item && availableIconGroups.includes(item.group))
  }

  useEffect(() => { void hasPlus().then(setPlus) }, [])
  const ownerPlus = isOwnerEmail(email)
  const plusOn = ownerPlus || plus === true

  useEffect(() => {
    if (!isIconAvailable(icon)) {
      setIconPref('light')
      setIcon('light')
      return
    }
    // A coloured icon without Cznnect+ (it ran out, or was chosen before the change) goes back to the theme's icon.
    if (plus !== null && isPlusIcon(icon) && !plusOn) {
      const back = iconForTheme(theme)
      setIconPref(back)
      setIcon(back)
    }
  }, [icon, plus, plusOn, theme])

  useEffect(() => {
    supabase.from('family_members').select('role').eq('family_id', family.id).eq('user_id', userId).maybeSingle()
      .then(({ data }) => setRole((data as { role?: string } | null)?.role ?? null))
    supabase.from('families').select('created_by').eq('id', family.id).maybeSingle()
      .then(({ data }) => setIsFamilyCreator((data as { created_by?: string | null } | null)?.created_by === userId))
    supabase.from('family_members').select('user_id', { count: 'exact', head: true }).eq('family_id', family.id)
      .then(({ count }) => setMemberCount(count ?? null))
  }, [family.id, userId])

  const code = family.invite_code.toUpperCase()
  const inviteText = `Join ${family.name} on Cznnect. Open ${appUrl()}, create an account, then enter this invite code: ${code}`
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // The code is selectable on screen, so copying by hand still works.
    }
  }
  async function familyAction(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); setError('')
    const { error } = await action()
    setBusy(false); setConfirm(null)
    if (error) setError(error.message)
    else onFamilyChanged()
  }

  async function deleteFamily() {
    if (deleteName.trim() !== family.name) {
      setError('Enter the exact family name to confirm deletion.')
      return
    }
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('delete_family', { fid: family.id, confirmation_name: deleteName.trim() })
    setBusy(false)
    if (error) { setError(error.message); return }
    setPanel(null)
    onFamilyChanged()
  }

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
    if (PLUS_THEMES.includes(id) && !plusOn) { setThemeNote(true); return }
    setThemeNote(false)
    setThemePref(id)
    setTheme(id)
    // Light and dark themes switch the free Light and Dark icons. A coloured Cznnect+ icon the person picked stays.
    if (isPlusIcon(icon) && plusOn) return
    const nextIcon = iconForTheme(id)
    setIconPref(nextIcon)
    setIcon(nextIcon)
  }

  const currentIcon = previews.find((p) => p.id === (isIconAvailable(icon) ? icon : 'light'))
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
      <div className="set-grid">
        {tile('family', 'Family', 'family', family.name)}
        {tile('theme', 'Theme', 'palette', themeLabel(theme))}
        {tile('icon', 'App icon', 'phone', currentIcon?.label ?? '')}
      </div>

      {isNative() && (
        <button
          type="button"
          role="switch"
          aria-checked={notify}
          className="set-redeem"
          onClick={() => { const next = !notify; setNotify(next); void setPushEnabled(next) }}
        >
          <span className="set-tile-icon" aria-hidden="true"><Icon name="bell" size={22} /></span>
          <span className="set-tile-label flex-1 text-left">Family notifications</span>
          <span className="text-sm font-semibold text-muted">{notify ? 'On' : 'Off'}</span>
        </button>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={showOnline}
        className="set-redeem !mt-0"
        onClick={() => { const next = !showOnline; setShowOnline(next); void setPresenceVisible(next) }}
      >
        <span className="set-tile-icon" aria-hidden="true"><Icon name="online" size={22} /></span>
        <span className="set-tile-label flex-1 text-left">Show when I'm online</span>
        <span className="text-sm font-semibold text-muted">{showOnline ? 'On' : 'Off'}</span>
      </button>

      <button type="button" className="set-redeem !mt-0" onClick={() => setPanel('password')} aria-haspopup="dialog">
        <span className="set-tile-icon" aria-hidden="true"><Icon name="lock" size={22} /></span>
        <span className="set-tile-label flex-1 text-left">Change password</span>
        <span aria-hidden="true" className="expander-chevron"><Icon name="chevronDown" size={20} /></span>
      </button>

      <p className="text-center text-xs text-muted" aria-label="App build version">Build {buildNumber}{buildCommit ? ` · ${buildCommit}` : ''}</p>

      {panel === 'family' && (
        <Sheet title="Family settings" onClose={() => { setPanel(null); setEditingName(false); setConfirm(null); setError('') }}>
          <div className="flex flex-col gap-4">
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
                {isFamilyOwner && <button className="btn btn-plain" type="button" onClick={() => { setFamilyName(family.name); setSaved(false); setEditingName(true) }}>Change</button>}
              </div>
            )}
            {saved && <p className="text-sm font-bold text-accent-text">Name updated.</p>}
            <div className="flex gap-6 text-sm">
              <div><p className="text-muted">Members</p><p className="font-semibold">{memberCount ?? '…'}</p></div>
              <div><p className="text-muted">Your role</p><p className="font-semibold capitalize">{role ?? '…'}</p></div>
            </div>
            <section className="flex flex-col gap-2" aria-label="Invite people">
              <h3 className="eyebrow">Invite people</h3>
              <p className="text-sm text-muted">Anyone with this code can join after making an account.</p>
              <p className="select-all font-mono text-xl font-bold tracking-widest">{code}</p>
              <div className="flex gap-2">
                <button className="btn btn-primary" type="button" onClick={() => void copyInvite()}>{copied ? 'Copied' : 'Copy invite'}</button>
                {canShare() && <button className="btn btn-plain" type="button" onClick={() => shareText(inviteText, `Join ${family.name} on Cznnect`).catch(() => {})}>Share</button>}
              </div>
              {isFamilyOwner && (confirm === 'newcode' ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm">Make a new code? The old code stops working, so people you removed cannot rejoin with it.</p>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void familyAction(() => supabase.rpc('regenerate_invite', { fid: family.id }))}>Make new code</button>
                    <button className="btn btn-plain" type="button" onClick={() => setConfirm(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="min-h-11 self-start text-sm font-bold underline underline-offset-2" type="button" onClick={() => setConfirm('newcode')}>Get a new invite code</button>
              ))}
            </section>
            {!isFamilyOwner && role && (confirm === 'leave' ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm">Leave {family.name}? You will need the invite code to join again.</p>
                <div className="flex gap-2">
                  <button className="btn btn-danger" type="button" disabled={busy} onClick={() => void familyAction(() => supabase.rpc('leave_family', { fid: family.id }))}>Leave</button>
                  <button className="btn btn-plain" type="button" onClick={() => setConfirm(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="min-h-11 self-start text-sm font-bold text-danger underline underline-offset-2" type="button" onClick={() => setConfirm('leave')}>Leave this family</button>
            ))}
            {isFamilyCreator && (
              <section className="mt-2 flex flex-col gap-2 border-t border-line pt-4" aria-label="Delete family">
                <h3 className="eyebrow text-danger">Danger zone</h3>
                {confirm === 'delete' ? (
                  <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void deleteFamily() }}>
                    <p className="text-sm">Permanently delete <strong>{family.name}</strong> and its family-specific content for every member? This cannot be undone. Your Cznnect account will not be deleted.</p>
                    <label className="label" htmlFor="delete-family-name">Type the family name to confirm</label>
                    <input id="delete-family-name" className="input" value={deleteName} onChange={(e) => setDeleteName(e.target.value)} autoComplete="off" required />
                    <div className="flex gap-2">
                      <button className="btn btn-danger" type="submit" disabled={busy || deleteName.trim() !== family.name}>{busy ? 'Deleting…' : 'Permanently delete family'}</button>
                      <button className="btn btn-plain" type="button" disabled={busy} onClick={() => { setConfirm(null); setDeleteName(''); setError('') }}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button className="min-h-11 self-start text-sm font-bold text-danger underline underline-offset-2" type="button" onClick={() => { setConfirm('delete'); setDeleteName(''); setError('') }}>Delete this family</button>
                )}
              </section>
            )}
            {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
          </div>
        </Sheet>
      )}

      {panel === 'theme' && (
        <Sheet title="Theme" onClose={() => setPanel(null)}>
          <ThemePicker theme={theme} isOwner={isOwnerEmail(email)} plus={plusOn} onPick={pickTheme} />
          {themeNote && <p role="status" className="mt-3 text-sm font-semibold">Midnight and Dusk come with {PLUS_NAME}.</p>}
        </Sheet>
      )}

      {panel === 'icon' && (
        <Sheet title="App icon" onClose={() => { setPanel(null); setPlusNote(false) }}>
          <div className="flex flex-col gap-4" role="radiogroup" aria-label="App icon">
            {availableIconGroups.map((group) => {
              const locked = group === PLUS_GROUP && !plusOn
              return (
                <div key={group} className="flex flex-col gap-2">
                  {group === PLUS_GROUP
                    ? <h3 className="eyebrow">{PLUS_NAME}</h3>
                    : <p className="text-sm text-muted">Light and Dark follow your theme.</p>}
                  <div className="grid grid-cols-3 gap-3">
                    {previews.filter((v) => v.group === group).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={icon === v.id}
                        aria-disabled={locked}
                        className={`icon-tile ${icon === v.id ? 'icon-tile-on' : ''} ${locked ? 'opacity-60' : ''}`}
                        onClick={() => {
                          if (locked) { setPlusNote(true); return }
                          setIconPref(v.id)
                          setIcon(v.id)
                        }}
                      >
                        <img src={v.src} alt="" width={60} height={60} />
                        <span className="flex items-center gap-1">{locked && <Icon name="lock" size={12} />}{v.label}</span>
                      </button>
                    ))}
                  </div>
                  {locked && plusNote && <p role="status" className="text-sm font-semibold">The coloured icons come with {PLUS_NAME}.</p>}
                </div>
              )
            })}
          </div>
        </Sheet>
      )}

      {panel === 'password' && (
        <Sheet title="Change password" onClose={() => setPanel(null)}>
          <ChangePassword email={email} onDone={() => setPanel(null)} />
        </Sheet>
      )}

    </div>
  )
}
