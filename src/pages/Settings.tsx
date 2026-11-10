import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { Family } from '../types'
import { getThemePref, setThemePref, type ThemePref } from '../theme'
import { themeLabel } from '../themes/catalog'
import { ICONS, ICON_GROUPS, getIconPref, iconGroupAvailable, renderIcon, setIconPref, type IconId } from '../appIcon'
import { isOwnerEmail } from '../owner'
import ThemePicker from '../components/ThemePicker'
import ChangePassword from '../components/ChangePassword'
import Sheet from '../components/Sheet'
import { Icon, type IconName } from '../components/Icons'
import { appUrl, canShare, isNative, shareText } from '../lib/native'
import { pushEnabled, setPushEnabled } from '../lib/push'
import { getPresenceVisible, setPresenceVisible } from '../lib/pulse'

type Panel = 'family' | 'theme' | 'icon' | 'password'

// Picking a theme also picks a matching home-screen/browser icon. Exclusive themes
// choose one of their own unlocked icon variants; the user can still change it manually.
function iconForTheme(theme: ThemePref): IconId {
  const matching: Record<ThemePref, IconId> = {
    light: 'ocean',
    dark: 'graphite',
    midnight: 'graphite',
    dusk: 'orchid',
    glass: 'aurora',
  }
  return matching[theme] ?? 'ocean'
}

export default function Settings({ family, userId, onFamilyChanged }: { family: Family; userId: string; onFamilyChanged: () => void }) {
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const [icon, setIcon] = useState<IconId>(getIconPref())
  const previews = useMemo(() => ICONS.map((i) => ({ ...i, src: renderIcon(i.id, 120) })), [])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const isFamilyOwner = role === 'owner'
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<'newcode' | 'leave' | null>(null)
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

  useEffect(() => {
    if (!isIconAvailable(icon)) {
      setIconPref('ocean')
      setIcon('ocean')
    }
  }, [icon])

  useEffect(() => {
    supabase.from('family_members').select('role').eq('family_id', family.id).eq('user_id', userId).maybeSingle()
      .then(({ data }) => setRole((data as { role?: string } | null)?.role ?? null))
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
            {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
          </div>
        </Sheet>
      )}

      {panel === 'theme' && (
        <Sheet title="Theme" onClose={() => setPanel(null)}>
          <ThemePicker theme={theme} isOwner={isOwnerEmail(email)} onPick={pickTheme} />
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

      {panel === 'password' && (
        <Sheet title="Change password" onClose={() => setPanel(null)}>
          <ChangePassword email={email} onDone={() => setPanel(null)} />
        </Sheet>
      )}

    </div>
  )
}
