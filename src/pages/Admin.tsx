import { useCallback, useEffect, useState } from 'react'
import ShareAppCard from '../components/ShareAppCard'
import TitleBadge from '../components/TitleBadge'
import { createPortal } from 'react-dom'
import { ServiceNotice } from '../components/ServiceNotice'
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

type Section = 'app' | 'announcements' | 'downloads' | 'updates' | 'builds' | 'pages' | 'family' | 'messages' | 'notify' | 'previews' | 'reminders' | 'share' | 'data'
type Preview = 'maintenance' | 'download' | 'update' | 'banner'
type Overview = { members_count: number; devices_count: number; messages_total: number; messages_today: number }
type Msg = { id: number; user_id: string; sender: string; body: string; created_at: string }
type BuildRun = { id: number; run_number: number; name: string; status: string; conclusion: string | null; created_at: string; head_sha: string; html_url: string; event: string }
type BuildRelease = { id: number; name: string; body: string; html_url: string; tag_name: string; assets: Array<{ id: number; name: string; size: number; download_count: number }> }\ntype AnnouncementRow = { id: string; title: string; body: string; image_url: string; action_label: string; action_url: string; published: boolean; starts_at: string | null; ends_at: string | null; created_at: string }

type AppUser = {
  user_id: string
  display_name: string
  nickname: string | null
  avatar: string | null
  title?: string | null
  email: string | null
  created_at: string | null
  last_sign_in_at: string | null
  families: string | null
}

