import { useEffect, useState } from 'react'
import type { Family } from '../types'
import { supabase } from '../supabase'
import Home from '../pages/Home'
import Profile from '../pages/Profile'
import Explore from '../pages/Explore'
import Plans from '../pages/Plans'
import Tree from '../pages/Tree'
import { Icon, type IconName } from './Icons'

type Tab = 'home' | 'tree' | 'explore' | 'plans' | 'me'
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
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceLoaded, setMaintenanceLoaded] = useState(false)
  const isOwner = email.toLowerCase() === OWNER_EMAIL

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
        {userId && isOwner && <section className="card mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Owner controls</p>
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
              className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-wait disabled:opacity-60 ${maintenanceEnabled ? 'border-amber-500 bg-amber-500' : 'border-line bg-surface-2'}`}
            >
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${maintenanceEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {notice && <p role="status" className="mt-3 text-sm text-muted">{notice}</p>}
        </section>}
        {tab === 'home' && <Home family={family} userId={userId} onFamilyChanged={onFamilyChanged} />}
        {tab === 'tree' && <Tree family={family} userId={userId} />}
        {tab === 'explore' && <Explore family={family} userId={userId} />}
        {tab === 'plans' && <Plans family={family} userId={userId} />}
        {tab === 'me' && <Profile userId={userId} />}
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-2 py-1.5">
          {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined} className={`tab ${tab === t.id ? 'tab-active' : ''}`}><Icon name={t.icon} />{t.label}</button>)}
        </div>
      </nav>
    </div>
  )
}
