import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import Avatar from '../components/Avatar'
import { shownName } from '../lib/avatars'
import type { Family, Member } from '../types'

type Contact = { user_id: string; phone: string | null; contact_email: string | null }

type Props = {
  family: Family
  userId: string
  onFamilyChanged: () => void
}

export default function Home({ family, userId, onFamilyChanged }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  // Only rows people chose to share come back; row-level security hides the rest.
  const [contacts, setContacts] = useState<Map<string, Contact>>(new Map())
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  // Which in-page confirmation is open: 'newcode', 'leave', or 'remove:<user id>'.
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadMembers = useCallback(async () => {
    const q = (cols: string) =>
      supabase.from('family_members').select(`user_id, role, profiles(${cols})`).eq('family_id', family.id).order('joined_at')
    let { data, error } = await q('display_name, nickname, bio, avatar')
    // Falls back to the old columns until supabase/08_profile.sql has been run.
    if (error) ({ data, error } = await q('display_name'))
    if (error) setError(error.message)
    else {
      setError('')
      setMembers((data ?? []) as unknown as Member[])
    }
    const c = await supabase.from('profile_contacts').select('user_id, phone, contact_email')
    if (!c.error) setContacts(new Map(((c.data ?? []) as Contact[]).map((x) => [x.user_id, x])))
  }, [family.id])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const me = members.find((m) => m.user_id === userId)
  const isOwner = me?.role === 'owner'
  const code = family.invite_code.toUpperCase()
  const inviteText = `Join ${family.name} on Cznnect. Open ${location.href.split('?')[0]}, create an account, then enter this invite code: ${code}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // The code is selectable on screen, so copying by hand still works.
    }
  }

  // Runs one of the owner or member actions, then refreshes what is on screen.
  async function run(
    action: () => PromiseLike<{ error: { message: string } | null }>,
    after: () => void,
  ) {
    setBusy(true)
    setError('')
    const { error } = await action()
    setBusy(false)
    setConfirm(null)
    if (error) setError(error.message)
    else after()
  }

  const removeMember = (uid: string) =>
    run(() => supabase.rpc('remove_member', { fid: family.id, target: uid }), loadMembers)
  const leave = () => run(() => supabase.rpc('leave_family', { fid: family.id }), onFamilyChanged)
  const newCode = () =>
    run(() => supabase.rpc('regenerate_invite', { fid: family.id }), onFamilyChanged)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold leading-tight">{family.name}</h1>
      </header>

      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Invite your cousins</h2>
        <p className="select-all rounded-[var(--radius-ctl)] border border-dashed border-line bg-surface-2 py-3 text-center font-mono text-2xl font-semibold tracking-[0.25em] text-accent-text">
          {code}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-primary" onClick={copy}>
            {copied ? 'Copied' : 'Copy invite'}
          </button>
          {'share' in navigator && (
            <button className="btn btn-plain" onClick={() => navigator.share({ text: inviteText }).catch(() => {})}>
              Share
            </button>
          )}
        </div>

        {isOwner &&
          (confirm === 'newcode' ? (
            <div className="flex flex-col gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3">
              <p className="text-sm">
                Make a new code? The old code stops working, so people you removed cannot rejoin with it.
                Current members stay.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-plain" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={busy} onClick={newCode}>
                  New code
                </button>
              </div>
            </div>
          ) : (
            <button className="link self-start" onClick={() => setConfirm('newcode')}>
              Get a new invite code
            </button>
          ))}
      </section>

      <section className="card flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">
          Members {members.length > 0 && <span className="text-muted">({members.length})</span>}
        </h2>
        {error && (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        )}
        <ul className="divide-y divide-line">
          {members.map((m) => {
            const name = shownName(m.profiles)
            const real = m.profiles?.display_name
            const bio = m.profiles?.bio?.trim()
            const ct = m.user_id !== userId ? contacts.get(m.user_id) : undefined
            const canRemove = isOwner && m.role !== 'owner'
            const asking = confirm === 'remove:' + m.user_id
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-x-3">
                <Avatar value={m.profiles?.avatar} name={name} size={40} className="my-2" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{name}</span>
                  {real && name !== real && <span className="block truncate text-xs text-muted">{real}</span>}
                  {bio && <span className="block text-sm text-muted">{bio}</span>}
                  {ct && (ct.phone || ct.contact_email) && (
                    <span className="mt-1 flex flex-wrap gap-x-3 text-sm font-semibold">
                      {ct.phone && (
                        <a className="link" href={`tel:${ct.phone.replace(/[^\d+]/g, '')}`}>
                          {ct.phone}
                        </a>
                      )}
                      {ct.contact_email && (
                        <a className="link break-all" href={`mailto:${ct.contact_email}`}>
                          {ct.contact_email}
                        </a>
                      )}
                    </span>
                  )}
                </span>
                {m.role === 'owner' && (
                  <span className="rounded-[var(--radius-ctl)] bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-text">
                    Owner
                  </span>
                )}
                {canRemove && !asking && (
                  <button
                    className="min-h-11 px-1 text-sm font-bold text-danger underline underline-offset-2"
                    onClick={() => setConfirm('remove:' + m.user_id)}
                    aria-label={`Remove ${name}`}
                  >
                    Remove
                  </button>
                )}
                {asking && (
                  <div className="mb-3 flex w-full flex-col gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3">
                    <p className="text-sm">
                      Remove {name} from the family? They lose access right away. They can only rejoin with
                      the invite code.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="btn btn-plain" onClick={() => setConfirm(null)}>
                        Cancel
                      </button>
                      <button className="btn btn-danger" disabled={busy} onClick={() => removeMember(m.user_id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {me && !isOwner &&
          (confirm === 'leave' ? (
            <div className="flex flex-col gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3">
              <p className="text-sm">
                Leave {family.name}? You will need the invite code to join again.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-plain" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={leave}>
                  Leave
                </button>
              </div>
            </div>
          ) : (
            <button className="min-h-11 self-start text-sm font-bold text-danger underline underline-offset-2" onClick={() => setConfirm('leave')}>
              Leave this family
            </button>
          ))}
      </section>
    </div>
  )
}
