import { useCallback, useRef, useState, type FormEvent } from 'react'
import Sheet from './Sheet'
import QrScanner from './QrScanner'
import { parseScanned } from '../lib/irl'
import {
  groupPreview,
  joinGroup,
  lookup,
  startPair,
  type GroupPreview,
  type Looked,
} from '../lib/irlApi'

type Step =
  | { name: 'scan' }
  | { name: 'checking' }
  | { name: 'person'; payload: string; who: Looked }
  | { name: 'group'; payload: string; info: GroupPreview }
  | { name: 'problem'; message: string }

// Scan a cousin's code (or a group's code), check who it is, and ask for a confirmation before anything is created.
export default function IrlScanSheet({
  familyId,
  onClose,
  onDone,
}: {
  familyId: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [step, setStep] = useState<Step>({ name: 'scan' })
  const [typed, setTyped] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const handling = useRef(false)
  const lastIgnored = useRef(0)

  const handle = useCallback(
    async (text: string) => {
      if (handling.current) return
      const scanned = parseScanned(text)
      if (!scanned) {
        const now = Date.now()
        if (now - lastIgnored.current > 2500) {
          lastIgnored.current = now
          setHint('That is not a Cznnect code.')
        }
        return
      }
      handling.current = true
      setHint('')
      setError('')
      setStep({ name: 'checking' })
      if (scanned.type === 'person') {
        const r = await lookup(familyId, scanned.payload)
        if (!r.ok) setStep({ name: 'problem', message: r.message })
        else setStep({ name: 'person', payload: scanned.payload, who: r.data })
      } else {
        const r = await groupPreview(familyId, scanned.payload)
        if (!r.ok) setStep({ name: 'problem', message: r.message })
        else setStep({ name: 'group', payload: scanned.payload, info: r.data })
      }
      handling.current = false
    },
    [familyId],
  )

  function again() {
    setError('')
    setHint('')
    setStep({ name: 'scan' })
  }

  async function submitTyped(e: FormEvent) {
    e.preventDefault()
    if (!typed.trim()) return
    if (!parseScanned(typed)) {
      setHint('That does not look like a Cznnect code. Check it and try again.')
      return
    }
    await handle(typed)
    setTyped('')
  }

  async function confirmPerson(payload: string, name: string) {
    setBusy(true)
    setError('')
    const r = await startPair(familyId, payload)
    setBusy(false)
    if (!r.ok) {
      setError(r.message)
      return
    }
    onDone(r.data.existing ? `Confirmed with ${name}` : `Request sent to ${name}`)
  }

  async function confirmGroup(payload: string) {
    setBusy(true)
    setError('')
    const r = await joinGroup(familyId, payload)
    setBusy(false)
    if (!r.ok) {
      setError(r.message)
      return
    }
    onDone(r.data.existing ? 'You are already in that group' : 'You joined the group')
  }

  return (
    <Sheet title="Scan a code" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {step.name === 'scan' && (
          <>
            <QrScanner onText={handle} />
            <p className="text-center text-sm text-muted">Point the camera at a cousin&apos;s code, or at a group meetup&apos;s code.</p>
            {hint && (
              <p role="status" className="text-center text-sm font-bold text-danger">
                {hint}
              </p>
            )}
            <form onSubmit={submitTyped} className="flex flex-col gap-2">
              <label className="label" htmlFor="irl-typed">
                Camera not working? Type their code
              </label>
              <div className="flex gap-2">
                <input
                  id="irl-typed"
                  className="input font-mono uppercase"
                  value={typed}
                  placeholder="CZN1 XXXX XXXX ..."
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  onChange={(e) => setTyped(e.target.value)}
                />
                <button className="btn btn-primary !px-4" disabled={!typed.trim()}>
                  Use
                </button>
              </div>
            </form>
          </>
        )}

        {step.name === 'checking' && <p className="py-10 text-center font-semibold text-muted">Checking the code...</p>}

        {step.name === 'problem' && (
          <div className="flex flex-col gap-4">
            <p role="alert" className="font-bold text-danger">
              {step.message}
            </p>
            <button className="btn btn-primary" onClick={again}>
              Scan again
            </button>
          </div>
        )}

        {step.name === 'person' && (
          <div className="flex flex-col gap-4">
            <div className="card flex flex-col gap-1 text-center">
              <p className="eyebrow">You scanned</p>
              <p className="font-display text-2xl font-extrabold">{step.who.name}</p>
              <p className="text-sm text-muted">
                They will get a request to confirm. Points are added only after you both confirm.
              </p>
            </div>
            {step.who.cooldown_seconds > 0 ? (
              <p role="status" className="font-semibold text-muted">
                You two already earned points together in the last 24 hours. You can meet for points again in about{' '}
                {Math.max(1, Math.ceil(step.who.cooldown_seconds / 3600))} hours.
              </p>
            ) : step.who.daily_left === 0 ? (
              <p role="status" className="font-semibold text-muted">
                You have reached today&apos;s points limit. You can still confirm the meetup, but it will not earn points until tomorrow.
              </p>
            ) : null}
            {error && (
              <p role="alert" className="text-sm font-bold text-danger">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-plain" onClick={again}>
                Not them
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || step.who.cooldown_seconds > 0}
                onClick={() => confirmPerson(step.payload, step.who.name)}
              >
                {busy ? 'Sending...' : 'We are together'}
              </button>
            </div>
          </div>
        )}

        {step.name === 'group' && (
          <div className="flex flex-col gap-4">
            <div className="card flex flex-col gap-1 text-center">
              <p className="eyebrow">Group meetup</p>
              <p className="font-display text-2xl font-extrabold">{step.info.title || `${step.info.host}'s group`}</p>
              <p className="text-sm text-muted">
                Hosted by {step.info.host} · {step.info.people} {step.info.people === 1 ? 'cousin' : 'cousins'} so far
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm font-bold text-danger">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-plain" onClick={again}>
                Not this one
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => confirmGroup(step.payload)}>
                {busy ? 'Joining...' : step.info.already_in ? 'Open it' : 'Join the group'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
