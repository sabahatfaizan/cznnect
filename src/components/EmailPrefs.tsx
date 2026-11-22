import { useEffect, useState } from 'react'
import { EMAIL_CATEGORIES, type EmailCategory } from '../lib/emailCategories'
import { myOptOuts, setMyOptOut } from '../lib/customEmails'

// Settings > Emails: a person turns each kind of email on or off for themselves.
export default function EmailPrefs({ userId }: { userId: string }) {
  const [off, setOff] = useState<Set<string> | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => { void myOptOuts(userId).then((s) => { if (s) setOff(s); else setErr('Email settings are not ready yet. Try again later.') }) }, [userId])

  async function flip(id: EmailCategory) {
    if (!off) return
    const turnOff = !off.has(id)
    setOff((p) => { const n = new Set(p); if (turnOff) n.add(id); else n.delete(id); return n })
    const ok = await setMyOptOut(userId, id, turnOff)
    if (!ok) {
      setOff((p) => { const n = new Set(p); if (turnOff) n.delete(id); else n.add(id); return n })
      setErr('Could not save that. Check your connection and try again.')
    } else setErr('')
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 text-sm text-muted">Choose which emails Cznnect may send you.</p>
      {EMAIL_CATEGORIES.map((c) => {
        const on = c.required || !(off?.has(c.id) ?? false)
        return (
          <button
            key={c.id}
            type="button"
            role="switch"
            aria-checked={on}
            disabled={c.required || !off}
            onClick={() => void flip(c.id)}
            className="flex min-h-14 items-center gap-3 border-b border-line py-2 text-left disabled:opacity-70"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{c.label}</span>
              <span className="block text-xs text-muted">{c.required ? 'Always on. Account and safety messages.' : c.hint}</span>
            </span>
            <span className="text-sm font-semibold text-muted">{on ? 'On' : 'Off'}</span>
          </button>
        )
      })}
      {err && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{err}</p>}
    </div>
  )
}
