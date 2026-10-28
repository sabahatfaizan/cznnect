import { birthText, initials, relationLabel, relativesOf, type Person, type TreeIndex } from '../lib/tree'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import Avatar from './Avatar'
import Sheet from './Sheet'

// The quick look at someone when you tap them in the tree: just the important parts.
// Editing and linking live behind "Full details".
export default function PersonCard({
  person,
  index,
  me,
  userId,
  onClose,
  onSelect,
  onMore,
}: {
  person: Person
  index: TreeIndex
  me: Person | null
  userId: string
  onClose: () => void
  onSelect: (id: string) => void
  onMore: () => void
}) {
  const isMe = person.claimed_by === userId
  // Someone with an account may have picked an avatar and a bio. Blank until then (or before 08_profile.sql).
  const [prof, setProf] = useState<{ avatar: string | null; bio: string | null } | null>(null)
  useEffect(() => {
    setProf(null)
    if (!person.claimed_by) return
    let live = true
    supabase
      .from('profiles')
      .select('avatar, bio')
      .eq('id', person.claimed_by)
      .maybeSingle()
      .then(({ data }: { data: { avatar: string | null; bio: string | null } | null }) => {
        if (live && data) setProf(data)
      })
    return () => {
      live = false
    }
  }, [person.claimed_by])
  const relation = isMe ? 'You' : me ? relationLabel(index, me.id, person.id) : null
  const rel = relativesOf(index, person.id)
  const born = birthText(person)

  const line = (label: string, people: Person[]) =>
    people.length > 0 && (
      <p className="text-sm">
        <span className="text-muted">{label}: </span>
        {people.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ', '}
            <button className="link !min-h-0 font-semibold" onClick={() => onSelect(p.id)}>
              {p.full_name}
            </button>
          </span>
        ))}
      </p>
    )

  return (
    <Sheet title={person.full_name} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {prof?.avatar ? (
            <Avatar value={prof.avatar} name={person.full_name} size={56} />
          ) : (
            <span
              className="flex size-14 flex-none items-center justify-center rounded-[var(--radius-avatar)] bg-accent-soft font-display text-lg font-bold text-accent-text"
              aria-hidden="true"
            >
              {initials(person.full_name)}
            </span>
          )}
          <div className="min-w-0">
            {person.nickname && <p className="font-semibold">“{person.nickname}”</p>}
            {relation && <p className="text-sm font-bold text-accent-text">{relation}</p>}
            <p className="text-sm text-muted">
              {born ? `Born ${born}` : 'Birthday not added'}
              {person.is_deceased ? ' · Passed away' : ''}
            </p>
          </div>
        </div>
        {prof?.bio && <p className="text-sm text-muted">{prof.bio}</p>}
        {line('Parents', rel.parents)}
        {line('Partner', rel.partners)}
        {line('Children', rel.children)}
        <button className="btn btn-primary" onClick={onMore}>
          Full details
        </button>
      </div>
    </Sheet>
  )
}
