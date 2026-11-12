import { useState } from 'react'
import { Icon } from './Icons'
import Sheet from './Sheet'

const RULES = [
  { value: '+10', title: 'Meet a cousin', text: 'Scan each other’s code and both confirm. You each get 10 points.' },
  { value: '+40', title: 'Group meetups', text: 'Three or more cousins: 10 points, plus 5 for every cousin beyond two, up to 40 each.' },
  { value: '24h', title: 'Once a day per pair', text: 'The same two cousins can earn together once every 24 hours.' },
  { value: '3×', title: 'Daily limit', text: 'You can earn from up to 3 meetups in any 24 hours.' },
  { value: '✓', title: 'Checked by the server', text: 'Points are awarded by the server, so they cannot be edited on a phone.' },
] as const

// A proper entry point to the points rules: a card on the scoreboard that opens a guide.
export default function PointsGuide() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="pg-row" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="pg-icon" aria-hidden="true"><Icon name="info" size={20} /></span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block font-display text-sm font-bold">How points work</span>
          <span className="block text-xs text-muted">Meetups, groups and daily limits</span>
        </span>
        <span aria-hidden="true" className="-rotate-90 text-muted"><Icon name="chevronDown" size={20} /></span>
      </button>

      {open && (
        <Sheet title="How points work" onClose={() => setOpen(false)}>
          <ul className="flex flex-col gap-2">
            {RULES.map((r) => (
              <li key={r.title} className="pg-rule">
                <span className="pg-chip">{r.value}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-bold">{r.title}</span>
                  <span className="block text-sm text-muted">{r.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  )
}
