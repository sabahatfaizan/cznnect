import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import { shownName } from '../lib/avatars'
import { countdownText, type Upcoming } from '../lib/birthdays'
import { ONLINE_MS, pollsAwaitingVote, timeAgo, usePresence, type ChatPulse } from '../lib/pulse'
import type { Member } from '../types'

type Target = 'chat' | 'plans' | 'birthdays'

const clip = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// Home's live card: who is around right now and what is new, each line a shortcut. It is gentle on purpose: no counters of
// missed days, nothing that scolds you for being away.
export default function FamilyPulse({
  familyId,
  userId,
  members,
  chat,
  nextBirthday,
  onOpen,
}: {
  familyId: string
  userId: string
  members: Member[]
  chat: ChatPulse
  nextBirthday: Upcoming | null
  onOpen: (t: Target) => void
}) {
  const seen = usePresence(familyId)
  const [polls, setPolls] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    const load = () => { void pollsAwaitingVote(familyId, userId).then((n) => { if (alive) setPolls(n) }) }
    load()
    const id = window.setInterval(() => { setNow(Date.now()); load() }, 60_000)
    return () => { alive = false; window.clearInterval(id) }
  }, [familyId, userId])

  const byId = new Map(members.map((m) => [m.user_id, m]))
  const people = [...seen.entries()]
    .filter(([id]) => id !== userId && byId.has(id))
    .map(([id, at]) => ({ id, at, online: now - new Date(at).getTime() < ONLINE_MS, m: byId.get(id)! }))
    .sort((a, b) => b.at.localeCompare(a.at))
  const online = people.filter((p) => p.online)
  const earlier = people.filter((p) => !p.online)
  const names = online.map((p) => shownName(p.m.profiles))
  const hereText =
    online.length === 0
      ? 'Quiet right now. A good moment to say hi.'
      : online.length === 1
        ? `${names[0]} is here now.`
        : online.length === 2
          ? `${names[0]} and ${names[1]} are here now.`
          : `${names[0]}, ${names[1]} and ${online.length - 2} more are here now.`

  const lines: { key: string; text: string; sub?: string; target: Target; strong?: boolean }[] = []
  if (chat.unread > 0 && chat.latest) {
    lines.push({ key: 'chat', strong: true, target: 'chat', text: `${chat.unread} new ${chat.unread === 1 ? 'message' : 'messages'} in Chat`, sub: `${chat.latest.sender}: ${clip(chat.latest.body)}` })
  } else if (chat.latest) {
    lines.push({ key: 'chat', target: 'chat', text: chat.latest.mine ? 'You sent the last message' : `Last message from ${chat.latest.sender}`, sub: `${clip(chat.latest.body)} · ${timeAgo(chat.latest.created_at, now)}` })
  } else {
    lines.push({ key: 'chat', target: 'chat', text: 'Start the family chat', sub: 'Say something to your cousins.' })
  }
  if (polls > 0) lines.push({ key: 'polls', strong: true, target: 'plans', text: `${polls} ${polls === 1 ? 'poll needs' : 'polls need'} your vote`, sub: 'Plans' })
  if (nextBirthday && nextBirthday.days <= 30) {
    lines.push({ key: 'bday', target: 'birthdays', strong: nextBirthday.days <= 1, text: `${nextBirthday.isMe ? 'Your' : `${nextBirthday.name}'s`} birthday ${countdownText(nextBirthday.days).toLowerCase()}`, sub: nextBirthday.turning ? `Turning ${nextBirthday.turning}` : undefined })
  }

  return (
    <section className="card flex flex-col gap-3" aria-label="Family pulse">
      <h2 className="font-display text-lg font-bold">Family pulse</h2>

      <div className="flex flex-col gap-2">
        <p className="text-sm" role="status">{hereText}</p>
        {(online.length > 0 || earlier.length > 0) && (
          <ul className="flex flex-wrap gap-2" aria-label="Who has been around">
            {online.map((p) => (
              <li key={p.id} className="relative" title={`${shownName(p.m.profiles)}: online now`}>
                <Avatar value={p.m.profiles?.avatar} name={shownName(p.m.profiles)} size={40} />
                <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-green-500" />
              </li>
            ))}
            {earlier.map((p) => (
              <li key={p.id} className="opacity-50" title={`${shownName(p.m.profiles)}: ${timeAgo(p.at, now)}`}>
                <Avatar value={p.m.profiles?.avatar} name={shownName(p.m.profiles)} size={40} />
              </li>
            ))}
          </ul>
        )}
        {earlier.length > 0 && <p className="text-xs text-muted">Faded are around earlier today.</p>}
      </div>

      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <li key={l.key}>
            <button type="button" className="flex min-h-12 w-full items-center gap-3 py-2 text-left" onClick={() => onOpen(l.target)}>
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${l.strong ? 'bg-accent' : 'bg-line'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${l.strong ? 'font-bold' : 'font-semibold'}`}>{l.text}</span>
                {l.sub && <span className="block truncate text-xs text-muted">{l.sub}</span>}
              </span>
              <span aria-hidden="true" className="expander-chevron">›</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