type AdminMember = {
  user_id: string
  role: FamilyRole
  joined_at: string | null
  profiles: { display_name: string; nickname?: string | null; bio?: string | null; avatar?: string | null; title?: string | null } | null
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
  const [meetupCode, setMeetupCode] = useState('')
  const [buildRuns, setBuildRuns] = useState<BuildRun[]>([])
  const [buildRelease, setBuildRelease] = useState<BuildRelease | null>(null)
  const [buildsLoading, setBuildsLoading] = useState(false)
  const [buildsError, setBuildsError] = useState('')\n  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])\n  const [announcementTitle, setAnnouncementTitle] = useState('')\n  const [announcementBody, setAnnouncementBody] = useState('')\n  const [announcementImage, setAnnouncementImage] = useState('')\n  const [announcementFile, setAnnouncementFile] = useState<File | null>(null)\n  const [announcementActionLabel, setAnnouncementActionLabel] = useState('')\n  const [announcementActionUrl, setAnnouncementActionUrl] = useState('')\n  const [announcementStarts, setAnnouncementStarts] = useState('')\n  const [announcementEnds, setAnnouncementEnds] = useState('')\n  const [editingAnnouncement, setEditingAnnouncement] = useState<string | null>(null)\n  const [announcementLoading, setAnnouncementLoading] = useState(false)
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
    let { data, error } = await q('display_name, nickname, bio, avatar, title')
    if (error) ({ data, error } = await q('display_name, nickname, bio, avatar'))
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
      setNotice(`${msg} If this is the first time, run supabase/08_apk_download_toggle.sql, 09_admin.sql, 11_download_options.sql, 13_login_download_button.sql, 21_min_build_auto_raise.sql and 23_announce_update.sql in Supabase.`)
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

  const loadBuilds = useCallback(async () => {
    setBuildsLoading(true)
    setBuildsError('')
    try {
      const { data, error } = await supabase.functions.invoke('manage-builds', { body: { action: 'list' } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setBuildRuns((data?.runs ?? []) as BuildRun[])
      setBuildRelease((data?.release ?? null) as BuildRelease | null)
    } catch (e) {
      setBuildsError(e instanceof Error ? e.message : 'Could not load builds.')
    } finally { setBuildsLoading(false) }
  }, [])

  useEffect(() => { if (section === 'builds' || section === 'pages') void loadBuilds() }, [section, loadBuilds])\n\n  const loadAnnouncements = useCallback(async () => {\n    setAnnouncementLoading(true)\n    const { data, error } = await supabase.from('app_announcements').select('*').order('created_at', { ascending: false })\n    if (error) setNotice(error.message)\n    else setAnnouncements((data ?? []) as AnnouncementRow[])\n    setAnnouncementLoading(false)\n  }, [])\n\n  useEffect(() => { if (section === 'announcements') void loadAnnouncements() }, [section, loadAnnouncements])\n\n  function resetAnnouncementForm() {\n    setEditingAnnouncement(null); setAnnouncementTitle(''); setAnnouncementBody(''); setAnnouncementImage(''); setAnnouncementFile(null)\n    setAnnouncementActionLabel(''); setAnnouncementActionUrl(''); setAnnouncementStarts(''); setAnnouncementEnds('')\n  }\n\n  function editAnnouncement(item: AnnouncementRow) {\n    setEditingAnnouncement(item.id); setAnnouncementTitle(item.title); setAnnouncementBody(item.body); setAnnouncementImage(item.image_url); setAnnouncementFile(null)\n    setAnnouncementActionLabel(item.action_label); setAnnouncementActionUrl(item.action_url)\n    setAnnouncementStarts(item.starts_at ? new Date(item.starts_at).toISOString().slice(0,16) : '')\n    setAnnouncementEnds(item.ends_at ? new Date(item.ends_at).toISOString().slice(0,16) : '')\n    window.scrollTo({ top: 0, behavior: 'smooth' })\n  }\n\n  async function saveAnnouncement(publish: boolean) {\n    if (busy) return\n    if (!announcementTitle.trim()) { setNotice('Add an announcement title first.'); return }\n    setBusy(true); setNotice('')\n    try {\n      let imageUrl = announcementImage\n      if (announcementFile) {\n        if (!['image/jpeg', 'image/png', 'image/webp'].includes(announcementFile.type)) throw new Error('Use a JPG, PNG or WebP poster.')\n        if (announcementFile.size > 10 * 1024 * 1024) throw new Error('Poster must be 10 MB or smaller.')\n        const path = `${Date.now()}-${announcementFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`\n        const { error: uploadError } = await supabase.storage.from('announcement-posters').upload(path, announcementFile, { upsert: true, contentType: announcementFile.type })\n        if (uploadError) throw uploadError\n        imageUrl = supabase.storage.from('announcement-posters').getPublicUrl(path).data.publicUrl\n      }\n      const payload = { title: announcementTitle.trim(), body: announcementBody.trim(), image_url: imageUrl, action_label: announcementActionLabel.trim(), action_url: announcementActionUrl.trim(), published: publish, starts_at: announcementStarts ? new Date(announcementStarts).toISOString() : null, ends_at: announcementEnds ? new Date(announcementEnds).toISOString() : null, updated_at: new Date().toISOString() }\n      const result = editingAnnouncement\n        ? await supabase.from('app_announcements').update(payload).eq('id', editingAnnouncement)\n        : await supabase.from('app_announcements').insert(payload)\n      if (result.error) throw result.error\n      setNotice(publish ? 'Announcement published.' : 'Announcement saved as a draft.')\n      resetAnnouncementForm()\n      await loadAnnouncements()\n    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save announcement.') }\n    finally { setBusy(false) }\n  }\n\n  async function deleteAnnouncement(item: AnnouncementRow) {\n    if (!window.confirm(`Delete "${item.title}" and its dismissal records? This cannot be undone.`)) return\n    setBusy(true)\n    const { error } = await supabase.from('app_announcements').delete().eq('id', item.id)\n    setBusy(false)\n    if (error) setNotice(error.message); else { setNotice('Announcement deleted.'); if (editingAnnouncement === item.id) resetAnnouncementForm(); void loadAnnouncements() }\n  }\n\n  async function toggleAnnouncement(item: AnnouncementRow) {\n    setBusy(true)\n    const { error } = await supabase.from('app_announcements').update({ published: !item.published, updated_at: new Date().toISOString() }).eq('id', item.id)\n    setBusy(false)\n    if (error) setNotice(error.message); else void loadAnnouncements()\n  }

  async function manageBuild(action: string, payload: Record<string, unknown>, confirmation: string) {
    if (busy || !window.confirm(confirmation)) return
    setBusy(true)
    setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('manage-builds', { body: { action, ...payload } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setNotice(data?.message || 'Done.')
      await loadBuilds()
    } catch (e) {
      setBuildsError(e instanceof Error ? e.message : 'Build action failed.')
    } finally { setBusy(false) }
  }

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

  async function clearMeetupData() {
    if (!/^\d{4}$/.test(meetupCode)) { setNotice('Enter the 4-digit confirmation code.'); return }
    if (!window.confirm('Delete ALL Convoy / meetup history, participants, points and pair cooldowns for this family? This cannot be undone.')) return
    if (!window.confirm('Final confirmation: permanently clear all meetup data? Family accounts, chats, plans and places will stay.')) return
    setBusy(true)
    setNotice('')
    try {
      const { data, error } = await supabase.rpc('admin_clear_meetup_data', { fid: family.id, p_code: meetupCode })
      if (error) throw error
      setNotice(`Meetup data cleared. ${data?.meetups_deleted ?? 0} meetups, ${data?.point_records_deleted ?? 0} point records and ${data?.pair_cooldowns_deleted ?? 0} pair cooldowns deleted.`)
      setMeetupCode('')
      void loadOverview()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not clear meetup data.')
    } finally { setBusy(false) }
  }


  const tiles: { id: Section; icon: IconName; title: string; hint: string }[] = [
    { id: 'app', icon: 'megaphone', title: 'App status', hint: settings?.maintenanceEnabled ? 'Maintenance is ON' : settings?.announcementEnabled ? 'Banner is live' : 'Live for everyone' },
    { id: 'announcements', icon: 'megaphone', title: 'Announcements', hint: announcements.length ? `${announcements.length} announcement${announcements.length === 1 ? '' : 's'} · popup editor` : 'Create poster-based in-app announcements' },\n    { id: 'downloads', icon: 'download', title: 'Downloads', hint: settings?.apkDownloadEnabled ? 'Website sends visitors to the app' : 'Website sign-in is open' },
    { id: 'updates', icon: 'phone', title: 'Updates', hint: settings && settings.minBuild > 0 ? `Build ${settings.minBuild}+ required` : 'No forced update' },
    { id: 'builds', icon: 'download', title: 'APK Builds', hint: 'Android APK build history, artifacts and releases' },
    { id: 'pages', icon: 'list', title: 'GitHub Pages Deployments', hint: 'Website deployment history and status' },
    { id: 'family', icon: 'family', title: isOwner ? 'Users' : 'Family', hint: isOwner && users ? `${users.length} user${users.length === 1 ? '' : 's'} · family tools` : `${members.length} member${members.length === 1 ? '' : 's'} · invite code` },
    { id: 'previews', icon: 'phone', title: 'Previews', hint: 'See what everyone sees: maintenance, banner, download' },
    { id: 'reminders', icon: 'bell', title: 'Test reminders', hint: 'Send a sample birthday reminder to this phone' },
    { id: 'share', icon: 'share', title: 'Share the app', hint: 'A banner and pitch to send to anyone' },
    { id: 'notify', icon: 'bell', title: 'Notify', hint: 'Send a notification to every phone' },
    { id: 'messages', icon: 'chat', title: 'Messages', hint: overview ? `${overview.messages_total} total · ${overview.messages_today} today` : 'Moderate the family chat' },
    { id: 'data', icon: 'irl', title: 'Meetup data', hint: 'Clear Convoy meetups, check-ins and points' },
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

          <div className="flex flex-col gap-3" aria-label="Manage">
            {[
              { title: 'App & Website', hint: 'Status, downloads, updates and sharing', ids: ['app', 'announcements', 'downloads', 'updates', 'previews', 'share'] as Section[] },
              { title: 'Builds & Deployments', hint: 'Android APKs and website publishing', ids: ['builds', 'pages'] as Section[] },
              { title: 'Family & Communication', hint: 'Members, messages, notifications and reminders', ids: ['family', 'messages', 'notify', 'reminders'] as Section[] },
              { title: 'Data & Maintenance', hint: 'Meetup history and family data tools', ids: ['data'] as Section[] },
            ].map((group, index) => (
              <details key={group.title} className="card !p-0 overflow-hidden" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{group.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{group.hint}</p>
                  </div>
                  <span className="text-xs text-muted">{group.ids.length}</span>
                  <span aria-hidden="true" className="text-muted transition-transform">⌄</span>
                </summary>
                <div className="flex flex-col divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {group.ids.map((id) => {
                    const tile = tiles.find((item) => item.id === id)
                    if (!tile) return null
                    return (
                      <button key={tile.id} type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => open(tile.id)}>
                        <Icon name={tile.icon} size={19} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight">{tile.title}</p>
                          <p className="truncate text-xs text-muted">{tile.hint}</p>
                        </div>
                        <span aria-hidden="true" className="menu-chevron">›</span>
                      </button>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>
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

      {isOwner && current === 'share' && <ShareAppCard />}\n\n      {isOwner && current === 'announcements' && (\n        <section className="flex flex-col gap-3" aria-label="Manage announcements">\n          <div className="card flex flex-col gap-3">\n            <div className="flex items-center justify-between gap-3"><p className="eyebrow">{editingAnnouncement ? 'Edit announcement' : 'Create announcement'}</p>{editingAnnouncement && <button type="button" className="text-xs font-semibold text-accent-text" onClick={resetAnnouncementForm}>New</button>}</div>\n            <label className="label" htmlFor="announcement-title">Title</label>\n            <input id="announcement-title" className="input" maxLength={90} value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} placeholder="A new feature is here" />\n            <label className="label" htmlFor="announcement-body">Message</label>\n            <textarea id="announcement-body" className="input min-h-20" maxLength={500} value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} placeholder="Tell everyone what's new…" />\n            <label className="label" htmlFor="announcement-poster">Poster image (JPG, PNG or WebP · max 10 MB)</label>\n            <input id="announcement-poster" className="input !h-auto !py-2" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setAnnouncementFile(e.target.files?.[0] ?? null)} />\n            {announcementFile && <p className="text-xs text-muted">Selected: {announcementFile.name}</p>}\n            {announcementImage && !announcementFile && <img src={announcementImage} alt="Current announcement poster" className="max-h-48 w-full rounded-xl object-cover" />}\n            <label className="label" htmlFor="announcement-action-label">Optional button label</label>\n            <input id="announcement-action-label" className="input" maxLength={32} value={announcementActionLabel} onChange={(e) => setAnnouncementActionLabel(e.target.value)} placeholder="See what's new" />\n            <label className="label" htmlFor="announcement-action-url">Button link (https://… or an app path such as /?plan=…)</label>\n            <input id="announcement-action-url" className="input" maxLength={500} value={announcementActionUrl} onChange={(e) => setAnnouncementActionUrl(e.target.value)} placeholder="https://…" />\n            <div className="grid grid-cols-2 gap-2">\n              <div className="flex flex-col gap-1"><label className="label" htmlFor="announcement-start">Start (optional)</label><input id="announcement-start" className="input min-w-0" type="datetime-local" value={announcementStarts} onChange={(e) => setAnnouncementStarts(e.target.value)} /></div>\n              <div className="flex flex-col gap-1"><label className="label" htmlFor="announcement-end">End (optional)</label><input id="announcement-end" className="input min-w-0" type="datetime-local" value={announcementEnds} onChange={(e) => setAnnouncementEnds(e.target.value)} /></div>\n            </div>\n            <div className="grid grid-cols-2 gap-2"><button type="button" className="btn btn-plain" disabled={busy} onClick={() => void saveAnnouncement(false)}>Save draft</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveAnnouncement(true)}>{busy ? 'Saving…' : 'Publish'}</button></div>\n            <p className="text-xs text-muted">Published announcements appear as a popup for each user until that user dismisses them. Start/end times are optional. A new announcement is shown on the next app entry.</p>\n          </div>\n          <div className="card flex flex-col gap-3">\n            <div className="flex items-center justify-between"><p className="eyebrow">All announcements</p><button type="button" className="btn btn-plain !min-h-9 !px-3 !text-xs" disabled={announcementLoading} onClick={() => void loadAnnouncements()}>Refresh</button></div>\n            {announcementLoading && <p className="text-sm text-muted">Loading…</p>}\n            {announcements.map((item) => <div key={item.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">\n              {item.image_url && <img src={item.image_url} alt="" className="h-16 w-20 rounded-lg object-cover" />}\n              <div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p><p className="text-xs text-muted">{item.published ? 'Published' : 'Draft'} · {new Date(item.created_at).toLocaleDateString()}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" className="text-xs font-semibold text-accent-text" onClick={() => editAnnouncement(item)}>Edit</button><button type="button" className="text-xs font-semibold text-accent-text" disabled={busy} onClick={() => void toggleAnnouncement(item)}>{item.published ? 'Unpublish' : 'Publish'}</button><button type="button" className="text-xs font-semibold text-danger" disabled={busy} onClick={() => void deleteAnnouncement(item)}>Delete</button></div></div>\n            </div>)}\n            {!announcementLoading && announcements.length === 0 && <p className="text-sm text-muted">No announcements yet.</p>}\n          </div>\n        </section>\n      )}

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


      {isOwner && current === 'builds' && (
        <section className="flex flex-col gap-3" aria-label="APK builds">
          <div className="card flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Latest APK release</p>
                <p className="text-sm font-bold">{buildRelease?.name || 'No published release'}</p>
                {buildRelease?.body && <p className="text-xs text-muted">{buildRelease.body}</p>}
              </div>
              <button type="button" className="btn btn-plain !min-h-9 !px-3 !text-xs" disabled={buildsLoading} onClick={() => void loadBuilds()}><Icon name="refresh" size={16} /> Refresh</button>
            </div>
            {buildRelease?.assets.map((a) => (
              <p key={a.id} className="text-xs text-muted">{a.name} · {(a.size / 1048576).toFixed(1)} MB · {a.download_count} downloads</p>
            ))}
            {buildRelease && (
              <button type="button" className="btn btn-plain !min-h-10 !text-sm" disabled={busy} onClick={() => void manageBuild('delete_latest_release', {}, 'Delete the Latest Cznnect APK release and its tag? The in-app update checker will stop finding a new APK until the next successful build. This does not delete source code.')}>Delete latest APK release</button>
            )}
          </div>
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="eyebrow">APK workflow runs</p>
              <span className="text-xs text-muted">{buildRuns.filter((run) => /apk/i.test(run.name)).length} shown</span>
            </div>
            {buildsError && <p role="alert" className="text-sm text-danger">{buildsError}</p>}
            {buildsLoading && <p className="text-sm text-muted">Loading APK builds…</p>}
            {!buildsLoading && buildRuns.filter((run) => /apk/i.test(run.name)).map((run) => (
              <div key={run.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Build #{run.run_number} · {run.conclusion || run.status}</p>
                  <p className="text-xs text-muted">{new Date(run.created_at).toLocaleString()}</p>
                  <p className="text-xs text-muted">{run.head_sha.slice(0, 7)} · {run.event}</p>
                  <a className="text-xs font-semibold text-accent-text underline" href={run.html_url} target="_blank" rel="noreferrer">Open on GitHub</a>
                </div>
                <button type="button" className="btn btn-plain !min-h-9 shrink-0 !px-2 !text-xs" disabled={busy || run.status === 'in_progress' || run.status === 'queued'} onClick={() => void manageBuild('delete_run', { run_id: run.id }, `Delete APK build #${run.run_number}, its logs and attached artifacts? This cannot be undone.`)}>Delete</button>
              </div>
            ))}
            {!buildsLoading && !buildsError && buildRuns.filter((run) => /apk/i.test(run.name)).length === 0 && <p className="text-sm text-muted">No APK builds found.</p>}
            <p className="text-xs text-muted">Deleting a workflow run removes its logs and attached artifacts. It does not change the live app or delete source code.</p>
          </div>
        </section>
      )}

      {isOwner && current === 'pages' && (
        <section className="card flex flex-col gap-3" aria-label="GitHub Pages deployments">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">GitHub Pages</p>
              <p className="text-sm text-muted">Website deployment runs, separate from Android APK builds.</p>
            </div>
            <button type="button" className="btn btn-plain !min-h-9 !px-3 !text-xs" disabled={buildsLoading} onClick={() => void loadBuilds()}><Icon name="refresh" size={16} /> Refresh</button>
          </div>
          {buildsError && <p role="alert" className="text-sm text-danger">{buildsError}</p>}
          {buildsLoading && <p className="text-sm text-muted">Loading deployments…</p>}
          {!buildsLoading && buildRuns.filter((run) => /pages/i.test(run.name)).map((run) => (
            <div key={run.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="font-bold">Deployment #{run.run_number} · {run.conclusion || run.status}</p>
                <p className="text-xs text-muted">{new Date(run.created_at).toLocaleString()}</p>
                <p className="text-xs text-muted">{run.head_sha.slice(0, 7)} · {run.event}</p>
                <a className="text-xs font-semibold text-accent-text underline" href={run.html_url} target="_blank" rel="noreferrer">Open on GitHub</a>
              </div>
              <button type="button" className="btn btn-plain !min-h-9 shrink-0 !px-2 !text-xs" disabled={busy || run.status === 'in_progress' || run.status === 'queued'} onClick={() => void manageBuild('delete_run', { run_id: run.id }, `Delete Pages deployment #${run.run_number} and its logs? This cannot be undone.`)}>Delete</button>
            </div>
          ))}
          {!buildsLoading && !buildsError && buildRuns.filter((run) => /pages/i.test(run.name)).length === 0 && <p className="text-sm text-muted">No Pages deployments found.</p>}
          <p className="text-xs text-muted">Deleting a deployment run removes its logs. It does not remove the published website or repository files.</p>
        </section>
      )}

      {isOwner && current === 'updates' && (
        <section className="card flex flex-col gap-3">
                <p className="eyebrow">Tell Android users an update is ready</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><span className="text-muted">Your build</span><br /><b>{myBuild ? `build ${myBuild}` : 'website / local'}</b></p>
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
                      <p className="truncate font-bold">{name}{u.user_id === userId ? ' (you)' : ''}<TitleBadge title={u.title} /></p>
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

      {isOwner && current === 'data' && (
        <section className="card flex flex-col gap-3" aria-label="Clear meetup data">
          <p className="eyebrow">Danger zone · Convoy</p>
          <p className="text-sm text-muted">Permanently deletes this family’s meetup history, participant confirmations, points ledger and pair cooldown records. Family accounts, QR identities, chats, plans, places and other app data are not affected.</p>
          <label className="label" htmlFor="admin-meetup-code">4-digit confirmation code</label>
          <input id="admin-meetup-code" className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={meetupCode} onChange={(e) => setMeetupCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Enter code" />
          <button type="button" className="btn btn-plain !min-h-11 !text-sm" disabled={busy || meetupCode.length !== 4} onClick={() => void clearMeetupData()}>Clear all meetup data</button>
          <p className="text-xs text-muted">This action cannot be undone. The owner account is checked by the database; the code is an additional confirmation step.</p>
        </section>
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
            <ServiceNotice preview title="Back soon" message={maintMessage.trim() || DEFAULT_MAINTENANCE_MESSAGE} onUnlock={() => {}} />
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
