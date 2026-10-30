import { useState } from 'react'
import { searchPeople, type Person } from '../lib/tree'
import type { PersonValues } from '../lib/treeApi'
import PersonForm from './PersonForm'
import PersonRow from './PersonRow'

// "Who is it?" Search people already in the tree first. Only if they are not there,
// add them as a new person. That order is what keeps the tree free of duplicates.
export default function PersonPicker({
  people,
  allPeople,
  prompt,
  disabledReason,
  allowNew = true,
  onPick,
  onCreate,
  onCancel,
  note,
}: {
  people: Person[] // who can be chosen
  allPeople: Person[] // everyone, used for the duplicate warning when adding someone new
  prompt: string
  disabledReason?: (p: Person) => string | null
  allowNew?: boolean
  onPick: (p: Person) => void
  onCreate?: (values: PersonValues) => Promise<string | null>
  onCancel: () => void
  note?: string
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  if (creating && onCreate) {
    return (
      <PersonForm
        initial={{ full_name: query.trim() }}
        people={allPeople}
        submitLabel="Add person"
        onSubmit={onCreate}
        onCancel={() => setCreating(false)}
        onUseExisting={(p) => {
          const reason = disabledReason?.(p) ?? null
          if (!reason) onPick(p)
        }}
      />
    )
  }

  const q = query.trim()
  const shown = q
    ? searchPeople(people, q, 12)
    : [...people].sort((a, b) => a.full_name.localeCompare(b.full_name)).slice(0, 40)

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">{prompt}</p>
      {note && <p className="text-sm text-muted">{note}</p>}
      <div>
        <label className="label" htmlFor="pp-search">
          Search by name or nickname
        </label>
        <input
          id="pp-search"
          className="input"
          value={query}
          autoComplete="off"
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ul className="divide-y divide-line">
        {shown.map((p) => {
          const reason = disabledReason?.(p) ?? null
          return (
            <li key={p.id}>
              <PersonRow person={p} note={reason ?? undefined} disabled={reason !== null} onClick={() => onPick(p)} />
            </li>
          )
        })}
      </ul>

      {q && shown.length === 0 && <p className="text-muted">No one in the tree matches “{q}”.</p>}
      {!q && people.length === 0 && <p className="text-muted">No one to choose from yet.</p>}

      {allowNew && onCreate && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={!q}
          onClick={() => setCreating(true)}
        >
          {q ? `Add “${q}” as a new person` : 'Type a name to add someone new'}
        </button>
      )}
      <button type="button" className="btn btn-plain" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
