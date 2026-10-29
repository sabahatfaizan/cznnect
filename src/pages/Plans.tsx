import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import type { Family, Member } from '../types'
import {
  HORIZONS,
  counts,
  dueState,
  dueText,
  filterItems,
  groupBy,
  localToday,
  sortItems,
  type BucketItem,
  type Horizon,
  type ItemVote,
  type Poll,
  type PollOption,
  type PollVote,
  type Show,
} from '../lib/plans'
import { addItem, createPoll } from '../lib/plansApi'
import { withTimeout } from '../lib/net'
import Sheet from '../components/Sheet'
import ItemForm, { type Who } from '../components/ItemForm'
import ItemSheet from '../components/ItemSheet'
import PollForm from '../components/PollForm'
import PollCard from '../components/PollCard'

type View = 'lists' | 'polls'
type Flow = 'none' | 'item' | 'poll'

const SHOWS: { id: Show; label: string }[] = [
  { id: 'open', label: 'To do' },
  { id: 'mine', label: 'Mine' },
  { id: 'done', label: 'Done' },
]

export default function Plans({ family, userId }: { family: Family; userId: string }) {
  const [items, setItems] = useState<BucketItem[]>([])
  const [itemVotes, setItemVotes] = useState<ItemVote[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [options, setOptions] = useState<PollOption[]>([])
  const [pollVotes, setPollVotes] = useState<PollVote[]>([])
  const [wanted, setWanted] = useState<string[]>([])
  const [members, setMembers] = useState<Who[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('lists')
  const [horizon, setHorizon] = useState<Horizon>('month')
  const [show, setShow] = useState<Show>('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flow, setFlow] = useState<Flow>('none')
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<number | undefined>(undefined)
  const today = localToday()

  const load = useCallback(async () => {
    try {
      const [i, iv, p, o, pv, w, m] = await withTimeout(
        Promise.all([
          supabase.from('bucket_items').select('*').eq('family_id', family.id),
          supabase.from('bucket_votes').select('item_id, user_id').eq('family_id', family.id),
          supabase.from('polls').select('*').eq('family_id', family.id),
          supabase.from('poll_options').select('id, poll_id, label, position').eq('family_id', family.id),
          supabase.from('poll_votes').select('poll_id, user_id, option_id').eq('family_id', family.id),
          supabase.from('places').select('name').eq('family_id', family.id).eq('status', 'want'),
          supabase.from('family_members').select('user_id, role, profiles(display_name)').eq('family_id', family.id),
        ]),
      )
      // The places list is only a convenience for polls, so it may be missing without breaking this tab.
      const problem = i.error ?? iv.error ?? p.error ?? o.error ?? pv.error ?? m.error
      if (problem) {
        const missing = problem.code === 'PGRST205' || problem.code === '42P01' || /bucket_|poll/.test(problem.message)
        setError(
          missing
            ? 'Polls and bucket lists are not set up yet. In Supabase, run supabase/06_plans.sql, then come back and try again.'
            : problem.message,
        )
        setStatus('error')
        return
      }
      const list = (m.data ?? []) as unknown as Member[]
      setItems((i.data ?? []) as BucketItem[])
      setItemVotes((iv.data ?? []) as ItemVote[])
      setPolls((p.data ?? []) as Poll[])
      setOptions((o.data ?? []) as PollOption[])
      setPollVotes((pv.data ?? []) as PollVote[])
      setWanted(w.error ? [] : ((w.data ?? []) as { name: string }[]).map((x) => x.name))
      setMembers(list.map((x) => ({ id: x.user_id, name: x.profiles?.display_name ?? 'A cousin' })))
      setIsOwner(list.some((x) => x.user_id === userId && x.role === 'owner'))
      setStatus('ready')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setStatus('error')
    }
  }, [family.id, userId])

  useEffect(() => {
    load()
  }, [load])

  // Open a plan directly when arriving from a shared ?plan=<id> link.
  useEffect(() => {
    if (status !== 'ready') return
    const sharedPlanId = new URLSearchParams(window.location.search).get('plan')
    if (!sharedPlanId) return
    const sharedPlan = items.find((item) => item.id === sharedPlanId)
    if (sharedPlan) {
      setView('lists')
      setHorizon(sharedPlan.horizon)
      setShow(sharedPlan.done ? 'done' : 'open')
      setSelectedId(sharedPlan.id)
    } else if (items.length > 0) {
      say('This plan is unavailable or you do not have access to it.')
    }
  }, [status, items, say])

  const say = useCallback((message: string) => {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3500)
  }, [])

  const votesByItem = useMemo(() => groupBy(itemVotes, (v) => v.item_id), [itemVotes])
  const optionsByPoll = useMemo(() => groupBy(options, (o) => o.poll_id), [options])
  const votesByPoll = useMemo(() => groupBy(pollVotes, (v) => v.poll_id), [pollVotes])
  const tally = useMemo(() => counts(items), [items])
  const shown = useMemo(
    () => sortItems(filterItems(items, { horizon, show, userId }), votesByItem, today),
    [items, horizon, show, userId, votesByItem, today],
  )
  const selected = selectedId ? (items.find((i) => i.id === selectedId) ?? null) : null
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? 'A cousin'

  useEffect(() => {
    if (status === 'ready' && selectedId && !items.some((i) => i.id === selectedId)) setSelectedId(null)
  }, [status, selectedId, items])

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">Plans</h1>
        <p className="text-muted">Loading...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">Plans</h1>
        <div className="card flex flex-col gap-3">
          <p role="alert" className="font-semibold">
            {error}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setStatus('loading')
              load()
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const sortedPolls = [...polls].sort(
    (a, b) => Number(a.closed) - Number(b.closed) || b.created_at.localeCompare(a.created_at),
  )

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Plans</h1>
          <p className="text-sm text-muted">Bucket lists and polls for the family</p>
        </div>
        <button className="btn btn-primary" onClick={() => setFlow(view === 'lists' ? 'item' : 'poll')}>
          {view === 'lists' ? '+ Add' : '+ New poll'}
        </button>
      </header>

      {notice && (
        <p role="status" className="rounded-[var(--radius-ctl)] bg-accent-soft px-3 py-2 text-sm font-bold text-accent-text">
          {notice}
        </p>
      )}

      <div role="tablist" aria-label="Plans" className="grid grid-cols-2 gap-2">
        {(['lists', 'polls'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            className={`seg !min-h-11 items-center ${view === v ? 'seg-on' : ''}`}
            onClick={() => setView(v)}
          >
            {v === 'lists' ? 'Bucket lists' : `Polls${polls.some((p) => !p.closed) ? ` (${polls.filter((p) => !p.closed).length})` : ''}`}
          </button>
        ))}
      </div>

      {view === 'lists' && (
        <>
          <div role="tablist" aria-label="Which list" className="grid grid-cols-3 gap-2">
            {HORIZONS.map((h) => (
              <button
                key={h.id}
                role="tab"
                aria-selected={horizon === h.id}
                className={`seg !min-h-12 items-center ${horizon === h.id ? 'seg-on' : ''}`}
                onClick={() => setHorizon(h.id)}
              >
                {h.label}
                <small>{tally[h.id].open} to do</small>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Show">
            {SHOWS.map((s) => (
              <button
                key={s.id}
                aria-pressed={show === s.id}
                className={`seg !min-h-11 items-center ${show === s.id ? 'seg-on' : ''}`}
                onClick={() => setShow(s.id)}
              >
                {s.label}
                {s.id === 'done' ? ` (${tally[horizon].done})` : ''}
              </button>
            ))}
          </div>

          <section className="card">
            {shown.length === 0 ? (
              <p className="text-muted">
                {show === 'done'
                  ? 'Nothing finished on this list yet.'
                  : show === 'mine'
                    ? 'Nothing is assigned to you on this list.'
                    : 'Nothing here yet. Tap + Add to start this list.'}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((i) => {
                  const state = i.done ? 'none' : dueState(i.due_date, today)
                  const n = votesByItem.get(i.id)?.length ?? 0
                  const meta = [
                    i.assigned_to ? nameOf(i.assigned_to) : '',
                    n > 0 ? `${n} in` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <li key={i.id}>
                      <button type="button" className="flex min-h-14 w-full items-center gap-3 py-1 text-left" onClick={() => setSelectedId(i.id)}>
                        <span
                          aria-hidden="true"
                          className={`flex size-6 flex-none items-center justify-center rounded-[var(--radius-ctl)] border-2 text-sm font-bold ${
                            i.done ? 'border-accent bg-accent text-accent-ink' : 'border-line'
                          }`}
                        >
                          {i.done ? '✓' : ''}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate font-semibold ${i.done ? 'text-muted line-through' : ''}`}>{i.title}</span>
                          <span className="block truncate text-sm text-muted">
                            {i.due_date && !i.done ? (
                              <span className={state === 'overdue' ? 'font-bold text-danger' : state === 'soon' ? 'font-bold text-accent-text' : ''}>
                                {dueText(i.due_date, today)}
                              </span>
                            ) : null}
                            {i.due_date && !i.done && meta ? ' · ' : ''}
                            {meta}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {view === 'polls' && (
        <div className="flex flex-col gap-4">
          {sortedPolls.length === 0 && (
            <div className="card">
              <p className="font-semibold">No polls yet.</p>
              <p className="text-muted">Start one to decide where to eat, where to go, or when to meet.</p>
            </div>
          )}
          {sortedPolls.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              options={optionsByPoll.get(p.id) ?? []}
              votes={votesByPoll.get(p.id) ?? []}
              userId={userId}
              maker={p.created_by ? nameOf(p.created_by) : 'A cousin'}
              canManage={p.created_by === userId || isOwner}
              onChanged={load}
              onNotice={say}
            />
          ))}
        </div>
      )}

      {flow === 'item' && (
        <Sheet title="Add to a list" onClose={() => setFlow('none')}>
          <ItemForm
            initial={{ horizon }}
            members={members}
            existing={items}
            submitLabel="Add"
            onCancel={() => setFlow('none')}
            onSubmit={async (v) => {
              const r = await addItem(family.id, v)
              if (r.error || !r.id) return r.error ?? 'Could not add that.'
              await load()
              setHorizon(v.horizon)
              setShow('open')
              setFlow('none')
              say('Added')
              return null
            }}
          />
        </Sheet>
      )}

      {flow === 'poll' && (
        <Sheet title="New poll" onClose={() => setFlow('none')}>
          <PollForm
            suggestions={wanted}
            onCancel={() => setFlow('none')}
            onSubmit={async (q, choices) => {
              const problem = await createPoll(family.id, q, choices)
              if (problem) return problem
              await load()
              setFlow('none')
              say('Poll started')
              return null
            }}
          />
        </Sheet>
      )}

      {selected && (
        <ItemSheet
          key={selected.id}
          item={selected}
          items={items}
          members={members}
          voters={(votesByItem.get(selected.id) ?? []).map((v) => v.user_id)}
          today={today}
          familyId={family.id}
          userId={userId}
          isOwner={isOwner}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onNotice={say}
        />
      )}
    </div>
  )
}
