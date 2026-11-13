import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'

// A one-time welcome from the app's creator for anyone who has just made an account. Accounts that are more than a
// few days old never see it, and each account sees it once (remembered on this device).
const NEW_FOR_MS = 3 * 86400_000
const key = (userId: string) => `cznnect-welcomed-${userId}`

function seen(userId: string): boolean {
  try { return localStorage.getItem(key(userId)) === '1' } catch { return true }
}

export default function WelcomeMessage({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId || seen(userId)) return
    let alive = true
    void supabase.auth.getUser().then((r: { data: { user: { created_at?: string } | null } }) => {
      const made = r.data.user?.created_at ? new Date(r.data.user.created_at).getTime() : 0
      if (alive && made && Date.now() - made < NEW_FOR_MS) setOpen(true)
    }).catch(() => {})
    return () => { alive = false }
  }, [userId])

  function close() {
    try { localStorage.setItem(key(userId), '1') } catch { /* it may show again next time */ }
    setOpen(false)
  }
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/65 p-5" role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Welcome to Cznnect" className="card flex w-full max-w-sm flex-col gap-3 !p-6">
        <p className="eyebrow">A message for you</p>
        <h2 className="font-display text-2xl font-extrabold">Welcome to Cznnect</h2>
        <p className="text-sm leading-relaxed">
          I built Cznnect to keep our family close: the tree, the places we have been, the plans we make and the events we share. I am really glad you are here.
        </p>
        <p className="text-sm leading-relaxed">
          Look around, add your story, and if anything is confusing or broken, tell me and I will fix it.
        </p>
        <p className="font-bold">Sabahat Faizan</p>
        <p className="-mt-2 text-xs text-muted">Creator of Cznnect</p>
        <button type="button" className="btn btn-primary !min-h-11" onClick={close}>Thank you</button>
      </div>
    </div>,
    document.body,
  )
}
