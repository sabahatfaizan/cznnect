import { useCallback, useEffect, useState } from 'react'
import type { Family, FamilyRole } from '../types'
import MemberSheet from '../components/MemberSheet'
import { supabase } from '../supabase'
import Avatar from '../components/Avatar'
import { Icon } from '../components/Icons'
import { shownName } from '../lib/avatars'
import { DEFAULT_MAINTENANCE_MESSAGE, LATEST_RELEASE_API, thisBuild, useAppSettings } from '../lib/appSettings'

type AdminMember = {
  user_id: string
  role: FamilyRole
  joined_at: string | null
  profiles: { display_name: string; nickname?: string | null; bio?: string | null; avatar?: string | null } | null
}

function Switch({ on, onChange, label, disabled, onColor = 'green' }: { on: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; onColor?: 'green' | 'red' }) {
  const onClass = onColor === 'red' ? 'border-red-500 bg-red-500' : 'border-green-500 bg-green-500'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-wait disabled:opacity-60 ${on ? onClass : 'border-line bg-black/20'}`}
    >
      <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${on ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  )
}

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </div>
      {children}
    </div>
  )
}

export default function Admin({ family, userId, isOwner, onFamilyChanged }: { family: Family; userId: string; isOwner: boolean; onFamilyChanged: () => void }) {
  const { settings, error: settingsError, reload } = useAppSettings(60000)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [maintMessage, setMaintMessage] = useState('')
  const [announceText, setAnnounceText] = useState('')
  const [minBuildInput, setMinBuildInput] = useState('')
  const [latestBuild, setLatestBuild] = useState<number | null>(null)
  const [members, setMembers] = useState<AdminMember[]>([])
  const [viewing, setViewing] = useState<AdminMember | null>(null)
  const [copied, setCopied] = useState(false)
  const [loadedFields, setLoadedFields] = useState(false)
  const myBuild = thisBuild()

  // Fill the editable fields once, from the first load, so polling never overwrites what is being typed.
  useEffect(() => {
    if (!settings || loadedFields) return
    setMaintMessage(settings.maintenanceMessage)
    setAnnounceText(settings.announcementText)
    setMinBuildInput(settings.minBuild > 0 ? String(settings.minBuild) : '')
    setLoadedFields(true)
  }, [settings, loadedFields])

  // The newest published Android build, read from the public release notes ("Build 85 (abc1234)...").
  useEffect(() => {
    let alive = true
    fetch(LATEST_RELEASE_API)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { body?: string } | null) => {
        const m = /Build\s+(\d+)/.exec(j?.body ?? '')
        if (alive && m) setLatestBuild(Number(m[1]))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const loadMembers = useCallback(async () => {
    const q = (cols: string) =>
      supabase.from('family_members').select(`user_id, role, joined_at, profiles(${cols})`).eq('family_id', family.id).order('joined_at')
    let { data, error } = await q('display_name, nickname, bio, avatar')
    if (error) ({ data, error } = await q('display_name'))
    if (error) setNotice(error.message)
    else setMembers((data ?? []) as unknown as AdminMember[])
  }, [family.id])

  useEffect(() => { void loadMembers() }, [loadMembers])

  // Saves some settings columns. The database only lets the owner's email do this.
  async function save(patch: Record<string, unknown>, done: string) {
    setBusy(true)
    setNotice('')
    try {
      const { error } = await supabase.from('app_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
      if (error) throw error
      await reload()
      setNotice(done)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save.'
      setNotice(`${msg} If this is the first time, run supabase/08_apk_download_toggle.sql and supabase/09_admin.sql in Supabase.`)
    } finally { setBusy(false) }
  }

  async function rpc(name: 'regenerate_invite', args: Record<string, unknown>, done: string, after: () => void) {
    setBusy(true)
    setNotice('')
    try {
      const { error } = await supabase.rpc(name, args)
      if (error) throw error
      setNotice(done)
      after()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Something went wrong.')
    } finally { setBusy(false) }
  }

  function newInviteCode() {
    if (!window.confirm('Make a new invite code? The old code stops working.')) return
    void rpc('regenerate_invite', { fid: family.id }, 'New invite code created.', onFamilyChanged)
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(family.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { setNotice('Could not copy. Select the code and copy it by hand.') }
  }

  function saveMinBuild(value: number) {
    if (value > 0 && !window.confirm(`Every Android app older than build ${value} will be blocked until it is updated, including your own phone. The access PIN (tap the logo 5 times) gets past the screen. Continue?`)) return
    void save({ min_build: value }, value > 0 ? `Apps older than build ${value} must update.` : 'Forced updates are off.')
  }

  const ready = Boolean(settings)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-muted">
          {isOwner ? 'Owner controls. Only your account can use this page.' : 'Moderator tools. Tap a member to see their role or remove them.'}
        </p>
      </div>

      {(settingsError || notice) && (
        <p role="status" className="card text-sm">{notice || settingsError}</p>
      )}

      {isOwner && (
        <>
      <section className="card flex flex-col gap-4">
        <p className="eyebrow">Maintenance</p>
        <Row title="Maintenance mode" hint={settings?.maintenanceEnabled ? 'Visitors see the maintenance screen' : 'App is live for everyone'}>
          <Switch
            on={Boolean(settings?.maintenanceEnabled)}
            onColor="red"
            label="Maintenance mode"
            disabled={busy || !ready}
            onChange={(next) => void save({ maintenance_enabled: next, maintenance_message: maintMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE }, next ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.')}
          />
        </Row>
        <div className="flex flex-col gap-2">
          <label className="label" htmlFor="admin-maint-msg">Message people see</label>
          <textarea id="admin-maint-msg" className="input min-h-20" maxLength={240} value={maintMessage} onChange={(e) => setMaintMessage(e.target.value)} placeholder={DEFAULT_MAINTENANCE_MESSAGE} />
          <button type="button" className="btn btn-plain" disabled={busy || !ready} onClick={() => void save({ maintenance_message: maintMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE }, 'Message saved.')}>Save message</button>
        </div>
        <Row title="Send website visitors to the app" hint={settings?.apkDownloadEnabled ? 'The website shows the download page instead of sign-in. The installed apps, home-screen web app and you still get in.' : 'Anyone can sign in on the website'}>
          <Switch
            on={Boolean(settings?.apkDownloadEnabled)}
            label="Send website visitors to the app"
            disabled={busy || !ready}
            onChange={(next) => void save({ apk_download_enabled: next }, next ? 'Website visitors now see the download page.' : 'The website lets people sign in again.')}
          />
        </Row>
      </section>

      <section className="card flex flex-col gap-3">
        <p className="eyebrow">Announcement banner</p>
        <Row title="Show banner" hint={settings?.announcementEnabled ? 'Everyone sees it at the top' : 'Hidden'}>
          <Switch
            on={Boolean(settings?.announcementEnabled)}
            label="Show announcement banner"
            disabled={busy || !ready || (!settings?.announcementEnabled && !announceText.trim())}
            onChange={(next) => void save({ announcement_enabled: next, announcement_text: announceText.trim() }, next ? 'Banner is live.' : 'Banner is hidden.')}
          />
        </Row>
        <label className="label" htmlFor="admin-announce">Message</label>
        <textarea id="admin-announce" className="input min-h-20" maxLength={200} value={announceText} onChange={(e) => setAnnounceText(e.target.value)} placeholder="Reunion on Friday at 7pm" />
        <button type="button" className="btn btn-plain" disabled={busy || !ready} onClick={() => void save({ announcement_text: announceText.trim() }, 'Banner text saved.')}>Save text</button>
      </section>

      <section className="card flex flex-col gap-3">
        <p className="eyebrow">Force old Android apps to update</p>
        <p className="text-sm text-muted">
          Android apps older than the build below show an “Update required” screen and the database stops serving
          them data. The website and home-screen app update by themselves, and your owner account is never blocked
          (to see the screen, look at the app while signed out). Apps installed before this feature existed cannot be
          forced and need one manual update. Run supabase/10_enforce_min_build.sql once to switch on the database check.
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p><span className="text-muted">Latest app build</span><br /><b>{latestBuild ?? 'unknown'}</b></p>
          <p><span className="text-muted">Required now</span><br /><b>{settings && settings.minBuild > 0 ? `build ${settings.minBuild}` : 'nobody forced'}</b></p>
          <p><span className="text-muted">This app</span><br /><b>{myBuild ? `build ${myBuild}` : 'website / local'}</b></p>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || !ready || !latestBuild} onClick={() => latestBuild && saveMinBuild(latestBuild)}>
          {latestBuild ? `Require latest (build ${latestBuild})` : 'Latest build unknown'}
        </button>
        <div className="flex gap-2">
          <input className="input min-w-0 flex-1" inputMode="numeric" aria-label="Minimum build number" value={minBuildInput} onChange={(e) => setMinBuildInput(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Build number" />
          <button type="button" className="btn btn-plain" disabled={busy || !ready || !minBuildInput} onClick={() => saveMinBuild(Number(minBuildInput))}>Set</button>
        </div>
        <button type="button" className="btn btn-plain" disabled={busy || !ready || !settings || settings.minBuild === 0} onClick={() => { setMinBuildInput(''); saveMinBuild(0) }}>Turn off forced updates</button>
      </section>

      <section className="card flex flex-col gap-3">
        <p className="eyebrow">Invite code</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-line px-3 py-2 text-center text-lg font-bold tracking-widest">{family.invite_code}</code>
          <button type="button" className="btn btn-plain" onClick={() => void copyCode()}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <button type="button" className="btn btn-plain" disabled={busy} onClick={newInviteCode}>Make a new code</button>
      </section>

        </>
      )}

      <section className="card flex flex-col gap-3">
        <p className="eyebrow">Members ({members.length})</p>
        {members.map((m) => {
          const name = shownName(m.profiles)
          const isMe = m.user_id === userId
          return (
            <button
              type="button"
              key={m.user_id}
              className="flex w-full items-center gap-3 text-left"
              onClick={() => setViewing(m)}
              aria-label={`${name}, ${m.role}. Open details`}
            >
              <Avatar value={m.profiles?.avatar} name={name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{name}{isMe ? ' (you)' : ''}</p>
                <p className="text-sm text-muted">
                  {m.role === 'owner' ? 'Owner' : m.role === 'moderator' ? 'Moderator' : 'Member'}
                  {m.joined_at ? ` · joined ${new Date(m.joined_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <span aria-hidden="true" className="menu-chevron">›</span>
            </button>
          )
        })}
        {members.length === 0 && <p className="text-sm text-muted">No members loaded.</p>}
        {viewing && (
          <MemberSheet
            member={viewing}
            viewerId={userId}
            viewerRole={members.find((x) => x.user_id === userId)?.role ?? null}
            familyId={family.id}
            onClose={() => setViewing(null)}
            onChanged={() => void loadMembers()}
          />
        )}
      </section>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-xs text-muted"><Icon name="admin" size={14} />{isOwner ? 'Owner only' : 'Owner and moderators only'}</p>
    </div>
  )
}
