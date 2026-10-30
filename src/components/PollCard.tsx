import { useState } from 'react'
import { tally, type Poll, type PollOption, type PollVote } from '../lib/plans'
import { castVote, deletePoll, removeVote, setPollClosed } from '../lib/plansApi'

// One poll: tap a choice to vote (tap again to change it). Bars show how the family is leaning.
export default function PollCard({
  poll,
  options,
  votes,
  userId,
  maker,
  canManage,
  onChanged,
  onNotice,
}: {
  poll: Poll
  options: PollOption[]
  votes: PollVote[]
  userId: string
  maker: string
  canManage: boolean
  onChanged: () => Promise<void> | void
  onNotice: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const { rows, total } = tally(options, votes, userId)
  const winner = poll.closed && total > 0 ? rows.filter((r) => r.leading) : []

  async function act(fn: () => Promise<string | null>, message = '') {
    setBusy(true)
    setError('')
    const problem = await fn()
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    await onChanged()
    if (message) onNotice(message)
  }

  return (
    <section className="card flex flex-col gap-3" aria-label={poll.question}>
      <div>
        <h3 className="font-display text-lg font-bold">{poll.question}</h3>
        <p className="text-sm text-muted">
          {maker} · {total} {total === 1 ? 'vote' : 'votes'}
          {poll.closed ? ' · Closed' : ''}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.option.id}>
            <button
              type="button"
              disabled={busy || poll.closed}
              aria-pressed={r.mine}
              onClick={() => (r.mine ? act(() => removeVote(poll.id, userId)) : act(() => castVote(poll.id, r.option.id)))}
              className={`relative flex min-h-12 w-full items-center justify-between gap-3 overflow-hidden rounded-[var(--radius-ctl)] border px-3 text-left ${
                r.mine ? 'border-accent' : 'border-line'
              } bg-surface disabled:opacity-100`}
            >
              <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-accent-soft" style={{ width: `${r.percent}%` }} />
              <span className="relative min-w-0 flex-1 truncate font-semibold">
                {r.mine ? '✓ ' : ''}
                {r.option.label}
              </span>
              <span className={`relative flex-none text-sm font-bold ${r.leading ? 'text-accent-text' : 'text-muted'}`}>
                {r.count} · {r.percent}%
              </span>
            </button>
          </li>
        ))}
      </ul>

      {winner.length > 0 && (
        <p className="font-bold text-accent-text">
          {winner.length === 1 ? `Winner: ${winner[0].option.label}` : `Tie: ${winner.map((w) => w.option.label).join(', ')}`}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}

      {canManage && !confirm && (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn btn-plain !min-h-11"
            disabled={busy}
            onClick={() => act(() => setPollClosed(poll.id, !poll.closed), poll.closed ? 'Poll reopened' : 'Poll closed')}
          >
            {poll.closed ? 'Reopen' : 'Close poll'}
          </button>
          <button className="btn btn-plain !min-h-11" disabled={busy} onClick={() => setConfirm(true)}>
            Remove
          </button>
        </div>
      )}
      {confirm && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3">
          <p className="font-semibold">Remove this poll and all its votes?</p>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-plain !min-h-11" onClick={() => setConfirm(false)}>
              Keep it
            </button>
            <button className="btn btn-danger !min-h-11" disabled={busy} onClick={() => act(() => deletePoll(poll.id), 'Poll removed')}>
              Remove
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
