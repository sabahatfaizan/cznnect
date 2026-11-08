import Logo from './Logo'
import { Icon, type IconName } from './Icons'
import { signOut } from '../lib/push'
import { setEntryMode, type EntryMode } from '../lib/entryMode'

// Shown only to the owner after signing in: one email, two ways in. No code is asked; every admin action is still
// checked on the server against the owner's email.
export default function EntryChooser() {
  const choose = (mode: EntryMode) => setEntryMode(mode)

  const options: Array<{ mode: EntryMode; icon: IconName; title: string; hint: string }> = [
    { mode: 'admin', icon: 'admin', title: 'Administrator', hint: 'Supervise and control the whole app' },
    { mode: 'family', icon: 'group', title: 'Family', hint: 'Use Cznnect as a family member' },
  ]

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col p-6">
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="flex flex-col gap-2">
          <Logo />
          <h1 className="font-display text-2xl font-extrabold leading-tight">How do you want to enter?</h1>
          <p className="text-sm text-muted">Same account, two ways in. You can switch later from the menu.</p>
        </div>

        {(
          <>
            <div className="flex flex-col gap-3">
              {options.map((o) => (
                <button key={o.mode} type="button" className="card flex items-center gap-4 text-left transition active:scale-[0.99]" onClick={() => choose(o.mode)}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text"><Icon name={o.icon} size={24} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-bold leading-tight">{o.title}</span>
                    <span className="block text-sm text-muted">{o.hint}</span>
                  </span>
                  <span aria-hidden="true" className="menu-chevron">›</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-plain !min-h-11 w-full !text-sm" onClick={() => void signOut()}>Sign out</button>
          </>
        )}
      </div>
      <p className="pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-muted">© 2026 Sabahat Faizan. All rights reserved.</p>
    </div>
  )
}
