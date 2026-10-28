import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import type { Family } from '../types'
import {
  buildIndex,
  computeGenerations,
  groupByGeneration,
  layoutTree,
  relationLabel,
  searchPeople,
  type Link,
  type Person,
} from '../lib/tree'
import { addMeToTree, addPerson, claimPerson, type PersonValues } from '../lib/treeApi'
import { withTimeout } from '../lib/net'
import TreeCanvas from '../components/TreeCanvas'
import PersonRow from '../components/PersonRow'
import PersonSheet from '../components/PersonSheet'
import PersonCard from '../components/PersonCard'
import PersonPicker from '../components/PersonPicker'
import PersonForm from '../components/PersonForm'
import Sheet from '../components/Sheet'

type View = 'tree' | 'generations' | 'people'
type Mode = 'none' | 'add' | 'claim'

const VIEWS: { id: View; label: string }[] = [
  { id: 'tree', label: 'Tree' },
  { id: 'generations', label: 'Generations' },
  { id: 'people', label: 'People' },
]

export default function Tree({ family, userId, onExit }: { family: Family; userId: string; onExit: () => void }) {
  const [people, setPeople] = useState<Person[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('tree')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [litId, setLitId] = useState<string | null>(null) // whose line of descent is lit on the tree
  const [searching, setSearching] = useState(false)
  const [detail, setDetail] = useState(false) // false: the quick card. true: everything, with editing.
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null)
  const [mode, setMode] = useState<Mode>('none')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const noticeTimer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      const [p, l, m] = await withTimeout(
        Promise.all([
          supabase.from('people').select('*').eq('family_id', family.id),
          supabase.from('relationships').select('id, a_id, b_id, kind, created_by').eq('family_id', family.id),
          supabase.from('family_members').select('role').eq('family_id', family.id).eq('user_id', userId).maybeSingle(),
        ]),
      )
      const problem = p.error ?? l.error ?? m.error
      if (problem) {
        const missing = problem.code === 'PGRST205' || problem.code === '42P01' || /people|relationships/.test(problem.message)
        setError(
          missing
            ? 'The tree tables are not set up yet. In Supabase, run supabase/04_family_tree.sql, then come back and try again.'
            : problem.message,
        )
        setStatus('error')
        return
      }
      setPeople((p.data ?? []) as Person[])
      setLinks((l.data ?? []) as Link[])
      setIsOwner(m.data?.role === 'owner')
      setStatus('ready')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setStatus('error')
    }
  }, [family.id, userId])

  useEffect(() => {
    load()
  }, [load])

  const say = useCallback((message: string) => {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3500)
  }, [])

  const index = useMemo(() => buildIndex(people, links), [people, links])
  const generations = useMemo(() => computeGenerations(index), [index])
  const layout = useMemo(() => layoutTree(people, links), [people, links])
  const mine = useMemo(() => people.find((p) => p.claimed_by === userId) ?? null, [people, userId])
  const selected = selectedId ? (index.byId.get(selectedId) ?? null) : null

  // If someone was removed or merged away while their card was open, close the card.
  useEffect(() => {
    if (status === 'ready' && selectedId && !index.byId.has(selectedId)) setSelectedId(null)
  }, [status, selectedId, index])

  function show(id: string, full = false) {
    setSelectedId(id)
    setLitId(id)
    setDetail(full)
    setFocus({ id, tick: Date.now() })
  }

  const results = query.trim() ? searchPeople(people, query, 6) : []
  const noteFor = (p: Person) => (mine && p.id !== mine.id ? (relationLabel(index, mine.id, p.id) ?? '') : '')

  async function createPerson(v: PersonValues): Promise<string | null> {
    const r = await addPerson(family.id, v)
    if (r.error || !r.id) return r.error ?? 'Could not add that person.'
    await load()
    setMode('none')
    say('Added')
    show(r.id)
    return null
  }

  async function addMe() {
    setBusy(true)
    const r = await addMeToTree(family.id)
    setBusy(false)
    if (r.error || !r.id) {
      say(r.error ?? 'Could not add you.')
      return
    }
    await load()
    setMode('none')
    say('You are in the tree')
    show(r.id)
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">Family Tree</h1>
        <p className="text-muted">Loading the tree...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">Family Tree</h1>
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

  const rows = groupByGeneration(people, generations)
  const alphabetical = [...people].sort((a, b) => a.full_name.localeCompare(b.full_name))

  const sheets = (
    <>
      {mode === 'add' && (
        <Sheet title="Add a person" onClose={() => setMode('none')}>
          <PersonForm
            people={people}
            submitLabel="Add person"
            onSubmit={createPerson}
            onCancel={() => setMode('none')}
            onUseExisting={(p) => {
              setMode('none')
              show(p.id)
            }}
          />
        </Sheet>
      )}

      {mode === 'claim' && (
        <Sheet title="Which one is you?" onClose={() => setMode('none')}>
          <PersonPicker
            people={people.filter((p) => !p.claimed_by)}
            allPeople={people}
            allowNew={false}
            prompt="Pick your own entry in the tree. Entries that already belong to an account are not shown."
            onCancel={() => setMode('none')}
            onPick={async (p) => {
              setBusy(true)
              const problem = await claimPerson(p.id)
              setBusy(false)
              if (problem) {
                say(problem)
                return
              }
              await load()
              setMode('none')
              say('You are linked to your spot in the tree')
              show(p.id)
            }}
          />
        </Sheet>
      )}

      {selected && !detail && (
        <PersonCard
          key={selected.id}
          person={selected}
          index={index}
          me={mine}
          userId={userId}
          onClose={() => setSelectedId(null)}
          onSelect={(id) => show(id)}
          onMore={() => setDetail(true)}
        />
      )}

      {selected && detail && (
        <PersonSheet
          key={selected.id}
          person={selected}
          index={index}
          links={links}
          people={people}
          me={mine}
          userId={userId}
          isOwner={isOwner}
          familyId={family.id}
          onClose={() => { setSelectedId(null); setDetail(false) }}
          onSelect={(id) => show(id, true)}
          onChanged={load}
          onNotice={say}
        />
      )}
    </>
  )

  // Opening Family Tree gives the whole screen to the tree, with its own bar on top.
  if (people.length > 0 && view === 'tree') {
    return (
      <div className="tree-full fixed inset-0 z-40 flex flex-col bg-page">
        <div className="tree-bar flex items-center gap-2 border-b border-line bg-surface px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button className="btn btn-plain !min-h-11 !px-3" onClick={onExit} aria-label="Back to Home">
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-lg font-extrabold leading-tight">Family Tree</h1>
            <p className="truncate text-xs text-muted">
              {people.length} {people.length === 1 ? 'person' : 'people'} · tap someone to light up their line
            </p>
          </div>
          <button className="btn btn-plain !min-h-11 !px-3" onClick={() => setSearching((v) => !v)} aria-label="Find someone" aria-pressed={searching}>
            Find
          </button>
          <button className="btn btn-plain !min-h-11 !px-3" onClick={() => setView('people')}>
            List
          </button>
          <button className="btn btn-primary !min-h-11 !px-3" onClick={() => setMode('add')}>
            + Add
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <TreeCanvas
            layout={layout}
            people={index.byId}
            selectedId={selectedId}
            meId={mine?.id ?? null}
            focus={focus}
            litId={litId}
            onSelect={(id) => show(id)}
            onClear={() => setLitId(null)}
          />

          {searching && (
            <div className="absolute inset-x-3 top-3 z-10 flex flex-col gap-2">
              <input
                autoFocus
                className="input shadow-[var(--shadow-card)]"
                placeholder="Search by name or nickname"
                aria-label="Find someone"
                value={query}
                autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.trim() && (
                <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-[var(--radius-ctl)] border border-line bg-surface px-3 shadow-[var(--shadow-card)]">
                  {results.map((p) => (
                    <li key={p.id}>
                      <PersonRow
                        person={p}
                        note={noteFor(p)}
                        isMe={p.id === mine?.id}
                        onClick={() => {
                          setQuery('')
                          setSearching(false)
                          show(p.id)
                        }}
                      />
                    </li>
                  ))}
                  {results.length === 0 && <li className="py-3 text-muted">No one matches “{query.trim()}”.</li>}
                </ul>
              )}
            </div>
          )}

          {notice && !searching && (
            <p role="status" className="absolute inset-x-3 top-3 z-10 rounded-[var(--radius-ctl)] bg-accent-soft px-3 py-2 text-sm font-bold text-accent-text shadow-[var(--shadow-card)]">
              {notice}
            </p>
          )}

          {!mine && (
            <div className="card absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-20 z-10 flex flex-col gap-2 !p-3">
              <p className="text-sm font-bold">Are you in the tree?</p>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-primary !min-h-10" disabled={busy} onClick={addMe}>
                  Add me
                </button>
                <button className="btn btn-plain !min-h-10" onClick={() => setMode('claim')}>
                  I am here
                </button>
              </div>
            </div>
          )}
        </div>
        {sheets}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Family Tree</h1>
          <p className="text-sm text-muted">
            {people.length === 0 ? 'No one yet' : `${people.length} ${people.length === 1 ? 'person' : 'people'}`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setMode('add')}>
          + Add person
        </button>
      </header>

      {notice && (
        <p role="status" className="rounded-[var(--radius-ctl)] bg-accent-soft px-3 py-2 text-sm font-bold text-accent-text">
          {notice}
        </p>
      )}

      {!mine && (
        <section className="card flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">
            {people.length === 0 ? 'Start the tree with yourself' : 'Find yourself in the tree'}
          </h2>
          <p className="text-sm text-muted">
            {people.length === 0
              ? 'Add yourself first, then add your parents, brothers and sisters, and grandparents. Your cousins can add their own side.'
              : 'Link your account to your own spot, so the tree can show how everyone is related to you.'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-primary" disabled={busy} onClick={addMe}>
              Add me
            </button>
            {people.length > 0 && (
              <button className="btn btn-plain" onClick={() => setMode('claim')}>
                I am already here
              </button>
            )}
          </div>
        </section>
      )}

      {people.length > 0 && (
        <>
          <div>
            <label className="label" htmlFor="tree-search">
              Find someone
            </label>
            <input
              id="tree-search"
              className="input"
              placeholder="Search by name or nickname"
              value={query}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
            {query.trim() && (
              <ul className="mt-2 divide-y divide-line rounded-[var(--radius-ctl)] border border-line bg-surface px-3">
                {results.map((p) => (
                  <li key={p.id}>
                    <PersonRow
                      person={p}
                      note={noteFor(p)}
                      isMe={p.id === mine?.id}
                      onClick={() => {
                        setQuery('')
                        show(p.id)
                      }}
                    />
                  </li>
                ))}
                {results.length === 0 && <li className="py-3 text-muted">No one matches “{query.trim()}”.</li>}
              </ul>
            )}
          </div>

          <div role="tablist" aria-label="How to view the tree" className="grid grid-cols-3 gap-2">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                className={`seg !min-h-11 items-center ${view === v.id ? 'seg-on' : ''}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {view === 'generations' && (
            <div className="flex flex-col gap-4">
              {rows.map((row, i) => (
                <section key={i} className="card">
                  <h2 className="eyebrow mb-1">
                    Generation {i + 1}
                    {i === 0 ? ' · oldest' : ''}
                  </h2>
                  <ul className="divide-y divide-line">
                    {row.map((p) => (
                      <li key={p.id}>
                        <PersonRow person={p} note={noteFor(p)} isMe={p.id === mine?.id} onClick={() => show(p.id)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {view === 'people' && (
            <section className="card">
              <ul className="divide-y divide-line">
                {alphabetical.map((p) => (
                  <li key={p.id}>
                    <PersonRow person={p} note={noteFor(p)} isMe={p.id === mine?.id} onClick={() => show(p.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {sheets}
    </div>
  )
}
