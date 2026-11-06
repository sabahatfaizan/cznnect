import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import { shownName } from '../lib/avatars'
import { countdownText, type Upcoming } from '../lib/birthdays'
import { ONLINE_MS, pollsAwaitingVote, timeAgo, usePresence, type ChatPulse } from '../lib/pulse'
import type { Member } from '../types'

type Target = 'chat' | 'plans' | 'birthdays'

const clip = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// Home's Family box: a slim strip like a notification. Who is around on top, then one short line per thing that is new,
// each a shortcut. It is flat on purpose (a border, no shadow) and gentle: nothing counts missed days or scolds you for being away.
export default function FamilyBox({
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
    .sort((a, b) => Number(b.online) - Number(a.online) || b.at.localeCompare(a.at))
  const online = people.filter((p) => p.online)
  const shown = people.slice(0, 5)
  const hereText = online.length > 0 ? `${online.length} here now` : people.length > 0 ? `${people.length} around today` : 'Quiet now'

  const lines: { key: string; text: string; sub?: string; target: Target; strong?: boolean }[] = []
  if (chat.unread > 0 && chat.latest) {
    lines.push({ key: 'chat', strong: true, target: 'chat', text: `${chat.unread} new ${chat.unread === 1 ? 'message' : 'messages'}`, sub: `${chat.latest.sender}: ${clip(chat.latest.body)}` })
  } else if (chat.latest) {
    lines.push({ key: 'chat', target: 'chat', text: 'Chat', sub: `${chat.latest.mine ? 'You' : chat.latest.sender}: ${clip(chat.latest.body)} · ${timeAgo(chat.latest.created_at, now)}` })
  } else {
    lines.push({ key: 'chat', target: 'chat', text: 'Chat', sub: 'Say hi to your cousins' })
  }
  if (polls > 0) lines.push({ key: 'polls', strong: true, target: 'plans', text: `${polls} ${polls === 1 ? 'poll needs' : 'polls need'} your vote` })
  if (nextBirthday && nextBirthday.days <= 30) {
    lines.push({ key: 'bday', target: 'birthdays', strong: nextBirthday.days <= 1, text: `${nextBirthday.isMe ? 'Your' : `${nextBirthday.name}'s`} birthday ${countdownText(nextBirthday.days).toLowerCase()}` })
  }

  return (
    <section aria-label="Family box" className="rounded-xl border border-line bg-surface-2 px-3 py-1.5">
      <div className="flex min-h-8 items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Family box</h2>
        {shown.length > 0 && (
          <ul className="ml-1 flex -space-x-1.5" aria-label="Who has been around">
            {shown.map((p) => (
              <li key={p.id} className={`relative rounded-full ${p.online ? '' : 'opacity-50'}`} title={`${shownName(p.m.profiles)}: ${p.online ? 'online now' : timeAgo(p.at, now)}`}>
                <Avatar value={p.m.profiles?.avatar} name={shownName(p.m.profiles)} size={22} />
                {p.online && <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-surface-2 bg-green-500" />}
              </li>
            ))}
          </ul>
        )}
        <p className="ml-auto text-xs text-muted" role="status">{hereText}</p>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {lines.map((l) => (
          <li key={l.key}>
            <button type="button" className="flex h-9 w-full items-center gap-2 text-left text-sm" onClick={() => onOpen(l.target)}>
              <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${l.strong ? 'bg-accent' : 'bg-line'}`} />
              <span className="min-w-0 flex-1 truncate">
                <span className={l.strong ? 'font-bold' : 'font-semibold'}>{l.text}</span>
                {l.sub && <span className="text-muted"> · {l.sub}</span>}
              </span>
              <span aria-hidden="true" className="text-muted">›</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
