import FamilyBell from './FamilyBell'
import { useBackClose } from '../lib/backStack'
import OfflineBanner from './OfflineBanner'
import UpdatePrompt from './UpdatePrompt'
import { useEffect, useRef, useState } from 'react'
import type { Family } from '../types'
import { supabase } from '../supabase'
import Home from '../pages/Home'
import Profile from '../pages/Profile'
import Explore from '../pages/Explore'
import Plans from '../pages/Plans'
import Tree from '../pages/Tree'
import Irl from '../pages/Irl'
import Scoreboard from '../pages/Scoreboard'
import Birthdays from '../pages/Birthdays'
import Music from '../pages/Music'
import { rank, useFamilyBirthdays } from '../lib/birthdays'
import { loadPrefs, runReminders } from '../lib/birthdayReminders'
import { useChatPulse, useHeartbeat } from '../lib/pulse'
import Settings from '../pages/Settings'
import Chat from '../pages/Chat'
import Admin from '../pages/Admin'
import { setEntryMode } from '../lib/entryMode'
import { useAppSettings } from '../lib/appSettings'
import { Icon, type IconName } from './Icons'
import { Wordmark } from './Logo'
import { setGlassAllowed } from '../theme'
import { isOwnerEmail } from '../owner'
import SecretCoin from './SecretCoin'
import UnlockToast from './UnlockToast'

type Tab = 'home' | 'tree' | 'explore' | 'plans' | 'me' | 'irl' | 'scoreboard' | 'chat' | 'birthdays' | 'settings' | 'music' | 'admin'
// Taglines for the Red Dead and Uncharted screen banners. Other themes hide the banner.
const BANNERS: Record<Tab, { rdr2: string; unc: string }> = {
  home: { rdr2: 'Camp', unc: 'Expedition Base' },
  tree: { rdr2: 'Kin', unc: 'The Lineage Chart' },
  explore: { rdr2: 'Scouting', unc: 'Uncharted Territory' },
  plans: { rdr2: 'Next Job', unc: 'The Next Expedition' },
  birthdays: { rdr2: 'Marked Days', unc: 'Dates in the Journal' },
  me: { rdr2: 'Wanted', unc: "Explorer's Dossier" },
  irl: { rdr2: 'Riding', unc: 'The Field Team' },
  chat: { rdr2: 'Camp Talk', unc: 'Radio Channel' },
  scoreboard: { rdr2: 'Bounties', unc: 'Treasure Tally' },
  settings: { rdr2: 'Supplies', unc: 'Gear & Supplies' },
  music: { rdr2: 'Campfire Songs', unc: 'The Soundtrack' },
  admin: { rdr2: 'The Law', unc: 'Command Post' },
}
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'irl', label: 'Convoy', icon: 'irl' },
  { id: 'explore', label: 'Explore', icon: 'explore' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'me', label: 'Profile', icon: 'me' },
]

const SECRET_HOLD_MS = 4000

