import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import Sheet from './Sheet'
import FamilyBox from './FamilyBox'
import { Icon } from './Icons'
import { pollsAwaitingVote, type ChatPulse } from '../lib/pulse'
import type { Upcoming } from '../lib/birthdays'
import type { Member } from '../types'

type Target = 'chat' | 'plans' | 'birthdays'

// The Family box as a bell in the header. A dot shows when something is new (messages, a poll waiting, a birthday
// today or tomorrow); tapping it opens the box with who is around and a shortcut for each thing.
export default function FamilyBell({
  familyId,
  userId,
  chat,
  nextBirthday,
  onOpen,
}: {
  familyId: string
  userId: string
  chat: ChatPulse
  nextBirthday: Upcoming | null
  onOpen: (t: Target) => void
}) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [polls, setPolls] = useState(0)

  useEffect(() => {
    let alive = true
    const load = () => { void pollsAwaitingVote(familyId, userId).then((n) => { if (alive) setPolls(n) }) }
    load()
    const id = window.setInterval(load, 60_000)
    return () => { alive = false; window.clearInterval(id) }
  }, [familyId, userId])

  // Names and pictures are only needed once the box is open.
  useEffect(() => {
    if (!open) return
    let alive = true
    void (async () => {
      const q = (cols: string) =>
        supabase.from('family_members').select(`user_id, role, profiles(${cols})`).eq('family_id', familyId).order('joined_at')
      let { data, error } = await q('display_name, nickname, bio, avatar')
      if (error) ({ data, error } = await q('display_name'))
      if (alive && !error) setMembers((data ?? []) as unknown as Member[])
    })()
    return () => { alive = false }
  }, [open, familyId])

  const news = chat.unread > 0 || polls > 0 || (nextBirthday !== null && nextBirthday.days <= 1)

  return (
    <>
      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-current transition hover:bg-surface/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        aria-label={news ? 'Family box, something is new' : 'Family box'}
        onClick={() => setOpen(true)}
      >
        <Icon name="bell" size={22} />
        {news && <span aria-hidden="true" className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />}
      </button>
      {open && (
        <Sheet title="Family box" onClose={() => setOpen(false)}>
          <FamilyBox
            familyId={familyId}
            userId={userId}
            members={members}
            chat={chat}
            nextBirthday={nextBirthday}
            onOpen={(t) => { setOpen(false); onOpen(t) }}
          />
        </Sheet>
      )}
    </>
  )
}
