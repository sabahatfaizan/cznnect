import { useState } from 'react'
import Sheet from './Sheet'
import ItemForm, { type Who } from './ItemForm'
import { dueState, dueText, horizonLabel, type BucketItem } from '../lib/plans'
import { deleteItem, setImIn, setItemDone, updateItem } from '../lib/plansApi'

type Mode = 'view' | 'edit' | 'delete'

// One bucket-list item: details, "I'm in", mark done, edit and remove.
export default function ItemSheet({
  item,
  items,
  members,
  voters,
  today,
  familyId,
  userId,
  isOwner,
  onClose,
  onChanged,
  onNotice,
}: {
  item: BucketItem
  items: BucketItem[]
  members: Who[]
  voters: string[]
  today: string
  familyId: string
  userId: string
  isOwner: boolean
  onClose: () => void
  onChanged: () => Promise<void> | void
  onNotice: (message: string) => void
}) {
  const [mode, setMode] = useState<Mode>('view')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const name = (id: string | null) => members.find((m) => m.id === id)?.name ?? 'A cousin'
  const imIn = voters.includes(userId)
  const canRemove = item.created_by === userId || isOwner
  const state = item.done ? 'none' : dueState(item.due_date, today)

  async function sharePlan() {
    const details = [
      `Cznnect plan: ${item.title}`,
      `List: ${horizonLabel(item.horizon)}`,
      item.due_date ? `Date: ${item.due_date}` : '',
      item.assigned_to ? `Organiser: ${name(item.assigned_to)}` : '',
      item.notes?.trim() ? `Details: ${item.notes.trim()}` : '',
      `Open this plan: ${window.location.origin}${window.location.pathname}?plan=${encodeURIComponent(item.id)}`,
    ].filter(Boolean).join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: details })
        onNotice('Share sheet opened')
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(details)
        onNotice('Plan details copied — paste them anywhere')
        return
      }
      window.prompt('Copy your plan details:', details)
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') onNotice('Could not share this plan')
    }
  }

  async function act(fn: () => Promise<string | null>, message: string) {
    setBusy(true)
    setError('')
    const problem = await fn()
    setBusy(false)
    if (problem) {
      setError(problem)
      return false
    }
    await onChanged()
    onNotice(message)
    return true
  }

  if (mode === 'edit') {
    return (
      <Sheet title="Edit" onClose={() => setMode('view')}>
        <ItemForm
          initial={{ title: item.title, notes: item.notes ?? '', horizon: item.horizon, due_date: item.due_date ?? '', assigned_to: item.assigned_to ?? '' }}
          members={members}
          existing={items.filter((i) => i.id !== item.id)}
          submitLabel="Save"
          onCancel={() => setMode('view')}
          onSubmit={async (v) => {
            const problem = await updateItem(item.id, v)
            if (problem) return problem
            await onChanged()
            setMode('view')
            onNotice('Saved')
            return null
          }}
        />
      </Sheet>
    )
  }

  if (mode === 'delete') {
    return (
      <Sheet title="Remove this?" onClose={() => setMode('view')}>
        <p className="mb-4">
          <b>{item.title}</b> will be removed for the whole family. This cannot be undone.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-plain" onClick={() => setMode('view')}>
            Keep it
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={async () => {
              const ok = await act(() => deleteItem(item.id), 'Removed')
              if (ok) onClose()
              else setMode('view')
            }}
          >
            {busy ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={item.title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-semibold">
            {horizonLabel(item.horizon)}
            {item.done ? ' · Done' : ''}
          </p>
          {item.due_date && !item.done && (
            <p className={state === 'overdue' ? 'font-bold text-danger' : 'text-muted'}>{dueText(item.due_date, today)}</p>
          )}
          {item.done && item.done_by && <p className="text-muted">Finished with {name(item.done_by)}'s tick.</p>}
          <p className="text-muted">{item.assigned_to ? `Organised by ${name(item.assigned_to)}` : 'Nobody is organising this yet'}</p>
        </div>

        {item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}

        <button type="button" className="btn btn-plain w-full" onClick={sharePlan}>
          <span className="inline-flex items-center justify-center gap-2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.7 10.6l6.6-4.2M8.7 13.4l6.6 4.2" />
            </svg>
            Share plan
          </span>
        </button>

        <section className="card flex flex-col gap-2">
          <h3 className="font-display text-lg font-bold">Who is in?</h3>
          <p className="text-muted">{voters.length === 0 ? 'Nobody yet.' : voters.map(name).join(', ')}</p>
          <button
            className={`btn ${imIn ? 'btn-plain' : 'btn-primary'}`}
            disabled={busy}
            onClick={() => act(() => setImIn(item.id, familyId, userId, !imIn), imIn ? 'You are out' : 'You are in')}
          >
            {imIn ? 'I am out' : 'I am in'}
          </button>
        </section>

        {error && (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        )}

        <button
          className={`btn ${item.done ? 'btn-plain' : 'btn-primary'}`}
          disabled={busy}
          onClick={() => act(() => setItemDone(item.id, !item.done), item.done ? 'Back on the list' : 'Done. Well done!')}
        >
          {item.done ? 'Put back on the list' : 'Mark as done'}
        </button>

        <div className={`grid gap-3 ${canRemove ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button className="btn btn-plain" onClick={() => setMode('edit')}>
            Edit
          </button>
          {canRemove && (
            <button className="btn btn-plain" onClick={() => setMode('delete')}>
              Remove
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
