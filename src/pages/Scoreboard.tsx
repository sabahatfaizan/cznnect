import { useCallback, useEffect, useState } from 'react'
import type { Family } from '../types'
import { startOfMonthIso, pointsSince, type Recent, type Row } from '../lib/irl'
import { ledgerSince, recent, scoreboard } from '../lib/irlApi'
import IrlScoreboard from '../components/IrlScoreboard'

// The family scoreboard on its own screen. It is opened from the menu and has no link to Convoy.
export default function Scoreboard({ family, userId }: { family: Family; userId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [recents, setRecents] = useState<Recent[]>([])
  const [month, setMonth] = useState<Map<string, number> | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [s, rc, led] = await Promise.all([
      scoreboard(family.id),
      recent(family.id, 20),
      ledgerSince(family.id, startOfMonthIso()),
    ])
    if (!s.ok) {
      setError(s.message)
      return
    }
    setError('')
    setRows(s.data ?? [])
    setRecents(rc.ok ? (rc.data ?? []) : [])
    setMonth(led.ok ? pointsSince(led.data, startOfMonthIso()) : null)
  }, [family.id])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold">Scoreboard</h1>
        <p className="text-sm text-muted">How the family ranks, your badges, and the latest verified meetups.</p>
      </header>
      {error ? (
        <div className="card flex flex-col gap-3">
          <p role="alert" className="font-semibold text-danger">{error}</p>
          <button className="btn btn-plain" onClick={load}>Try again</button>
        </div>
      ) : (
        <IrlScoreboard rows={rows} recent={recents} month={month} userId={userId} />
      )}
    </div>
  )
}
