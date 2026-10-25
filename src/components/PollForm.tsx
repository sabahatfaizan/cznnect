import { useState, type FormEvent } from 'react'
import { cleanChoices } from '../lib/plans'

const MAX = 8

// Start a poll: a question and 2 to 8 choices. Places the family wants to visit can be added in one tap.
export default function PollForm({
  suggestions,
  onSubmit,
  onCancel,
}: {
  suggestions: string[]
  onSubmit: (question: string, choices: string[]) => Promise<string | null>
  onCancel: () => void
}) {
  const [question, setQuestion] = useState('')
  const [choices, setChoices] = useState(['', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const clean = cleanChoices(choices)
  const have = new Set(clean.map((c) => c.toLowerCase()))
  const offered = suggestions.filter((s) => !have.has(s.toLowerCase())).slice(0, 6)

  function setAt(i: number, v: string) {
    setChoices((c) => c.map((x, k) => (k === i ? v : x)))
  }

  function addSuggestion(s: string) {
    setChoices((c) => {
      const empty = c.findIndex((x) => !x.trim())
      if (empty >= 0) return c.map((x, k) => (k === empty ? s : x))
      return c.length < MAX ? [...c, s] : c
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!question.trim()) {
      setError('Please write a question.')
      return
    }
    if (clean.length < 2) {
      setError('Add at least two different choices.')
      return
    }
    setBusy(true)
    setError('')
    const problem = await onSubmit(question.trim(), clean)
    setBusy(false)
    if (problem) setError(problem)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="po-q">
          Question
        </label>
        <input
          id="po-q"
          className="input"
          value={question}
          maxLength={120}
          placeholder="e.g. Where should we eat on Friday?"
          autoComplete="off"
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="label">Choices</span>
        {choices.map((c, i) => (
          <input
            key={i}
            className="input"
            aria-label={`Choice ${i + 1}`}
            value={c}
            maxLength={80}
            placeholder={`Choice ${i + 1}`}
            autoComplete="off"
            onChange={(e) => setAt(i, e.target.value)}
          />
        ))}
        {choices.length < MAX && (
          <button type="button" className="link self-start" onClick={() => setChoices((c) => [...c, ''])}>
            + Add a choice
          </button>
        )}
      </div>

      {offered.length > 0 && (
        <div>
          <span className="label">From places you want to go</span>
          <div className="flex flex-wrap gap-2">
            {offered.map((s) => (
              <button key={s} type="button" className="btn btn-plain !min-h-11 !px-3 !text-sm" onClick={() => addSuggestion(s)}>
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-plain" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Starting...' : 'Start poll'}
        </button>
      </div>
    </form>
  )
}
