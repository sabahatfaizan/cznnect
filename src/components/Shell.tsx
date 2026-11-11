import FamilyBell from './FamilyBell'
import { useBackClose } from '../lib/backStack'
import OfflineBanner from './OfflineBanner'
import UpdatePrompt from './UpdatePrompt'
import AnnouncementPopup from './AnnouncementPopup'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { requestAdmin } from '../lib/entryMode'
import AddFamilySheet, { FamiliesButton, FamiliesModal } from './MyFamilies'
import { useAppSettings } from '../lib/appSettings'
import { Icon, type IconName } from './Icons'
import { Wordmark } from './Logo'
import SwipePager from './SwipePager'
import { setGlassAllowed } from '../theme'
import { isOwnerEmail } from '../owner'

type Tab = 'home' | 'tree' | 'explore' | 'plans' | 'me' | 'irl' | 'scoreboard' | 'chat' | 'birthdays' | 'settings' | 'music' | 'admin'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'irl', label: 'Convoy', icon: 'irl' },
  { id: 'explore', label: 'Explore', icon: 'explore' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'me', label: 'Profile', icon: 'me' },
]

const SWIPE_ORDER = TABS.map((t) => t.id)

// The header names the screen you are on, like WhatsApp: the Cznnect wordmark on Home, the page name everywhere else.
// The name flips instantly, about a fifth of the way into a swipe.
const TITLES: Record<Tab, string> = {
  home: 'Cznnect', irl: 'Convoy', explore: 'Explore', chat: 'Chat', me: 'Profile', plans: 'Plans', tree: 'Family Tree',
  scoreboard: 'Scoreboard', birthdays: 'Birthdays', settings: 'Settings', music: 'Music', admin: 'Admin',
}

const SECRET_HOLD_MS = 4000