export default function Shell({ family, userId, email, onFamilyChanged }: { family: Family; userId: string; email: string; onFamilyChanged: () => void }) {
  const [tab, setTab] = useState<Tab>('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const isOwner = isOwnerEmail(email)
  // The family role (owner / moderator / member) decides who gets the Admin page's member tools.
  const [familyRole, setFamilyRole] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void supabase.from('family_members').select('role').eq('family_id', family.id).eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (alive) setFamilyRole((data as { role?: string } | null)?.role ?? null)
    })
    return () => { alive = false }
  }, [family.id, userId])
  // The owner's admin tools live in the Administrator side now; family moderators keep their member tools here.
  const canAdmin = !isOwner && familyRole === 'moderator'
  const { settings: appSettings } = useAppSettings()

  // Birthdays: one query feeds the menu badge, the device reminders and the Birthdays page.
  const bday = useFamilyBirthdays(family.id, userId)
  const upcoming = rank(bday.people).upcoming
  const chatPulse = useChatPulse(family.id, userId)
  useHeartbeat()
  const soon = upcoming.filter((u) => u.days <= 7)
  const dueNow = upcoming.some((u) => u.days <= 1)
  useEffect(() => {
    if (bday.loaded) runReminders(rank(bday.people).upcoming, loadPrefs())
  }, [bday.loaded, bday.people])
  const current: Tab = tab
  // Android Back: close the menu first, then return to Home from any other screen. Only Home lets Back leave the app.
  useBackClose(() => setMenuOpen(false), menuOpen)
  useBackClose(() => setTab('home'), tab !== 'home')
  const [musicUnlocked, setMusicUnlocked] = useState(false)
  const holdTimer = useRef<number | undefined>(undefined)
  const heldOpen = useRef(false)
  const startHold = () => {
    heldOpen.current = false
    window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(() => { heldOpen.current = true; setMusicUnlocked(true); setTab('music') }, SECRET_HOLD_MS)
  }
  const cancelHold = () => window.clearTimeout(holdTimer.current)
  useEffect(() => cancelHold, [])

  // Shared plan links should route straight to Plans, not leave the user on Home.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('plan')) setTab('plans')
  }, [])

  // Liquid Glass is only allowed for the owner; anyone else is switched back to a dark fallback.
  useEffect(() => {
    setGlassAllowed(isOwner)
    return () => setGlassAllowed(false)
  }, [isOwner])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return (
    <div className="mx-auto min-h-full max-w-xl">
      <UnlockToast />
      <main data-tab={tab} className="p-4 pb-36 pt-[max(2.25rem,env(safe-area-inset-top),36px)]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
          <div>
            <div className="brand-default">
              <Wordmark className="font-display text-xl font-extrabold" />
            </div>
            {/* The pirate coin is the seven-tap secret for Red Dead. Only the Uncharted theme shows it. */}
            <SecretCoin />
            {/* Compact Red Dead wordmark; CSS applies the Chinese Rocks typeface only in this theme. */}
            <span className="brand-rdr2-text">Cznnect</span>
          </div>
          </div>
          <div className="flex items-center gap-2">
          <FamilyBell familyId={family.id} userId={userId} chat={chatPulse} nextBirthday={upcoming[0] ?? null} onOpen={setTab} />
          <button
            type="button"
            className="menu-btn flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-current transition hover:bg-surface/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={menuOpen ? 'Close menu' : dueNow ? 'Open menu, a birthday is today or tomorrow' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="cznnect-main-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {dueNow && !menuOpen && <span aria-hidden="true" className="menu-dot" />}
            {/* Always the hamburger: the menu covers this button when open, so swapping to an X only flashed through the scrim. */}
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          </div>
        </header>
        <OfflineBanner />
        <UpdatePrompt building={Boolean(appSettings?.buildInProgress)} />
        {appSettings?.announcementEnabled && appSettings.announcementText.trim() && (
          <p role="status" className="card mb-4 text-sm font-semibold">{appSettings.announcementText}</p>
        )}
        <div
          /* Toggle visibility, not opacity: an opacity fade on this wrapper would hold back the glass blur on the
             panel and scrim until the fade ended. Only the scrim fades, and the panel slides. */
          className={`fixed inset-0 z-50 transition-[visibility] duration-300 ${menuOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}
          aria-hidden={!menuOpen}
          data-open={menuOpen ? 'true' : 'false'}
        >
          <button
            type="button"
            tabIndex={menuOpen ? 0 : -1}
            aria-label="Close menu"
            className={`menu-scrim absolute inset-0 h-full w-full cursor-default bg-black/50 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setMenuOpen(false)}
          />
          <aside
            id="cznnect-main-menu"
            aria-label="Main menu"
            aria-modal="true"
            role="dialog"
            className={`menu-panel absolute right-2 top-2 flex h-[calc(100%-1rem)] w-[min(80vw,24rem)] flex-col overflow-y-auto rounded-3xl border border-line bg-surface p-5 pt-[max(1.25rem,env(safe-area-inset-top))] shadow-2xl transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-display text-xl font-extrabold">Menu</p>
              </div>
            </div>
            <div className="grid gap-1">
              {([
                { id: 'tree', label: 'Family Tree', icon: 'tree' },
                { id: 'plans', label: 'Plans', icon: 'plans' },
                { id: 'birthdays', label: 'Birthdays', icon: 'cake' },
              ] as { id: Tab; label: string; icon: IconName }[]).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`menu-item ${tab === item.id ? 'menu-item-on' : ''}`}
                  onClick={() => { setTab(item.id); setMenuOpen(false) }}
                >
                  <span className="menu-item-label"><Icon name={item.icon} size={22} />{item.label}</span>
                  {item.id === 'birthdays' && soon.length > 0 ? (
                    <span className="menu-badge" aria-label={`${soon.length} birthdays this week`}>{soon.length}</span>
                  ) : (
                    <span aria-hidden="true" className="menu-chevron">›</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                className={`menu-item ${tab === 'scoreboard' ? 'menu-item-on' : ''}`}
                onClick={() => { setTab('scoreboard'); setMenuOpen(false) }}
              >
                <span className="menu-item-label"><Icon name="trophy" size={22} />Scoreboard</span>
                <span aria-hidden="true" className="menu-chevron">›</span>
              </button>
            </div>
            <div className="mt-6 border-t border-line pt-8">
              <div className="pb-4"><p className="eyebrow px-3">Settings</p></div>
              <button
                type="button"
                className={`menu-item ${tab === 'settings' ? 'menu-item-on' : ''}`}
                onClick={() => { setTab('settings'); setMenuOpen(false) }}
              >
                <span className="menu-item-label"><Icon name="settings" size={22} />Settings</span>
                <span aria-hidden="true" className="menu-chevron">›</span>
              </button>
              {isOwner && (
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => { setMenuOpen(false); setEntryMode('admin') }}
                >
                  <span className="menu-item-label"><Icon name="admin" size={22} />Switch to Administrator</span>
                  <span aria-hidden="true" className="menu-chevron">›</span>
                </button>
              )}
              {canAdmin && (
                <button
                  type="button"
                  className={`menu-item ${tab === 'admin' ? 'menu-item-on' : ''}`}
                  onClick={() => { setTab('admin'); setMenuOpen(false) }}
                >
                  <span className="menu-item-label"><Icon name="admin" size={22} />Admin</span>
                  <span aria-hidden="true" className="menu-chevron">›</span>
                </button>
              )}
              {musicUnlocked && (
                <button
                  type="button"
                  className={`menu-item ${tab === 'music' ? 'menu-item-on' : ''}`}
                  onClick={() => { setTab('music'); setMenuOpen(false) }}
                >
                  <span className="menu-item-label"><Icon name="music" size={22} />Music</span>
                  <span aria-hidden="true" className="menu-chevron">›</span>
                </button>
              )}
            </div>
          </aside>
        </div>
        <div key={tab} className="screen-in">
          <div className="screen-banner" aria-hidden="true" data-rdr2={BANNERS[tab].rdr2} data-unc={BANNERS[tab].unc} />
          {tab === 'home' && <Home family={family} userId={userId} onFamilyChanged={onFamilyChanged} />}
          {tab === 'chat' && <Chat family={family} userId={userId} canDelete={familyRole === 'owner'} />}
          {tab === 'irl' && <Irl family={family} userId={userId} />}
          {tab === 'scoreboard' && <Scoreboard family={family} userId={userId} />}
          {tab === 'birthdays' && (
            <Birthdays people={bday.people} loaded={bday.loaded} error={bday.error} reload={bday.reload} onOpenProfile={() => setTab('me')} />
          )}
          {tab === 'tree' && <Tree family={family} userId={userId} onExit={() => setTab('home')} />}
          {tab === 'explore' && <Explore family={family} userId={userId} />}
          {tab === 'plans' && <Plans family={family} userId={userId} />}
          {tab === 'me' && <Profile userId={userId} />}
          {tab === 'settings' && <Settings family={family} userId={userId} onFamilyChanged={onFamilyChanged} />}
          {tab === 'admin' && canAdmin && <Admin family={family} userId={userId} isOwner={false} onFamilyChanged={onFamilyChanged} />}
        </div>
        {musicUnlocked && <div hidden={tab !== 'music'}><Music /></div>}
      </main>
      <nav aria-label="Main" className="app-nav fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-2 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { if (t.id === 'explore' && heldOpen.current) { heldOpen.current = false; return } setTab(t.id) }}
              {...(t.id === 'explore' ? { onPointerDown: startHold, onPointerUp: cancelHold, onPointerLeave: cancelHold, onPointerCancel: cancelHold, onContextMenu: (e: React.MouseEvent) => e.preventDefault() } : {})}
              aria-current={current === t.id ? 'page' : undefined}
              className={`tab ${current === t.id ? 'tab-active' : ''}`}
            >
              <span className="relative inline-flex">
                <Icon name={t.icon} />
                {t.id === 'chat' && chatPulse.unread > 0 && current !== 'chat' && (
                  <span aria-label={`${chatPulse.unread} new messages`} className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-[0.625rem] font-bold leading-4 text-accent-ink">
                    {chatPulse.unread > 9 ? '9+' : chatPulse.unread}
                  </span>
                )}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
