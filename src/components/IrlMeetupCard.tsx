import QrCode from './QrCode'
import { groupPayload, joinNames, minutesLeft, pointsFor, readableCode, type Meetup } from '../lib/irl'

type Run = (fn: () => Promise<{ ok: boolean; message?: string }>, success?: string) => Promise<void>

// One meetup you are part of, with exactly the buttons that make sense for you right now.
export default function IrlMeetupCard({
  meetup,
  userId,
  busy,
  run,
  actions,
}: {
  meetup: Meetup
  userId: string
  busy: boolean
  run: Run
  actions: {
    confirm: (id: string) => Promise<{ ok: boolean; message?: string }>
    decline: (id: string) => Promise<{ ok: boolean; message?: string }>
    lock: (id: string) => Promise<{ ok: boolean; message?: string }>
    finish: (id: string) => Promise<{ ok: boolean; message?: string }>
    remove: (id: string, uid: string) => Promise<{ ok: boolean; message?: string }>
  }
}) {
  const m = meetup
  const me = m.people.find((p) => p.user_id === userId)
  const isHost = m.host_id === userId
  const others = m.people.filter((p) => p.user_id !== userId)
  const hostName = m.people.find((p) => p.user_id === m.host_id)?.name ?? 'A cousin'
  const waiting = m.people.filter((p) => !p.confirmed)
  const confirmed = m.people.filter((p) => p.confirmed).length
  const title = m.kind === 'group' ? m.title || `${hostName}'s group` : `Meetup with ${joinNames(others.map((p) => p.name))}`
  const mins = minutesLeft(m.expires_at)

  // ----- finished, shown for a few minutes -----
  if (m.status === 'verified') {
    const pts = m.my_points ?? 0
    return (
      <section className="card irl-win flex flex-col gap-1" aria-label={title}>
        <p className="eyebrow">Verified</p>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="font-display text-3xl font-extrabold text-accent-text">{pts > 0 ? `+${pts} points` : 'No points this time'}</p>
        {pts === 0 && (
          <p className="text-sm text-muted">You had a recent meetup with the same cousin, or hit today&apos;s limit. It is still recorded.</p>
        )}
        <p className="text-sm text-muted">{joinNames(m.people.map((p) => p.name))}</p>
      </section>
    )
  }
  if (m.status === 'cancelled' || m.status === 'expired') {
    return (
      <section className="card flex flex-col gap-1 opacity-80" aria-label={title}>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="text-sm text-muted">{m.status === 'cancelled' ? 'This meetup was cancelled.' : 'This meetup ran out of time.'}</p>
      </section>
    )
  }

  const people = (
    <ul className="divide-y divide-line">
      {m.people.map((p) => (
        <li key={p.user_id} className="flex min-h-11 items-center gap-3 py-1">
          <span
            aria-hidden="true"
            className={`flex size-6 flex-none items-center justify-center rounded-[var(--radius-ctl)] border-2 text-sm font-bold ${
              p.confirmed ? 'border-accent bg-accent text-accent-ink' : 'border-line'
            }`}
          >
            {p.confirmed ? '✓' : ''}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">
            {p.name}
            {p.user_id === userId ? ' (you)' : ''}
            {p.user_id === m.host_id && m.kind === 'group' ? ' · host' : ''}
          </span>
          <span className="flex-none text-sm text-muted">
            {m.status === 'open' ? 'joined' : p.confirmed ? 'confirmed' : 'waiting'}
          </span>
          {isHost && m.kind === 'group' && p.user_id !== userId && (m.status === 'open' || m.status === 'locked') && (
            <button
              className="link !min-h-9 text-sm"
              disabled={busy}
              aria-label={`Remove ${p.name}`}
              onClick={() => run(() => actions.remove(m.id, p.user_id), `${p.name} removed`)}
            >
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  )

  // ----- two cousins -----
  if (m.kind === 'pair') {
    return (
      <section className="card flex flex-col gap-3" aria-label={title}>
        <div>
          <p className="eyebrow">{isHost ? 'Waiting for them' : 'Needs your answer'}</p>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <p className="text-sm text-muted">
            {isHost
              ? `${waiting.map((p) => p.name).join(', ')} needs to confirm on their phone. ${mins} min left.`
              : `${hostName} says you are together. Confirm only if you really are. ${mins} min left.`}
          </p>
        </div>
        {people}
        <div className={`grid gap-3 ${isHost || me?.confirmed ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {!isHost && !me?.confirmed && (
            <>
              <button className="btn btn-plain" disabled={busy} onClick={() => run(() => actions.decline(m.id), 'Declined')}>
                Not together
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => run(() => actions.confirm(m.id))}>
                Yes, we met
              </button>
            </>
          )}
          {(isHost || me?.confirmed) && (
            <button className="btn btn-plain" disabled={busy} onClick={() => run(() => actions.decline(m.id), 'Cancelled')}>
              Cancel meetup
            </button>
          )}
        </div>
      </section>
    )
  }

  // ----- group, still gathering -----
  if (m.status === 'open') {
    const payload = m.join_code ? groupPayload(m.join_code) : ''
    return (
      <section className="card flex flex-col gap-3" aria-label={title}>
        <div>
          <p className="eyebrow">Group meetup · gathering</p>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <p className="text-sm text-muted">
            {isHost
              ? 'Cousins scan this code to join. When everyone is in, lock the group so they can confirm.'
              : `You joined ${hostName}'s group. Waiting for the host to lock it.`}{' '}
            {mins} min left.
          </p>
        </div>
        {isHost && payload && (
          <div className="flex flex-col items-center gap-2">
            <QrCode text={payload} size={200} label="QR code for cousins to join this group meetup" />
            <p className="select-all font-mono text-sm font-semibold tracking-wider text-accent-text">{readableCode(payload)}</p>
          </div>
        )}
        {people}
        {isHost ? (
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-plain" disabled={busy} onClick={() => run(() => actions.decline(m.id), 'Cancelled')}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || m.people.length < 3}
              onClick={() => run(() => actions.lock(m.id), 'Group locked. Everyone can confirm now.')}
            >
              Lock group ({m.people.length})
            </button>
          </div>
        ) : (
          <button className="btn btn-plain" disabled={busy} onClick={() => run(() => actions.decline(m.id), 'You left the group')}>
            Leave group
          </button>
        )}
        {isHost && m.people.length < 3 && <p className="text-sm text-muted">A group needs at least 3 cousins. For two, scan each other.</p>}
      </section>
    )
  }

  // ----- group, locked: everyone confirms -----
  const points = pointsFor('group', m.people.length)
  return (
    <section className="card flex flex-col gap-3" aria-label={title}>
      <div>
        <p className="eyebrow">Group meetup · confirm</p>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="text-sm text-muted">
          {me?.confirmed
            ? `You confirmed. Waiting for ${waiting.length} more. `
            : 'Confirm only if you were really there. '}
          Worth up to {points} points each. {mins} min left.
        </p>
      </div>
      {people}
      <div className="flex flex-col gap-3">
        {me && !me.confirmed && (
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-plain" disabled={busy} onClick={() => run(() => actions.decline(m.id), 'You left the group')}>
              Leave
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => actions.confirm(m.id))}>
              I was there
            </button>
          </div>
        )}
        {isHost && (
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-plain" disabled={busy} onClick={() => run(() => actions.decline(m.id), 'Cancelled')}>
              Cancel meetup
            </button>
            <button
              className="btn btn-plain"
              disabled={busy || confirmed < 3 || waiting.length === 0}
              onClick={() => run(() => actions.finish(m.id))}
            >
              Finish without the others
            </button>
          </div>
        )}
        {!isHost && me?.confirmed && (
          <button className="btn btn-plain" disabled={busy} onClick={() => run(() => actions.decline(m.id), 'You left the group')}>
            Leave group
          </button>
        )}
      </div>
    </section>
  )
}
