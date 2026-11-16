import { useCallback, useEffect, useState } from 'react'
import type { Family } from '../types'
import { startOfMonthIso, pointsSince, type Recent, type Row } from '../lib/irl'
import { ledgerSince, recent, scoreboard } from '../lib/irlApi'
import IrlScoreboard from '../components/IrlScoreboard'
import { readLocalCopy, saveLocalCopy } from '../lib/savedData'

type Copy = { rows: Row[]; recents: Recent[]; month: [string, number][] | null; at: number }

// The family scoreboard on its own screen. It is opened from the menu and has no link to Convoy.
export default function Scoreboard({ family, userId }: { family: Family; userId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [recents, setRecents] = useState<Recent[]>([])
  const [month, setMonth] = useState<Map<string, number> | null>(null)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [s, rc, led] = await Promise.all([
      scoreboard(family.id),
      recent(family.id, 20),
      ledgerSince(family.id, startOfMonthIso()),
    ])
    const key = `scoreboard-${family.id}`
    if (!s.ok) {
      // No internet: show the scoreboard as it was the last time it loaded.
      const copy = readLocalCopy<Copy>(key)
      if (copy) {
        setError('')
        setRows(copy.rows)
        setRecents(copy.recents)
        setMonth(copy.month ? new Map(copy.month) : null)
        setSavedAt(copy.at)
        return
      }
      setError(s.message)
      return
    }
    setError('')
    setSavedAt(null)
    const nextRows = s.data ?? []
    const nextRecents = rc.ok ? (rc.data ?? []) : []
    const nextMonth = led.ok ? pointsSince(led.data, startOfMonthIso()) : null
    setRows(nextRows)
    setRecents(nextRecents)
    setMonth(nextMonth)
    saveLocalCopy(key, { rows: nextRows, recents: nextRecents, month: nextMonth ? Array.from(nextMonth.entries()) : null, at: Date.now() } satisfies Copy)
  }, [family.id])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="card flex flex-col gap-3">
          <p role="alert" className="font-semibold text-danger">{error}</p>
          <button className="btn btn-plain" onClick={load}>Try again</button>
        </div>
      ) : (
        <>
          {savedAt && <p className="text-center text-xs text-muted">Saved copy from {new Date(savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>}
          <IrlScoreboard rows={rows} recent={recents} month={month} userId={userId} />
        </>
      )}
    </div>
  )
}
