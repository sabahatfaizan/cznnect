import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Family } from '../types'
import type { Meetup } from '../lib/irl'
import {
  confirmMeetup,
  declineMeetup,
  finishGroup,
  lockGroup,
  mine,
  removePerson,
  startGroup,
} from '../lib/irlApi'
import IrlMyCode from '../components/IrlMyCode'
import IrlMeetupCard from '../components/IrlMeetupCard'
import IrlScanSheet from '../components/IrlScanSheet'
import IrlGatherings from '../components/IrlGatherings'
import Sheet from '../components/Sheet'
import { Icon } from '../components/Icons'

// Convoy: your personal code, scanning a cousin, and confirming meetups. The scoreboard lives in the menu.
export default function Irl({ family, userId }: { family: Family; userId: string }) {
  const [meetups, setMeetups] = useState<Meetup[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [groupSheet, setGroupSheet] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const [groupError, setGroupError] = useState('')
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

  async function submitGroup() {
    setBusy(true)
    setGroupError('')
    const r = await startGroup(family.id, groupTitle)
    setBusy(false)
    if (!r.ok) {
      setGroupError(r.message)
      return
    }
    setGroupSheet(false)
    setGroupTitle('')
    say('Group meetup started. Cousins can scan the code.')
    await loadMeet()
  }

  return (
    // One fixed screen: it never scrolls (the document is locked while Convoy is open).
    <div className="flex max-h-[calc(100dvh-13rem)] flex-col gap-3 overflow-hidden">
      <header>
        <p className="text-sm text-muted">
          Link up with cousins in person and earn points.
        </p>
      </header>

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
          {focus && <IrlMeetupCard key={focus.id} meetup={focus} userId={userId} busy={busy} run={run} actions={actions} />}

          <section className="card flex flex-col gap-3" aria-label="Your link code">
            <h2 className="eyebrow">Your link code</h2>
            <IrlMyCode familyId={family.id} />
            <div className="flex items-center justify-center gap-3">
              <button className="btn btn-primary !h-12 !w-16 !p-0" onClick={() => setScanning(true)} aria-label="Scan a cousin's code to link" title="Scan to link">
                <Icon name="camera" size={24} />
              </button>
              <button className="btn btn-plain !h-12 !w-16 !p-0" onClick={() => setGroupSheet(true)} aria-label="Start a group meetup" title="Group meetup">
                <Icon name="group" size={24} />
              </button>
            </div>
          </section>

          <IrlGatherings familyId={family.id} userId={userId} />
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

      {groupSheet && (
        <Sheet title="Group meetup" onClose={() => setGroupSheet(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Start a group when three or more cousins are together. You show a code, they scan it to join, then everyone confirms.
            </p>
            <div>
              <label className="label" htmlFor="irl-group-title">
                Name (optional)
              </label>
              <input
                id="irl-group-title"
                className="input"
                value={groupTitle}
                maxLength={60}
                placeholder="e.g. Eid lunch"
                autoComplete="off"
                onChange={(e) => setGroupTitle(e.target.value)}
              />
            </div>
            {groupError && (
              <p role="alert" className="text-sm font-bold text-danger">
                {groupError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-plain" onClick={() => setGroupSheet(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={submitGroup}>
                {busy ? 'Starting...' : 'Start group'}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
