import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ServiceNotice, MAINTENANCE_REASSURANCE } from '../components/ServiceNotice'
import { useBackClose } from '../lib/backStack'
import { remindersAreScheduled, sendTestReminder } from '../lib/birthdayReminders'
import type { Family, FamilyRole } from '../types'
import MemberSheet from '../components/MemberSheet'
import { supabase } from '../supabase'
import Avatar from '../components/Avatar'
import { Icon, type IconName } from '../components/Icons'
import { shownName } from '../lib/avatars'
import { DEFAULT_MAINTENANCE_MESSAGE, LATEST_APK_URL, LATEST_RELEASE_API, isNativeApp, thisBuild, useAppSettings } from '../lib/appSettings'
import { useApkDownload } from '../lib/apkDownload'
import ApkStatus from '../components/ApkStatus'

type Section = 'app' | 'downloads' | 'updates' | 'family' | 'messages' | 'notify' | 'previews' | 'reminders'
type Preview = 'maintenance' | 'download' | 'update' | 'banner'
type Overview = { members_count: number; devices_count: number; messages_total: number; messages_today: number }
type Msg = { id: number; user_id: string; sender: string; body: string; created_at: string }

type AppUser = {
  user_id: string
  display_name: string
  nickname: string | null
  avatar: string | null
  email: string | null
  created_at: string | null
  last_sign_in_at: string | null
  families: string | null
}

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

// Ready-made maintenance messages. Tapping one fills the box; the box can still be typed in freely.
const MAINTENANCE_PRESETS = [
  DEFAULT_MAINTENANCE_MESSAGE,
  'We’re making Cznnect faster and better. We’ll be back in a few minutes.',
  'Cznnect is getting a big update. Everything is safe and we’ll be back shortly.',
  'Scheduled maintenance is in progress. Please try again in about an hour.',
  'We’re fixing a problem. Thanks for your patience, we’ll be back soon.',
]

const REMINDER_TESTS: Array<[string, string, string]> = [
  ['Birthday today', 'Birthday reminder', 'It’s Sample’s birthday today (21). Send a wish!'],
  ['Birthday tomorrow', 'Birthday reminder', 'Sample’s birthday is tomorrow (21).'],
  ['In a week', 'Birthday reminder', 'Sample’s birthday is in one week (21).'],
]

