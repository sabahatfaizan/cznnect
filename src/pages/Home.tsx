import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { appUrl, canShare, shareText } from '../lib/native'
import Avatar from '../components/Avatar'
import { shownName } from '../lib/avatars'
import { Icon } from '../components/Icons'
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
  const [copied, setCopied] = useState<'code' | 'invite' | null>(null)
  // Which in-page confirmation is open: 'newcode' or 'leave'.
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
  const inviteText = `Join ${family.name} on Cznnect. Open ${appUrl()}, create an account, then enter this invite code: ${code}`

  async function copy(what: 'code' | 'invite') {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : inviteText)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
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

  const leave = () => run(() => supabase.rpc('leave_family', { fid: family.id }), onFamilyChanged)
  const newCode = () =>
    run(() => supabase.rpc('regenerate_invite', { fid: family.id }), onFamilyChanged)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Your family</p>
          <h1 className="font-display mt-0.5 text-xl font-extrabold leading-tight">{family.name}</h1>
        </div>
        {members.length > 0 && (
          <div className="flex shrink-0 items-center gap-2" aria-label={`${members.length} members`}>
            <ul className="flex -space-x-2">
              {members.slice(0, 4).map((m) => (
                <li key={m.user_id} className="rounded-full ring-2 ring-[var(--page)]">
                  <Avatar value={m.profiles?.avatar} name={shownName(m.profiles)} size={28} />
                </li>
              ))}
            </ul>
            {members.length > 4 && <span className="text-xs font-bold text-muted">+{members.length - 4}</span>}
          </div>
        )}
      </header>

      <section className="card relative flex flex-col gap-4 overflow-hidden" aria-label="Invite people">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: 'linear-gradient(180deg, var(--accent-soft), transparent)' }} />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"><Icon name="plus" size={20} /></span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold leading-tight">Invite cousins</h2>
            <p className="text-sm text-muted">They enter this code after making an account.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void copy('code')}
          aria-label={`Invite code ${code.split('').join(' ')}. Tap to copy.`}
          className="relative flex w-full items-center gap-3 rounded-[var(--radius-ctl)] py-1"
        >
          {[code.slice(0, Math.ceil(code.length / 2)), code.slice(Math.ceil(code.length / 2))].map((group, gi) => (
            <span key={gi} className="flex min-w-0 flex-1 gap-1.5">
              {group.split('').map((ch, i) => (
                <span key={i} aria-hidden="true" className="grid h-12 min-w-0 flex-1 place-items-center rounded-lg border border-line bg-surface-2 font-mono text-xl font-bold text-accent-text">
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </button>
        <p role="status" className="-mt-2 text-center text-xs font-semibold text-muted">
          {copied === 'code' ? 'Code copied' : 'Tap the code to copy it'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {canShare() ? (
            <>
              <button className="btn btn-primary !min-h-11 !text-sm" onClick={() => shareText(inviteText, `Join ${family.name} on Cznnect`).catch(() => {})}>
                Share invite
              </button>
              <button className="btn btn-plain !min-h-11 !text-sm" onClick={() => void copy('invite')}>
                {copied === 'invite' ? 'Copied' : 'Copy message'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary col-span-2 !min-h-11 !text-sm" onClick={() => void copy('invite')}>
              {copied === 'invite' ? 'Copied' : 'Copy invite message'}
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
        <h2 className="font-display text-base font-bold">
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
                {m.role !== 'member' && (
                  <span className="rounded-[var(--radius-ctl)] bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-text">
                    {m.role === 'owner' ? 'Owner' : 'Moderator'}
                  </span>
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
