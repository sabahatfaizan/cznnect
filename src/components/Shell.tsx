import { useState } from 'react'
import type { Family } from '../types'
import Home from '../pages/Home'
import Profile from '../pages/Profile'
import ComingSoon from '../pages/ComingSoon'
import Explore from '../pages/Explore'
import Tree from '../pages/Tree'
import { Icon, type IconName } from './Icons'

type Tab = 'home' | 'tree' | 'explore' | 'plans' | 'me'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'tree', label: 'Family Tree', icon: 'tree' },
  { id: 'explore', label: 'Explore', icon: 'explore' },
  { id: 'plans', label: 'Plans', icon: 'plans' },
  { id: 'me', label: 'My Profile', icon: 'me' },
]

// The app frame: current page on top, five tabs along the bottom.
export default function Shell({
  family,
  userId,
  onFamilyChanged,
}: {
  family: Family
  userId: string
  onFamilyChanged: () => void
}) {
  const [tab, setTab] = useState<Tab>('home')

  return (
    <div className="mx-auto min-h-full max-w-xl">
      <main className="p-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))]">
        {tab === 'home' && <Home family={family} userId={userId} onFamilyChanged={onFamilyChanged} />}
        {tab === 'tree' && <Tree family={family} userId={userId} />}
        {tab === 'explore' && <Explore family={family} userId={userId} />}
        {tab === 'plans' && (
          <ComingSoon
            title="Plans"
            stage={5}
            blurb="Bucket lists and things to do together."
            items={['Monthly, yearly and lifetime lists', 'Assign tasks, set deadlines, vote on ideas', 'Finished plans become shared memories']}
          />
        )}
        {tab === 'me' && <Profile userId={userId} />}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-2 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            >
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
