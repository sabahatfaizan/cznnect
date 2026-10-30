import { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { achievements, joinNames, rankRows, timeAgo, type Recent, type Row } from '../lib/irl'

type Period = 'all' | 'month'

// The family scoreboard: your standing, the ranking, your badges and the latest verified meetups.
export default function IrlScoreboard({
  rows,
  recent,
  month,
  userId,
}: {
  rows: Row[]
  recent: Recent[]
  month: Map<string, number> | null
  userId: string
}) {
  const [period, setPeriod] = useState<Period>('all')

  const ranked = useMemo(() => {
    const base = rows.map((r) => ({ ...r, points: period === 'month' ? (month?.get(r.user_id) ?? 0) : r.points }))
    return rankRows(base)
  }, [rows, month, period])

  const me = ranked.find((r) => r.user_id === userId)
  const mineAll = rows.find((r) => r.user_id === userId)
  const badges = achievements(mineAll, rows.length)
  const top = Math.max(1, ...ranked.map((r) => r.points))
  const earnedBy = (r: Row) => achievements(r, rows.length).filter((a) => a.earned).length

  return (
    <div className="flex flex-col gap-4">
      {me && (
        <section className="card irl-me flex items-center justify-between gap-3" aria-label="Your standing">
          <div>
            <p className="eyebrow">Your standing</p>
            <p className="font-display text-4xl font-extrabold text-accent-text">
              {me.points} <span className="text-base font-bold text-muted">points</span>
            </p>
            <p className="text-sm text-muted">
              {mineAll?.meetups ?? 0} verified {mineAll?.meetups === 1 ? 'meetup' : 'meetups'} · {mineAll?.cousins_met ?? 0}{' '}
              {mineAll?.cousins_met === 1 ? 'cousin' : 'cousins'} met
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Rank</p>
            <p className="font-display text-4xl font-extrabold">#{me.rank}</p>
            <p className="text-sm text-muted">of {ranked.length}</p>
          </div>
        </section>
      )}

      <div role="tablist" aria-label="Scoreboard period" className="grid grid-cols-2 gap-2">
        {(['all', 'month'] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={period === p}
            className={`seg !min-h-11 items-center ${period === p ? 'seg-on' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p === 'all' ? 'All time' : 'This month'}
          </button>
        ))}
      </div>

      <section className="card" aria-label="Ranking">
        {ranked.length === 0 ? (
          <p className="text-muted">No one is on the board yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranked.map((r) => {
              const mine = r.user_id === userId
              const b = earnedBy(r)
              return (
                <li
                  key={r.user_id}
                  className={`irl-row ${mine ? 'irl-row-me' : ''}`}
                  aria-label={`Rank ${r.rank}, ${r.name}, ${r.points} points`}
                >
                  <span aria-hidden="true" className="irl-bar" style={{ width: `${Math.round((r.points / top) * 100)}%` }} />
                  <span className={`irl-rank ${r.rank <= 3 && r.points > 0 ? 'irl-rank-top' : ''}`}>{r.rank}</span>
                  <Avatar value={r.avatar} name={r.name} size={32} className="relative" />
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {r.name}
                      {mine ? <span className="ml-2 text-xs font-bold text-accent-text">You</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {r.meetups} {r.meetups === 1 ? 'meetup' : 'meetups'}
                      {b > 0 ? ` · ${b} ${b === 1 ? 'badge' : 'badges'}` : ''}
                    </span>
                  </span>
                  <span className="relative flex-none font-display text-xl font-extrabold">{r.points}</span>
                </li>
              )
            })}
          </ol>
        )}
        {period === 'month' && month === null && <p className="mt-2 text-sm text-muted">Could not load this month&apos;s points.</p>}
      </section>

      <section aria-label="Your achievements">
        <h2 className="eyebrow mb-2">Your achievements</h2>
        <ul className="grid grid-cols-2 gap-2">
          {badges.map((a) => (
            <li key={a.id} className={`irl-badge ${a.earned ? 'irl-badge-on' : ''}`}>
              <span className="block font-display text-sm font-bold">
                {a.earned ? '✓ ' : ''}
                {a.title}
              </span>
              <span className="block text-xs text-muted">{a.hint}</span>
              <span className="mt-1 block text-xs font-bold text-accent-text">{a.earned ? 'Earned' : a.progress}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Recent meetups">
        <h2 className="eyebrow mb-2">Recent meetups</h2>
        <div className="card">
          {recent.length === 0 ? (
            <p className="text-muted">No verified meetups yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((m) => (
                <li key={m.id} className="py-2">
                  <p className="font-semibold">
                    {m.kind === 'group' ? (m.title ? `${m.title}: ` : 'Group: ') : ''}
                    {joinNames(m.people.map((p) => p.name))}
                  </p>
                  <p className="text-sm text-muted">
                    {timeAgo(m.verified_at)}
                    {m.points_each ? ` · up to ${m.points_each} points each` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
