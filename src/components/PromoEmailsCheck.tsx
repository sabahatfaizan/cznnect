import { useEffect, useState } from 'react'
import { readPromoChoice, savePromoChoice } from '../lib/promoEmails'

// Promotional email is optional and starts unchecked. The choice is applied after account creation.
export default function PromoEmailsCheck() {
  const [on, setOn] = useState(() => readPromoChoice())
  useEffect(() => { savePromoChoice(on) }, [on])
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <span>
        <strong className="font-bold">Send me news and updates by email (optional)</strong>
        <span className="block text-xs text-muted">Birthdays, events and new features. Change it any time in Settings, then Emails.</span>
      </span>
    </label>
  )
}
