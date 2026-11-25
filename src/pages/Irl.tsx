import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Family } from '../types'
import { rankRows, type Meetup } from '../lib/irl'
import {
  confirmMeetup,
  declineMeetup,
  finishGroup,
  lockGroup,
  mine,
  removePerson,
  scoreboard,
} from '../lib/irlApi'
import IrlMyCode from '../components/IrlMyCode'
import IrlMeetupCard from '../components/IrlMeetupCard'
import IrlScanSheet from '../components/IrlScanSheet'
import IrlGatherings from '../components/IrlGatherings'
import { Icon } from '../components/Icons'

// Convoy: your personal code, scanning a cousin, and confirming meetups. The scoreboard lives in the menu.
export default function Irl({ family, userId, onOpenScoreboard }: { family: Family; userId: string; onOpenScoreboard?: () => void }) {
  const [meetups, setMeetups] = useState<Meetup[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  // Your place on the scoreboard, shown in the bar next to Scan. null until it has loaded (or if it could not).
  const [standing, setStanding] = useState<{ rank: number; points: number; of: number } | null>(null)
  const noticeTimer = useRef<number | undefined>(undefined)
  const seen = useRef<Map<string, string> | null>(null)

  const say = useCallback((message: string) => {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 4500)
  }, [])

  const loadMeet = useCallback(async () => {
    const r = await mine(family.id)
    if (!r.ok) {
      setError(r.message)
      return
    }
    setError('')
    const list = r.data ?? []
    // Say so once when a meetup you were waiting on becomes verified.
    const before = seen.current
    const now = new Map(list.map((m) => [m.id, m.status]))
    if (before) {
      for (const m of list) {
        if (m.status === 'verified' && before.get(m.id) !== 'verified') {
          const pts = m.my_points ?? 0
          say(pts > 0 ? `Meetup verified. +${pts} points!` : 'Meetup verified. No points this time.')
        }
      }
    }
    seen.current = now
    setMeetups(list)
    setLoaded(true)
  }, [family.id, say])

  // Keep the meetups fresh while this screen is open, so a cousin's confirmation appears on its own.
  useEffect(() => {
    loadMeet()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadMeet()
    }, 5000)
    return () => window.clearInterval(id)
  }, [loadMeet])

  // Refresh the standing on opening and whenever another meetup becomes verified (new points).
  const verifiedCount = meetups.filter((m) => m.status === 'verified').length
  useEffect(() => {
    let alive = true
    scoreboard(family.id).then((r) => {
      if (!alive || !r.ok) return
      const mineRow = rankRows(r.data).find((row) => row.user_id === userId)
      if (mineRow) setStanding({ rank: mineRow.rank, points: mineRow.points, of: r.data.length })
    })
    return () => { alive = false }
  }, [family.id, userId, verifiedCount])

  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; message?: string }>, success?: string) => {
      setBusy(true)
      const r = await fn()
      setBusy(false)
      if (!r.ok) {
        say(r.message ?? 'That did not work.')
      } else if (success) {
        say(success)
      }
      await loadMeet()
    },
    [loadMeet, say],
  )

  // The API returns {ok, data} or {ok:false, message}; the cards only need ok and message.
  const actions = useMemo(
    () => ({
      confirm: async (id: string) => confirmMeetup(id).then((r) => ({ ok: r.ok, message: r.ok ? undefined : r.message })),
      decline: async (id: string) => declineMeetup(id).then((r) => ({ ok: r.ok, message: r.ok ? undefined : r.message })),
      lock: async (id: string) => lockGroup(id).then((r) => ({ ok: r.ok, message: r.ok ? undefined : r.message })),
      finish: async (id: string) => finishGroup(id).then((r) => ({ ok: r.ok, message: r.ok ? undefined : r.message })),
      remove: async (id: string, uid: string) => removePerson(id, uid).then((r) => ({ ok: r.ok, message: r.ok ? undefined : r.message })),
    }),
    [],
  )

  const active = meetups.filter((m) => m.status === 'pending' || m.status === 'open' || m.status === 'locked')
  const needsMe = active.filter((m) => m.people.some((p) => p.user_id === userId && !p.confirmed) && m.status !== 'open')
  const rest = active.filter((m) => !needsMe.includes(m))
  const finished = meetups.filter((m) => !active.includes(m))
  // The page is one screen that does not scroll, so only the meetup that matters most is shown:
  // one waiting for your confirmation, else one in progress, else the one that just finished.
  const focus = needsMe[0] ?? rest[0] ?? finished[0] ?? null

  return (
    // One fixed screen (the document is locked while Convoy is open). With a meetup open, this box scrolls on its own so nothing overlaps.
    <div className={`-mx-4 flex flex-col gap-3 px-4 max-h-[calc(100dvh-13rem)] ${focus ? 'overflow-y-auto pb-4' : 'overflow-hidden'}`}>
      {notice && (
        <p role="status" className="rounded-[var(--radius-ctl)] bg-accent-soft px-3 py-2 text-sm font-bold text-accent-text">
          {notice}
        </p>
      )}

      {error && (
        <div className="card flex flex-col gap-3">
          <p role="alert" className="font-semibold text-danger">
            {error}
          </p>
          <button className="btn btn-plain" onClick={loadMeet}>
            Try again
          </button>
        </div>
      )}

      {!error && (
        <>
          <div className="max-h-52 shrink-0 overflow-y-auto">
            <IrlGatherings familyId={family.id} userId={userId} onGroupStarted={loadMeet} />
          </div>

          {focus && <IrlMeetupCard key={focus.id} meetup={focus} userId={userId} busy={busy} run={run} actions={actions} />}

          <section className={`flex flex-col items-center gap-4 pb-3 pt-4 ${focus ? 'shrink-0' : 'min-h-0 flex-1 justify-center'}`} aria-label="Your link code">
            {!(focus && focus.kind === 'group' && (focus.status === 'open' || focus.status === 'locked')) && <IrlMyCode familyId={family.id} />}
            {/* Your standing runs from the left edge of the screen up to the Scan pill. Tap it for the scoreboard. */}
            <div className="-ml-4 flex items-center gap-3 self-stretch">
              <button
                type="button"
                onClick={onOpenScoreboard}
                disabled={!onOpenScoreboard}
                aria-label={standing ? `Scoreboard: rank ${standing.rank} of ${standing.of}, ${standing.points} points` : 'Scoreboard'}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-r-full border border-l-0 border-line bg-surface-2 py-1.5 pl-4 pr-3 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="text-accent-text"><Icon name="trophy" size={20} /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
                  {standing ? (
                    <>
                      #{standing.rank} <span className="font-semibold text-muted">of {standing.of}</span>
                      <span className="mx-1.5 text-muted">·</span>
                      {standing.points} <span className="font-semibold text-muted">{standing.points === 1 ? 'point' : 'points'}</span>
                    </>
                  ) : (
                    <span className="font-semibold text-muted">Scoreboard</span>
                  )}
                </span>
                <span className="text-muted"><Icon name="chevron" size={18} /></span>
              </button>
              {/* Scan is a small pill: the code is the main thing here, scanning is the occasional action. */}
              <button className="qr-btn qr-btn-main qr-btn-compact shrink-0" onClick={() => setScanning(true)}>
                <span className="qr-btn-icon"><Icon name="camera" size={16} /></span>
                Scan
              </button>
            </div>
          </section>

        </>
      )}

      {scanning && (
        <IrlScanSheet
          familyId={family.id}
          onClose={() => setScanning(false)}
          onDone={(message) => {
            setScanning(false)
            say(message)
            loadMeet()
          }}
        />
      )}
    </div>
  )
}
