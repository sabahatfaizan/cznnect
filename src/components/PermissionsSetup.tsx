import { useEffect, useState } from 'react'
import { callPlugin, isNative } from '../lib/native'
import { Icon, type IconName } from './Icons'

// Shown once, the first time the Android app is opened: asks for everything the app uses in one go, so nothing
// pops up unexpectedly later. Each one can still be changed in the phone's settings.
const KEY = 'cznnect-perms-asked'
type State = 'idle' | 'asking' | 'allowed' | 'blocked'

function asked(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}
function markAsked() {
  try { localStorage.setItem(KEY, '1') } catch { /* the question may be asked again next time */ }
}

const ITEMS: { id: 'notifications' | 'camera' | 'location'; label: string; why: string; icon: IconName }[] = [
  { id: 'notifications', label: 'Notifications', why: 'Birthday reminders, new messages and event updates.', icon: 'bell' },
  { id: 'camera', label: 'Camera', why: 'Scan QR codes to join events and meet up in Convoy.', icon: 'camera' },
  { id: 'location', label: 'Location', why: 'Add places to the map from where you are standing.', icon: 'irl' },
]

async function ask(id: (typeof ITEMS)[number]['id']): Promise<boolean> {
  try {
    if (id === 'notifications') {
      const r = (await callPlugin('LocalNotifications', 'requestPermissions')) as { display?: string }
      return r?.display === 'granted'
    }
    if (id === 'camera') {
      if (!navigator.mediaDevices?.getUserMedia) return false
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      stream.getTracks().forEach((t) => t.stop())
      return true
    }
    if (!('geolocation' in navigator)) return false
    return await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(() => resolve(true), () => resolve(false), { timeout: 20000 })
    })
  } catch {
    return false
  }
}

export default function PermissionsSetup() {
  const [show, setShow] = useState(false)
  const [state, setState] = useState<Record<string, State>>({})
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isNative() || asked()) return
    const t = window.setTimeout(() => setShow(true), 4800) // after the opening animation
    return () => window.clearTimeout(t)
  }, [])

  if (!show) return null

  async function allowAll() {
    setRunning(true)
    for (const item of ITEMS) {
      setState((s) => ({ ...s, [item.id]: 'asking' }))
      const ok = await ask(item.id)
      setState((s) => ({ ...s, [item.id]: ok ? 'allowed' : 'blocked' }))
    }
    markAsked()
    setRunning(false)
    setDone(true)
  }
  function close() { markAsked(); setShow(false) }

  return (
    <div role="dialog" aria-modal="true" aria-label="Allow permissions" className="fixed inset-0 z-[110] flex flex-col overflow-y-auto bg-surface px-5 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Set up Cznnect</h1>
          <p className="mt-1 text-sm text-muted">Allow these now so everything works the first time. You can change them any time in your phone's settings.</p>
        </div>
        <ul className="flex flex-col gap-3">
          {ITEMS.map((item) => {
            const st = state[item.id] ?? 'idle'
            return (
              <li key={item.id} className="card flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line"><Icon name={item.icon} size={22} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">{item.label}</p>
                  <p className="text-sm text-muted">{item.why}</p>
                </div>
                <span className="shrink-0 text-xs font-bold" aria-live="polite">
                  {st === 'asking' ? 'Asking…' : st === 'allowed' ? 'Allowed' : st === 'blocked' ? 'Not allowed' : ''}
                </span>
              </li>
            )
          })}
        </ul>
        {done && <p role="status" className="text-sm text-muted">Done. Anything marked Not allowed can be turned on later in your phone's Settings, under Apps, Cznnect, Permissions.</p>}
        {done ? (
          <button type="button" className="btn btn-primary !min-h-12" onClick={close}>Continue</button>
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" className="btn btn-primary !min-h-12" disabled={running} onClick={() => void allowAll()}>{running ? 'Asking…' : 'Allow'}</button>
            <button type="button" className="btn btn-plain !min-h-11 !text-sm" disabled={running} onClick={close}>Not now</button>
          </div>
        )}
      </div>
    </div>
  )
}
