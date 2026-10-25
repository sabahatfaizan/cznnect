import { useEffect, useState } from 'react'
import type { Family } from '../types'
import { supabase } from '../supabase'
import Home from '../pages/Home'
import Profile from '../pages/Profile'
import Explore from '../pages/Explore'
import Plans from '../pages/Plans'
import Tree from '../pages/Tree'
import Irl from '../pages/Irl'
import { Icon, type IconName } from './Icons'

type Tab = 'home' | 'tree' | 'explore' | 'plans' | 'me' | 'irl'
const OWNER_EMAIL = 'faizanplayz11@gmail.com'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'tree', label: 'Family Tree', icon: 'tree' },
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
  const isOwner = email.toLowerCase() === OWNER_EMAIL
  const current: Tab = tab === 'irl' ? 'home' : tab

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
      <main className="p-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl font-extrabold">Cznnect</p>
            <p className="text-xs text-muted">Family, connected.</p>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-current transition hover:bg-surface/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="cznnect-main-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
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
        {menuOpen && <section id="cznnect-main-menu" className="card mb-4" aria-label="Main menu">
          <p className="eyebrow mb-2">Menu</p>
          <div className="grid gap-1">
            {([
              ['home', 'Home'],
              ['tree', 'Family Tree'],
              ['explore', 'Explore'],
              ['plans', 'Plans'],
              ['me', 'My Profile'],
            ] as { id: Tab; label: string }[]).map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-surface/70"
                onClick={() => { setTab(item.id); setMenuOpen(false) }}
              >
                <span>{item.label}</span>
                <span aria-hidden="true" className="text-muted">›</span>
              </button>
            ))}
          </div>
          {userId && isOwner && <div className="mt-4 border-t border-line pt-4">
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
        </section>}
        {tab === 'home' && (
          <div className="flex flex-col gap-4">
            <button type="button" className="card irl-entry flex items-center justify-between gap-3 text-left" onClick={() => setTab('irl')}>
              <span>
                <span className="eyebrow block">IRL Connect</span>
                <span className="block font-display text-lg font-bold">Met a cousin today?</span>
                <span className="block text-sm text-muted">Scan, confirm together, and earn points.</span>
              </span>
              <span aria-hidden="true" className="flex-none font-display text-2xl font-extrabold text-accent-text">→</span>
            </button>
            <Home family={family} userId={userId} onFamilyChanged={onFamilyChanged} />
          </div>
        )}
        {tab === 'irl' && <Irl family={family} userId={userId} onBack={() => setTab('home')} />}
        {tab === 'tree' && <Tree family={family} userId={userId} />}
        {tab === 'explore' && <Explore family={family} userId={userId} />}
        {tab === 'plans' && <Plans family={family} userId={userId} />}
        {tab === 'me' && <Profile userId={userId} />}
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-2 py-1.5">
          {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} aria-current={current === t.id ? 'page' : undefined} className={`tab ${current === t.id ? 'tab-active' : ''}`}><Icon name={t.icon} />{t.label}</button>)}
        </div>
      </nav>
    </div>
  )
}