export default function Admin({ family, userId, isOwner, onFamilyChanged }: { family: Family; userId: string; isOwner: boolean; onFamilyChanged: () => void }) {
  const { settings, error: settingsError, reload } = useAppSettings(60000)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [maintMessage, setMaintMessage] = useState('')
  const [announceText, setAnnounceText] = useState('')
  const [minBuildInput, setMinBuildInput] = useState('')
  const [latestBuild, setLatestBuild] = useState<number | null>(null)
  const [members, setMembers] = useState<AdminMember[]>([])
  const [users, setUsers] = useState<AppUser[] | null>(null)
  const [usersError, setUsersError] = useState('')
  const [viewing, setViewing] = useState<AdminMember | null>(null)
  const [copied, setCopied] = useState(false)
  const [loadedFields, setLoadedFields] = useState(false)
  const [section, setSection] = useState<Section | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [messagesLoaded, setMessagesLoaded] = useState(false)
  const [notifyText, setNotifyText] = useState('')
  const [notifyAll, setNotifyAll] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  useBackClose(() => setPreview(null), preview !== null)
  const myBuild = thisBuild()
  const apk = useApkDownload()

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

  // Every account in the app (owner only). Needs supabase/24_admin_all_users.sql.
  const loadUsers = useCallback(async () => {
    if (!isOwner) return
    const { data, error } = await supabase.rpc('admin_all_users')
    if (error) { setUsersError('Could not load all users. Run supabase/24_admin_all_users.sql in Supabase first.'); return }
    setUsersError('')
    setUsers((data ?? []) as AppUser[])
  }, [isOwner])

  useEffect(() => { void loadUsers() }, [loadUsers])

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
      setNotice(`${msg} If this is the first time, run supabase/08_apk_download_toggle.sql, 09_admin.sql, 11_download_options.sql, 13_login_download_button.sql and 21_min_build_auto_raise.sql in Supabase.`)
    } finally { setBusy(false) }
  }

  async function rpc(name: 'regenerate_invite' | 'delete_family_message' | 'clear_family_messages', args: Record<string, unknown>, done: string, after: () => void) {
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

  // Live counts for the overview tiles. Owner only; quietly absent until supabase/20_admin_overview.sql has been run.
  const loadOverview = useCallback(async () => {
    if (!isOwner) return
    const { data, error } = await supabase.rpc('admin_overview', { fid: family.id })
    const row = Array.isArray(data) ? data[0] : data
    if (!error && row) setOverview(row as Overview)
  }, [family.id, isOwner])

  useEffect(() => { void loadOverview() }, [loadOverview])

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase.rpc('family_messages', { fid: family.id, lim: 100 })
    if (error) setNotice(error.message)
    else setMessages(((data ?? []) as Msg[]).slice().reverse())
    setMessagesLoaded(true)
  }, [family.id])

  useEffect(() => { if (section === 'messages' && !messagesLoaded) void loadMessages() }, [section, messagesLoaded, loadMessages])

  function open(next: Section | null) {
    setNotice('')
    setSection(next)
  }

  async function sendNotify() {
    const text = notifyText.trim()
    if (!text || busy) return
    if (!window.confirm(notifyAll ? 'Send this notification to EVERY phone that uses Cznnect, in all families?' : 'Send this notification to every phone in your family?')) return
    setBusy(true)
    setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('send-push', { body: { body: text, family_id: family.id, audience: notifyAll ? 'all' : 'family' } })
      if (data?.error) throw new Error(data.error)
      if (error) throw error
      setNotice(`Sent to ${data?.sent ?? 0} of ${data?.total ?? 0} phones.`)
      setNotifyText('')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not send the notification.')
    } finally { setBusy(false) }
  }

  function removeMessage(id: number) {
    if (!window.confirm('Delete this message for everyone?')) return
    void rpc('delete_family_message', { mid: id }, 'Message deleted.', () => { void loadMessages(); void loadOverview() })
  }

  function clearMessages() {
    if (!window.confirm('Delete every family message? This cannot be undone.')) return
    void rpc('clear_family_messages', { fid: family.id }, 'All messages deleted.', () => { void loadMessages(); void loadOverview() })
  }


  const tiles: { id: Section; icon: IconName; title: string; hint: string }[] = [
    { id: 'app', icon: 'megaphone', title: 'App status', hint: settings?.maintenanceEnabled ? 'Maintenance is ON' : settings?.announcementEnabled ? 'Banner is live' : 'Live for everyone' },
    { id: 'downloads', icon: 'download', title: 'Downloads', hint: settings?.apkDownloadEnabled ? 'Website sends visitors to the app' : 'Website sign-in is open' },
    { id: 'updates', icon: 'phone', title: 'Updates', hint: settings && settings.minBuild > 0 ? `Build ${settings.minBuild}+ required` : 'No forced update' },
    { id: 'family', icon: 'family', title: isOwner ? 'Users' : 'Family', hint: isOwner && users ? `${users.length} user${users.length === 1 ? '' : 's'} · family tools` : `${members.length} member${members.length === 1 ? '' : 's'} · invite code` },
    { id: 'previews', icon: 'phone', title: 'Previews', hint: 'See what everyone sees: maintenance, banner, download' },
    { id: 'reminders', icon: 'bell', title: 'Test reminders', hint: 'Send a sample birthday reminder to this phone' },
    { id: 'notify', icon: 'bell', title: 'Notify', hint: 'Send a notification to every phone' },
    { id: 'messages', icon: 'chat', title: 'Messages', hint: overview ? `${overview.messages_total} total · ${overview.messages_today} today` : 'Moderate the family chat' },
  ]
  const current: Section | null = isOwner ? section : 'family'
  useBackClose(() => open(null), isOwner && section !== null)
  const currentTile = tiles.find((t) => t.id === current)

  const stat = (label: string, value: string | number | undefined) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2.5">
      <p className="text-lg font-bold leading-none">{value ?? '–'}</p>
      <p className="truncate text-[11px] text-muted">{label}</p>
    </div>
  )

  const ready = Boolean(settings)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {current && isOwner && (
          <button type="button" className="btn btn-plain shrink-0" onClick={() => open(null)} aria-label="Back to admin overview"><Icon name="back" size={18} /></button>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold leading-tight">{currentTile && isOwner ? currentTile.title : 'Admin'}</h1>
          {!current && <p className="text-xs text-muted">{isOwner ? 'Owner controls' : 'Moderator tools: tap a member to see their role or remove them.'}</p>}
        </div>
      </div>

      {(settingsError || notice) && (
        <p role="status" className="card text-sm">{notice || settingsError}</p>
      )}

      {isOwner && !current && (
        <>
          <div className="card flex divide-x divide-[var(--line)] !p-0">
            {stat('Members', overview?.members_count ?? members.length)}
            {stat('Phones', overview?.devices_count)}
            {stat('Msgs today', overview?.messages_today)}
            {stat('Status', settings?.maintenanceEnabled ? 'Down' : 'Live')}
          </div>
          {!overview && <p className="-mt-2 text-xs text-muted">Live counts need supabase/20_admin_overview.sql run once in Supabase.</p>}

          <section className="card flex flex-col divide-y divide-[var(--line)] !p-0" aria-label="Quick controls">
            <p className="eyebrow px-4 pb-2 pt-3">Quick controls</p>
            {[
              { label: 'Maintenance mode', on: Boolean(settings?.maintenanceEnabled), red: true, patch: (n: boolean) => ({ maintenance_enabled: n, maintenance_message: maintMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE }), done: (n: boolean) => (n ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.') },
              { label: 'Announcement banner', on: Boolean(settings?.announcementEnabled), red: false, patch: (n: boolean) => ({ announcement_enabled: n, announcement_text: announceText.trim() }), done: (n: boolean) => (n ? 'Banner is live.' : 'Banner is hidden.') },
              { label: 'Website sends visitors to the app', on: Boolean(settings?.apkDownloadEnabled), red: false, patch: (n: boolean) => ({ apk_download_enabled: n }), done: (n: boolean) => (n ? 'Website visitors now see the download page.' : 'The website lets people sign in again.') },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <p className="min-w-0 text-sm font-semibold">{r.label}</p>
                <Switch on={r.on} onColor={r.red ? 'red' : 'green'} label={r.label} disabled={busy || !ready} onChange={(next) => {
                  if (r.label === 'Announcement banner' && next && !announceText.trim()) { setNotice('Write the banner text first, under Manage, App status.'); return }
                  void save(r.patch(next), r.done(next))
                }} />
              </div>
            ))}
          </section>

          <section className="card flex flex-col divide-y divide-[var(--line)] !p-0" aria-label="Manage">
            <p className="eyebrow px-4 pb-2 pt-3">Manage</p>
            {tiles.map((t) => (
              <button key={t.id} type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => open(t.id)}>
                <Icon name={t.icon} size={20} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-tight">{t.title}</p>
                  <p className="truncate text-xs text-muted">{t.hint}</p>
                </div>
                <span aria-hidden="true" className="menu-chevron">›</span>
              </button>
            ))}
          </section>
        </>
      )}

      {isOwner && current === 'reminders' && (
        <section className="card flex flex-col gap-3" aria-label="Test reminders">
          <p className="text-sm text-muted">
            Sends a sample birthday reminder to this phone in about two seconds.
            {' '}{remindersAreScheduled() ? 'Real reminders arrive at 9:00 am, even when the app is closed.' : 'In a browser, reminders only show when the app is open.'}
          </p>
          {REMINDER_TESTS.map(([label, title, body]) => (
            <button
              key={label}
              type="button"
              className="btn btn-plain !min-h-11 !text-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const r = await sendTestReminder(title, body)
                setBusy(false)
                setNotice(r === 'sent' ? 'Sent. It should appear in a couple of seconds. Close the app to see how it arrives.' : r === 'blocked' ? 'Notifications are blocked for Cznnect on this phone. Allow them in the phone’s settings.' : 'This device cannot show reminders.')
              }}
            >
              {label}
            </button>
          ))}
        </section>
      )}

      {isOwner && current === 'previews' && (
        <section className="card flex flex-col divide-y divide-[var(--line)] !p-0" aria-label="Previews">
          <p className="px-4 py-3 text-xs text-muted">Previews use your current settings and text, including anything you typed but have not saved. Nothing is sent to anyone.</p>
          {([
            ['maintenance', 'Maintenance screen', 'What people see while maintenance mode is on'],
            ['banner', 'Announcement banner', 'The notice at the top of the app'],
            ['download', 'Download screen', 'What website visitors see before signing in'],
            ['update', 'Update required screen', 'What old app versions see'],
          ] as Array<[Preview, string, string]>).map(([id, title, hint]) => (
            <button key={id} type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setPreview(id)}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{title}</p>
                <p className="truncate text-xs text-muted">{hint}</p>
              </div>
              <span className="text-xs font-bold text-accent-text">View</span>
            </button>
          ))}
        </section>
      )}

      {isOwner && current === 'notify' && (
        <section className="card flex flex-col gap-3">
          <div role="radiogroup" aria-label="Who gets it" className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1">
            {([[false, 'My family'], [true, 'Everyone']] as Array<[boolean, string]>).map(([all, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={notifyAll === all}
                onClick={() => setNotifyAll(all)}
                className={`rounded-lg py-2 text-sm font-bold transition ${notifyAll === all ? 'bg-accent text-accent-ink' : 'text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="label" htmlFor="admin-notify">{notifyAll ? 'Message to every phone using Cznnect' : 'Message to your family'}</label>
          <textarea id="admin-notify" className="input !min-h-20" maxLength={200} value={notifyText} onChange={(e) => setNotifyText(e.target.value)} placeholder="Type the notification" />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{notifyAll ? 'Shows as Cznnect. Not added to any chat.' : 'Shows your name and also appears in the family chat.'}</span>
            <span>{notifyText.length}/200</span>
          </div>
          <button type="button" className="btn btn-primary !min-h-11 !text-sm" disabled={busy || !notifyText.trim()} onClick={() => void sendNotify()}>Send to everyone</button>
        </section>
      )}

      {isOwner && current === 'app' && (
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
                    <p className="label">Preloaded messages</p>
                    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Preloaded maintenance messages">
                      {MAINTENANCE_PRESETS.map((m) => {
                        const on = (maintMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE) === m
                        return (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setMaintMessage(m)}
                            className={`rounded-xl border px-3 py-2 text-left text-xs transition ${on ? 'border-accent bg-accent-soft font-semibold' : 'border-line text-muted'}`}
                          >
                            {m}
                          </button>
                        )
                      })}
                    </div>
                    <label className="label mt-1" htmlFor="admin-maint-msg">Or write your own</label>
                    <textarea id="admin-maint-msg" className="input min-h-20" maxLength={240} value={maintMessage} onChange={(e) => setMaintMessage(e.target.value)} placeholder={DEFAULT_MAINTENANCE_MESSAGE} />
                    <button type="button" className="btn btn-plain" disabled={busy || !ready} onClick={() => void save({ maintenance_message: maintMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE }, 'Message saved.')}>Save message</button>
                  </div>
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
        </>
      )}

      {isOwner && current === 'downloads' && (
        <section className="card flex flex-col gap-4">
                <p className="eyebrow">App downloads</p>
                <Row title="Send website visitors to the app" hint={settings?.apkDownloadEnabled ? 'The website shows the download page before sign-in. Installed apps, the home-screen web app and you still go straight in.' : 'Anyone can sign in on the website'}>
                  <Switch
                    on={Boolean(settings?.apkDownloadEnabled)}
                    label="Send website visitors to the app"
                    disabled={busy || !ready}
                    onChange={(next) => void save({ apk_download_enabled: next }, next ? 'Website visitors now see the download page.' : 'The website lets people sign in again.')}
                  />
                </Row>
                <Row title="Android download" hint={settings?.androidDownloadEnabled ? 'Android phones are offered the APK' : 'The Android download is hidden'}>
                  <Switch
                    on={Boolean(settings?.androidDownloadEnabled)}
                    label="Show the Android download"
                    disabled={busy || !ready}
                    onChange={(next) => void save({ android_download_enabled: next }, next ? 'Android download is shown.' : 'Android download is hidden.')}
                  />
                </Row>
                <Row title="iPhone install" hint={settings?.iosInstallEnabled ? 'iPhones are shown how to add it to the Home Screen' : 'The iPhone option is hidden'}>
                  <Switch
                    on={Boolean(settings?.iosInstallEnabled)}
                    label="Show the iPhone install option"
                    disabled={busy || !ready}
                    onChange={(next) => void save({ ios_install_enabled: next }, next ? 'iPhone option is shown.' : 'iPhone option is hidden.')}
                  />
                </Row>
                <Row title="Continue on the web" hint={settings?.webContinueEnabled ? 'Visitors can skip the download page and use the website' : 'Visitors must get the app'}>
                  <Switch
                    on={Boolean(settings?.webContinueEnabled)}
                    label="Let visitors continue on the web"
                    disabled={busy || !ready}
                    onChange={(next) => void save({ web_continue_enabled: next }, next ? 'Visitors can continue on the web.' : 'Visitors must get the app.')}
                  />
                </Row>
                <Row title="Download button on sign-in" hint={settings?.loginDownloadButtonEnabled ? 'The website sign-in screen has a Download the app button' : 'The sign-in screen has no download button'}>
                  <Switch
                    on={Boolean(settings?.loginDownloadButtonEnabled)}
                    label="Show a Download the app button on the sign-in screen"
                    disabled={busy || !ready}
                    onChange={(next) => void save({ login_download_button_enabled: next }, next ? 'The sign-in screen shows the download button.' : 'The sign-in screen has no download button.')}
                  />
                </Row>
              </section>
      )}

      {isOwner && current === 'updates' && (
        <section className="card flex flex-col gap-3">
                <p className="eyebrow">Tell Android users an update is ready</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><span className="text-muted">Latest build</span><br /><b>{latestBuild ?? 'unknown'}</b></p>
                  <p><span className="text-muted">Announced now</span><br /><b>{settings && settings.announcedBuild > 0 ? `build ${settings.announcedBuild}` : 'nothing'}</b></p>
                </div>
                <Row title="Announce the update" hint={settings && settings.announcedBuild > 0 ? `Build ${settings.announcedBuild} is announced. Older apps see the update card.` : 'Hidden. Everyone stays on the build they have.'}>
                  <Switch
                    on={Boolean(settings && settings.announcedBuild > 0)}
                    label="Announce the update"
                    disabled={busy || !ready || (!(settings && settings.announcedBuild > 0) && !latestBuild)}
                    onChange={(next) => {
                      if (next && latestBuild) void save({ announced_build: latestBuild }, `Build ${latestBuild} is announced. Older apps now see the update card.`)
                      else if (!next) void save({ announced_build: 0 }, 'No update is announced. Everyone stays on their build.')
                    }}
                  />
                </Row>
                <button
                  type="button"
                  className="btn btn-plain"
                  disabled={!isNativeApp() || !latestBuild || (myBuild !== null && latestBuild <= myBuild) || apk.state.phase === 'starting' || apk.state.phase === 'downloading'}
                  onClick={() => void apk.start(LATEST_APK_URL)}
                >
                  {!isNativeApp() ? 'Open the Android app to install' : !latestBuild ? 'Latest build unknown' : myBuild !== null && latestBuild <= myBuild ? 'This phone has the latest build' : `Install build ${latestBuild} on this phone`}
                </button>
                <ApkStatus apk={apk} />
                <hr className="border-line" />
                <p className="eyebrow">Force old Android apps to update</p>
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
        <Row title="Always require the newest build" hint={settings?.autoRaiseMinBuild ? 'Each new app version becomes the required one automatically, while forced updates are on' : 'The build number you set stays as it is until you change it'}>
          <Switch
            on={Boolean(settings?.autoRaiseMinBuild)}
            label="Always require the newest build"
            disabled={busy || !ready}
            onChange={(next) => void save({ auto_raise_min_build: next }, next ? 'New versions will be required automatically.' : 'The required build now stays where you set it.')}
          />
        </Row>
              </section>
      )}

      {current === 'family' && (
        <>
          {isOwner && (
            <section className="card flex flex-col gap-3">
              <p className="eyebrow">All users{users ? ` (${users.length})` : ''}</p>
              {usersError && <p role="status" className="text-sm font-semibold text-danger">{usersError}</p>}
              {!users && !usersError && <p className="text-sm text-muted">Loading…</p>}
              {users?.map((u) => {
                const name = shownName({ display_name: u.display_name, nickname: u.nickname })
                return (
                  <div key={u.user_id} className="flex items-center gap-3">
                    <Avatar value={u.avatar} name={name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{name}{u.user_id === userId ? ' (you)' : ''}</p>
                      {u.email && <p className="truncate text-sm text-muted">{u.email}</p>}
                      <p className="text-xs text-muted">
                        {u.created_at ? `Joined ${new Date(u.created_at).toLocaleDateString()}` : ''}
                        {u.last_sign_in_at ? ` · last seen ${new Date(u.last_sign_in_at).toLocaleDateString()}` : ''}
                        {u.families ? ` · ${u.families}` : ' · no family yet'}
                      </p>
                    </div>
                  </div>
                )
              })}
              {users && users.length === 0 && <p className="text-sm text-muted">No users yet.</p>}
              <button type="button" className="btn btn-plain" onClick={() => void loadUsers()}>Refresh</button>
            </section>
          )}
          {isOwner && (
            <section className="card flex flex-col gap-3">
                    <p className="eyebrow">Invite code</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-xl border border-line px-3 py-2 text-center text-lg font-bold tracking-widest">{family.invite_code}</code>
                      <button type="button" className="btn btn-plain" onClick={() => void copyCode()}>{copied ? 'Copied' : 'Copy'}</button>
                    </div>
                    <button type="button" className="btn btn-plain" disabled={busy} onClick={newInviteCode}>Make a new code</button>
                  </section>
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
        </>
      )}

      {isOwner && current === 'messages' && (
        <>
          <section className="card flex flex-col gap-3">
            <p className="eyebrow">Family chat ({messages.length})</p>
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><b>{m.sender}</b> <span className="text-muted">· {new Date(m.created_at).toLocaleString()}</span></p>
                  <p className="mt-0.5 break-words text-sm">{m.body}</p>
                </div>
                <button type="button" className="btn btn-plain shrink-0" disabled={busy} onClick={() => removeMessage(m.id)} aria-label={`Delete message from ${m.sender}`}>Delete</button>
              </div>
            ))}
            {messagesLoaded && messages.length === 0 && <p className="text-sm text-muted">No messages.</p>}
            {!messagesLoaded && <p className="text-sm text-muted">Loading…</p>}
          </section>
          <section className="card flex flex-col gap-3">
            <p className="eyebrow">Danger zone</p>
            <button type="button" className="btn btn-plain" disabled={busy || messages.length === 0} onClick={clearMessages}>Delete all messages</button>
          </section>
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 pb-2 text-xs text-muted"><Icon name="admin" size={14} />{isOwner ? 'Owner only' : 'Owner and moderators only'}</p>
      {preview && settings && createPortal(
        <div className="fixed inset-0 z-[150] overflow-y-auto bg-[var(--page)] text-[var(--ink)]" role="dialog" aria-modal="true" aria-label="Preview">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Preview · nothing is live</p>
            <button type="button" className="btn btn-plain !min-h-9 !px-3 !text-sm" onClick={() => setPreview(null)}>Close</button>
          </div>
          {preview === 'maintenance' && (
            <ServiceNotice preview title="Back soon" message={maintMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE} reassurance={MAINTENANCE_REASSURANCE} onUnlock={() => {}} />
          )}
          {preview === 'download' && (
            <ServiceNotice
              preview
              title="Get the app"
              message="Cznnect works best as an app on your phone."
              showApk={settings.androidDownloadEnabled}
              showIos={settings.iosInstallEnabled}
              onContinue={settings.webContinueEnabled ? () => {} : undefined}
              onUnlock={() => {}}
            />
          )}
          {preview === 'update' && (
            <ServiceNotice preview title="Update required" installLabel="Update" message="This version is out of date. Update to keep using Cznnect." requiredBuild={settings.minBuild || undefined} showApk />
          )}
          {preview === 'banner' && (
            <div className="mx-auto max-w-md p-4">
              <p className="mb-3 text-xs text-muted">This is how the banner looks at the top of the app.</p>
              {(announceText.trim() || settings.announcementText.trim()) ? (
                <p role="status" className="card text-sm font-semibold">{announceText.trim() || settings.announcementText}</p>
              ) : (
                <p className="card text-sm text-muted">There is no banner text yet. Write it under Manage, App status.</p>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