export default function Shell({
  family,
  families,
  userId,
  email,
  onFamilyChanged,
  onSwitchFamily,
  onFamilyAdded,
}: {
  family: Family
  families: Family[]
  userId: string
  email: string
  onFamilyChanged: () => void
  onSwitchFamily: (id: string) => void
  onFamilyAdded: (id: string) => void
}) {
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

  // Header title: one label per swipeable page, positioned straight from the pager's scroll position (no re-renders).
  const inPager = SWIPE_ORDER.includes(tab)
  const titleEls = useRef<(HTMLElement | null)[]>([])
  const lastPos = useRef(0)
  const shown = useRef(0)
  const placeTitles = useCallback((pos: number) => {
    // No sliding: the name flips instantly once a swipe is ~20% of the way to the next page, whichever way you swipe.
    const prev = lastPos.current
    lastPos.current = pos
    let target = shown.current
    if (pos < 0) target = -1
    else if (prev < 0 || Math.abs(pos - prev) > 1.05) target = Math.round(pos)
    else if (pos > prev) target = Math.floor(pos + 0.8)
    else if (pos < prev) target = Math.ceil(pos - 0.8)
    target = Math.min(target, SWIPE_ORDER.length - 1)
    shown.current = target
    titleEls.current.forEach((el, i) => {
      if (!el) return
      const on = i === target
      el.style.opacity = on ? '1' : '0'
      el.setAttribute('aria-hidden', on ? 'false' : 'true')
    })
  }, [])
  // Convoy and Music are one-screen pages: the document cannot scroll while either is open.
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('static-page', tab === 'irl' || tab === 'music')
    return () => root.classList.remove('static-page')
  }, [tab])
  useLayoutEffect(() => { placeTitles(inPager ? SWIPE_ORDER.indexOf(tab) : -9) }, [tab, inPager, placeTitles])
  // Android Back: close the menu first, then return to Home from any other screen. Only Home lets Back leave the app.
  useBackClose(() => setMenuOpen(false), menuOpen)
  useBackClose(() => setTab('home'), tab !== 'home')
  const [musicUnlocked, setMusicUnlocked] = useState(false)
  const [addingFamily, setAddingFamily] = useState(false)
  const [familiesOpen, setFamiliesOpen] = useState(false)
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

  // Every screen the shell can show. The pager also asks for a neighbouring one while you swipe.
  function renderTab(t: Tab) {
    return (
      <>
          {t === 'home' && <Home family={family} userId={userId} onFamilyChanged={onFamilyChanged} />}
        {t === 'chat' && <Chat family={family} userId={userId} canDelete={familyRole === 'owner'} />}
        {t === 'irl' && <Irl family={family} userId={userId} />}
        {t === 'scoreboard' && <Scoreboard family={family} userId={userId} />}
        {t === 'birthdays' && (
          <Birthdays people={bday.people} loaded={bday.loaded} error={bday.error} reload={bday.reload} onOpenProfile={() => setTab('me')} />
        )}
        {t === 'tree' && <Tree family={family} userId={userId} onExit={() => setTab('home')} />}
        {t === 'explore' && <Explore family={family} userId={userId} />}
        {t === 'plans' && <Plans family={family} userId={userId} />}
        {t === 'me' && <Profile userId={userId} />}
        {t === 'settings' && <Settings family={family} userId={userId} onFamilyChanged={onFamilyChanged} />}
        {t === 'admin' && canAdmin && <Admin family={family} userId={userId} isOwner={false} onFamilyChanged={onFamilyChanged} />}
      </>
    )
  }

  return (
    <div className="mx-auto min-h-full max-w-xl">
      <main data-tab={tab} className="p-4 pb-36 pt-[max(2.25rem,env(safe-area-inset-top),36px)]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="hdr-stage" role="presentation">
            {SWIPE_ORDER.map((id, i) => (
              <div key={id} ref={(el) => { titleEls.current[i] = el }} className="hdr-title">
                {id === 'home' ? (
                  <div className="brand-default">
                    <Wordmark className="font-display text-xl font-extrabold" />
                  </div>
                ) : (
                  <h1 className="font-display text-xl font-extrabold">{TITLES[id]}</h1>
                )}
              </div>
            ))}
            {/* Screens outside the swipe row (opened from the menu) show their name straight away. */}
            {!inPager && (
              <div key={tab} className="hdr-title">
                <h1 className="font-display text-xl font-extrabold">{TITLES[tab]}</h1>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
          <FamilyBell familyId={family.id} userId={userId} chat={chatPulse} nextBirthday={upcoming[0] ?? null} onOpen={setTab} />
          {isOwner && (
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-current transition hover:bg-surface/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              aria-label="Switch to Administrator"
              title="Switch to Administrator"
              onClick={() => requestAdmin()}
            >
              <Icon name="swap" size={18} />
            </button>
          )}
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
        <UpdatePrompt building={Boolean(appSettings?.buildInProgress)} announcedBuild={appSettings?.announcedBuild ?? 0} />
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
            className={`menu-panel absolute right-2 top-2 flex h-[calc(100%-1rem)] w-[min(70vw,24rem)] flex-col overflow-y-auto rounded-3xl border border-line bg-surface p-5 pt-[max(1.25rem,env(safe-area-inset-top))] shadow-2xl transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
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
                    <span aria-hidden="true" className="menu-chevron"><Icon name="chevron" size={18} /></span>
                  )}
                </button>
              ))}
              <button
                type="button"
                className={`menu-item ${tab === 'scoreboard' ? 'menu-item-on' : ''}`}
                onClick={() => { setTab('scoreboard'); setMenuOpen(false) }}
              >
                <span className="menu-item-label"><Icon name="trophy" size={22} />Scoreboard</span>
                <span aria-hidden="true" className="menu-chevron"><Icon name="chevron" size={18} /></span>
              </button>
            </div>
            <div className="mt-6 border-t border-line pt-6">
              <FamiliesButton onOpen={() => { setMenuOpen(false); setFamiliesOpen(true) }} />
            </div>
            <div className="mt-6 border-t border-line pt-8">
              <div className="pb-4"><p className="eyebrow px-3">Settings</p></div>
              <button
                type="button"
                className={`menu-item ${tab === 'settings' ? 'menu-item-on' : ''}`}
                onClick={() => { setTab('settings'); setMenuOpen(false) }}
              >
                <span className="menu-item-label"><Icon name="settings" size={22} />Settings</span>
                <span aria-hidden="true" className="menu-chevron"><Icon name="chevron" size={18} /></span>
              </button>
              {isOwner && (
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => { setMenuOpen(false); requestAdmin() }}
                >
                  <span className="menu-item-label"><Icon name="admin" size={22} />Admin</span>
                  <span aria-hidden="true" className="menu-chevron"><Icon name="chevron" size={18} /></span>
                </button>
              )}
              {canAdmin && (
                <button
                  type="button"
                  className={`menu-item ${tab === 'admin' ? 'menu-item-on' : ''}`}
                  onClick={() => { setTab('admin'); setMenuOpen(false) }}
                >
                  <span className="menu-item-label"><Icon name="admin" size={22} />Admin</span>
                  <span aria-hidden="true" className="menu-chevron"><Icon name="chevron" size={18} /></span>
                </button>
              )}
              {musicUnlocked && (
                <button
                  type="button"
                  className={`menu-item ${tab === 'music' ? 'menu-item-on' : ''}`}
                  onClick={() => { setTab('music'); setMenuOpen(false) }}
                >
                  <span className="menu-item-label"><Icon name="music" size={22} />Music</span>
                  <span aria-hidden="true" className="menu-chevron"><Icon name="chevron" size={18} /></span>
                </button>
              )}
            </div>
          </aside>
        </div>
        {familiesOpen && <FamiliesModal families={families} activeId={family.id} onSwitch={onSwitchFamily} onAdd={() => { setFamiliesOpen(false); setAddingFamily(true) }} onClose={() => setFamiliesOpen(false)} />}
        {addingFamily && <AddFamilySheet count={families.length} onAdded={onFamilyAdded} onClose={() => setAddingFamily(false)} />}
        <SwipePager order={SWIPE_ORDER} current={tab} enabled={SWIPE_ORDER.includes(tab) && !menuOpen && !familiesOpen && !addingFamily} onChange={setTab} onProgress={placeTitles} render={renderTab} />
        {musicUnlocked && <div hidden={tab !== 'music'}><Music /></div>}
      </main>
      <AnnouncementPopup userId={userId} live={true} />
      <nav aria-label="Main" className="app-nav fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-2 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-tab-id={t.id}
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
