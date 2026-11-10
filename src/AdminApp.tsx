import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { registerPush } from './lib/push'
import { signOut } from './lib/push'
import { setEntryMode } from './lib/entryMode'
import { Icon } from './components/Icons'
import Splash from './components/Splash'
import Admin from './pages/Admin'
import type { Family } from './types'

// The Administrator side of the app: a supervisor console with no family tabs. Everything that used to sit in the
// family menu's Admin page lives here now.
export default function AdminApp({ userId, live }: { userId: string; live: boolean }) {
  const [family, setFamily] = useState<Family | null | undefined>(undefined)

  useEffect(() => { if (live) void registerPush() }, [live, userId])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('family_members')
      .select('families(id, name, invite_code)')
      .eq('user_id', userId)
      .order('joined_at')
      .limit(1)
      .maybeSingle()
    setFamily((data?.families as unknown as Family | undefined) ?? null)
  }, [userId])

  useEffect(() => { void load() }, [load])

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4 pb-[calc(max(2rem,env(safe-area-inset-bottom))+3rem)] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"><Icon name="admin" size={22} /></span>
          <div className="min-w-0">
            <p className="font-display text-base font-bold leading-tight">Cznnect Admin</p>
            <p className="text-xs text-muted">Administrator</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-plain !min-h-9 !w-11 !px-0" aria-label="Switch to Family" title="Switch to Family" onClick={() => setEntryMode('family')}><Icon name="swap" size={20} /></button>
          <button type="button" className="btn btn-plain !min-h-9 !px-3 !text-xs" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>

      {family === undefined && <Splash />}
      {family === null && (
        <div className="card flex flex-col gap-3">
          <p className="font-bold">No family yet</p>
          <p className="text-sm text-muted">The member and chat tools need a family. Enter as Family once to create or join one, then come back.</p>
          <button type="button" className="btn btn-primary !min-h-11 w-full !text-sm" onClick={() => setEntryMode('family')}>Enter as Family</button>
        </div>
      )}
      {family && <Admin family={family} userId={userId} isOwner onFamilyChanged={() => void load()} />}

      {/* A soft fade over the strip under the Android buttons, so scrolling controls dim away instead of running behind them. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20"
        style={{
          height: 'calc(max(env(safe-area-inset-bottom), 24px) + 32px)',
          background: 'linear-gradient(to top, var(--page) 0%, color-mix(in srgb, var(--page) 88%, transparent) 40%, transparent 100%)',
        }}
      />
    </div>
  )
}
