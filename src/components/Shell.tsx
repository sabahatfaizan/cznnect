import { useEffect, useState } from 'react'
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
import { rank, useFamilyBirthdays } from '../lib/birthdays'
import { loadPrefs, runReminders } from '../lib/birthdayReminders'
import Settings from '../pages/Settings'
import { Icon, type IconName } from './Icons'
import { setGlassAllowed } from '../theme'
import { isOwnerEmail } from '../owner'
import SecretCoin from './SecretCoin'
import UnlockToast from './UnlockToast'

type Tab = 'home' | 'tree' | 'explore' | 'plans' | 'me' | 'irl' | 'scoreboard' | 'birthdays' | 'settings'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'irl', label: 'Convoy', icon: 'irl' },
  { id: 'explore', label: 'Explore', icon: 'explore' },
  { id: 'plans', label: 'Plans', icon: 'plans' },
  { id: 'me', label: 'My Profile', icon: 'me' },
]

export default function Shell({ family, userId, email, onFamilyChanged }: { family: Family; userId: string; email: string; onFamilyChanged: () => void }) {
  const [tab, setTab] = useState<Tab>('home')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceLoaded, setMaintenanceLoaded] = useState(false)
  const isOwner = isOwnerEmail(email)

  // Birthdays: one query feeds the menu badge, the device reminders and the Birthdays page.
  const bday = useFamilyBirthdays(family.id, userId)
  const upcoming = rank(bday.people).upcoming
  const soon = upcoming.filter((u) => u.days <= 7)
  const dueNow = upcoming.some((u) => u.days <= 1)
  useEffect(() => {
    if (bday.loaded) runReminders(rank(bday.people).upcoming, loadPrefs())
  }, [bday.loaded, bday.people])
  const current: Tab = tab

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

  useEffect(() => {
    if (!isOwner) return
    let active = true
    void supabase.from('app_settings').select('maintenance_enabled').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (!active) return
      if (error) setNotice(error.message)
      else setMaintenanceEnabled(Boolean(data?.maintenance_enabled))
      setMaintenanceLoaded(true)
    })
    return () => { active = false }
  }, [isOwner])

  async function saveMaintenance(enabled: boolean) {
    let message = 'Cznnect is back online. Thanks for your patience!'
    if (enabled) {
      const entered = window.prompt('Message everyone will see:', 'We’re improving Cznnect. Please check back soon.')
      if (entered === null) return
      message = entered.trim() || 'We’re improving Cznnect. Please check back soon.'
    }
    setBusy(true)
    try {
      const { error } = await supabase.from('app_settings').update({ maintenance_enabled: enabled, maintenance_message: message, updated_at: new Date().toISOString() }).eq('id', 1)
      if (error) throw error
      setMaintenanceEnabled(enabled)
      setNotice(enabled ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update maintenance mode.')
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto min-h-full max-w-xl">
      <UnlockToast />
      <main data-tab={tab} className="p-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <span className="font-display text-lg font-bold">Cznnect</span>
            <SecretCoin />
          </div>
          <button
            type="button"
            className="menu-btn flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-current transition hover:bg-surface/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={menuOpen ? 'Close menu' : dueNow ? 'Open menu, a birthday is today or tomorrow' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="cznnect-main-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {dueNow && !menuOpen && <span aria-hidden="true" className="menu-dot" />}
            {menuOpen ? (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </header>
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-300 ${menuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
          aria-hidden={!menuOpen}
        >
          <button
            type="button"
            tabIndex={menuOpen ? 0 : -1}
            aria-label="Close menu"
            className="menu-scrim absolute inset-0 h-full w-full cursor-default bg-black/50"
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
                <p className="text-xs text-muted">Cznnect navigation</p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-current hover:bg-surface/70"
                onClick={() => setMenuOpen(false)}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="grid gap-1">
              {([
                { id: 'home', label: 'Home', icon: 'home' },
                { id: 'tree', label: 'Family Tree', icon: 'tree' },
                { id: 'explore', label: 'Explore', icon: 'explore' },
                { id: 'plans', label: 'Plans', icon: 'plans' },
                { id: 'birthdays', label: 'Birthdays', icon: 'cake' },
                { id: 'me', label: 'My Profile', icon: 'me' },
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
            <div className="mt-4 border-t border-line pt-4">
              <p className="eyebrow px-3 pb-1">Settings</p>
              <button
                type="button"
                className={`menu-item ${tab === 'settings' ? 'menu-item-on' : ''}`}
                onClick={() => { setTab('settings'); setMenuOpen(false) }}
              >
                <span className="menu-item-label"><Icon name="settings" size={22} />Settings</span>
                <span aria-hidden="true" className="menu-chevron">›</span>
              </button>
            </div>
            {userId && isOwner && <div className="mt-5 border-t border-line pt-5">
              <p className="eyebrow">Owner controls</p>
              <div className="mt-2 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold">Maintenance mode</p>
                  <p className="mt-1 text-sm text-muted">{maintenanceEnabled ? 'Visitors see the maintenance screen' : 'App is live for everyone'}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={maintenanceEnabled}
                  aria-label="Maintenance mode"
                  disabled={busy || !maintenanceLoaded}
                  onClick={() => void saveMaintenance(!maintenanceEnabled)}
                  className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-wait disabled:opacity-60 ${maintenanceEnabled ? 'border-red-500 bg-red-500' : 'border-green-500 bg-green-500'}`}
                >
                  <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${maintenanceEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              {notice && <p role="status" className="mt-3 text-sm text-muted">{notice}</p>}
            </div>}
          </aside>
        </div>
        {tab === 'home' && <Home family={family} userId={userId} onFamilyChanged={onFamilyChanged} />}
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
      </main>
      <nav aria-label="Main" className="app-nav fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-2 py-1.5">
          {TABS.map((t) => <button key={t.id} onClick={() => { setTab(t.id) }} aria-current={current === t.id ? 'page' : undefined} className={`tab ${current === t.id ? 'tab-active' : ''}`}><Icon name={t.icon} />{t.label}</button>)}
        </div>
      </nav>
    </div>
  )
}
