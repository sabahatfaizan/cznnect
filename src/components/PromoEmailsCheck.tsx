import { useState } from 'react'
import { readPromoChoice, savePromoChoice } from '../lib/promoEmails'

// The small tick box for promo email. Ticked to begin with; unticking is remembered and applied to the new account.
export default function PromoEmailsCheck() {
  const [on, setOn] = useState(() => readPromoChoice())
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0"
        checked={on}
        onChange={(e) => { setOn(e.target.checked); savePromoChoice(e.target.checked) }}
      />
      <span>
        <strong className="font-bold">Send me news and updates by email</strong>
        <span className="block text-xs text-muted">Birthdays, events and new features. Change it any time in Settings, then Emails.</span>
      </span>
    </label>
  )
}
