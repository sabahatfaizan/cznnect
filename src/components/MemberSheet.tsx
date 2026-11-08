import { useState } from 'react'
import TitleBadge from './TitleBadge'
import { supabase } from '../supabase'
import { shownName } from '../lib/avatars'
import type { FamilyRole } from '../types'
import Avatar from './Avatar'
import Sheet from './Sheet'

export type SheetMember = {
  user_id: string
  role: FamilyRole
  joined_at?: string | null
  profiles: { display_name: string; nickname?: string | null; bio?: string | null; avatar?: string | null; title?: string | null } | null
}

const ROLES: Record<FamilyRole, { label: string; blurb: string }> = {
  owner: { label: 'Owner', blurb: 'Runs the family: invite code, roles, and removing people.' },
  moderator: { label: 'Moderator', blurb: 'Helps the owner: can remove regular members.' },
  member: { label: 'Member', blurb: 'Can use every family page.' },
}

// What someone is (their role) and, for the owner and moderators, the things you can do to them.
export default function MemberSheet({
  member,
  viewerId,
  viewerRole,
  familyId,
  onClose,
  onChanged,
}: {
  member: SheetMember
  viewerId: string
  viewerRole: FamilyRole | null
  familyId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = shownName(member.profiles)
  const real = member.profiles?.display_name
  const bio = member.profiles?.bio?.trim()
  const isMe = member.user_id === viewerId
  const info = ROLES[member.role]

  const canChangeRole = viewerRole === 'owner' && member.role !== 'owner' && !isMe
  const canRemove =
    !isMe && ((viewerRole === 'owner' && member.role !== 'owner') || (viewerRole === 'moderator' && member.role === 'member'))

  async function run(fn: string, args: Record<string, unknown>) {
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc(fn, args)
    setBusy(false)
    if (e) {
      setError(/function|constraint|schema cache/i.test(e.message) ? `${e.message} Run supabase/10_moderators.sql in Supabase first.` : e.message)
      return
    }
    onChanged()
    onClose()
  }

  function setRole(next: 'moderator' | 'member') {
    void run('set_member_role', { fid: familyId, target: member.user_id, new_role: next })
  }

  function remove() {
    if (!window.confirm(`Remove ${name} from the family? They lose access until they join again with a code.`)) return
    void run('remove_member', { fid: familyId, target: member.user_id })
  }

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar value={member.profiles?.avatar} name={name} size={72} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{name}{isMe ? ' (you)' : ''}<TitleBadge title={member.profiles?.title} /></p>
            {real && name !== real && <p className="truncate text-sm text-muted">{real}</p>}
            {member.joined_at && <p className="text-sm text-muted">Joined {new Date(member.joined_at).toLocaleDateString()}</p>}
          </div>
        </div>

        {bio && <p className="text-sm">{bio}</p>}

        <div className="rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3">
          <p className="eyebrow">Role</p>
          <p className="mt-1 font-bold">{info.label}</p>
          <p className="text-sm text-muted">{info.blurb}</p>
        </div>

        {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}

        {(canChangeRole || canRemove) && (
          <div className="flex flex-col gap-2">
            {canChangeRole && member.role === 'member' && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setRole('moderator')}>
                Make moderator
              </button>
            )}
            {canChangeRole && member.role === 'moderator' && (
              <button type="button" className="btn btn-plain" disabled={busy} onClick={() => setRole('member')}>
                Make regular member
              </button>
            )}
            {canRemove && (
              <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>
                Remove from family
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
