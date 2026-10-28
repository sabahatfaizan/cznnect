import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import { redeemCode } from '../lib/redeem'
import { getUnlockedThemes, onUnlocksChanged, relockThemes, setThemePref, type ExclusiveTheme } from '../theme'
import { themeLabel } from '../themes/catalog'

const MAX_TRIES = 5
const COOLDOWN_S = 15

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; theme: ExclusiveTheme; isNew: boolean }
  | { kind: 'bad'; message: string }

// "Redeem code" in Settings. A wrong code shakes the field; a right one draws a tick, unlocks the theme
// and equips it. A few wrong guesses in a row pause the form briefly.
export default function RedeemCard({ isOwner, onRedeemed }: { isOwner: boolean; onRedeemed: (theme: ExclusiveTheme) => void }) {
  const [code, setCode] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [shake, setShake] = useState(0)
  const [misses, setMisses] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [unlockedCount, setUnlockedCount] = useState(() => getUnlockedThemes().length)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => onUnlocksChanged(() => setUnlockedCount(getUnlockedThemes().length)), [])

  const waiting = waitUntil > now
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [waiting])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (waiting || state.kind === 'checking') return
    setState({ kind: 'checking' })
    const result = await redeemCode(code)
    if (result.status === 'ok') {
      setThemePref(result.theme)
      onRedeemed(result.theme)
      setState({ kind: 'ok', theme: result.theme, isNew: result.isNew })
      setCode('')
      setMisses(0)
      return
    }
    if (result.status === 'unsupported') {
      setState({ kind: 'bad', message: 'Codes need a secure connection. Open the app from its https address.' })
      return
    }
    const n = misses + 1
    setShake((k) => k + 1)
    if (n >= MAX_TRIES) {
      setMisses(0)
      setNow(Date.now())
      setWaitUntil(Date.now() + COOLDOWN_S * 1000)
      setState({ kind: 'bad', message: 'Too many tries. Take a breath and try again shortly.' })
    } else {
      setMisses(n)
      setState({ kind: 'bad', message: 'That code is not recognised. Check it and try again.' })
    }
    input.current?.select()
  }

  const secondsLeft = Math.max(0, Math.ceil((waitUntil - now) / 1000))

  return (
    <details className="card expander" aria-label="Redeem code">
      <summary>
        <span className="flex min-w-0 items-center gap-3">
          <span className="redeem-key" aria-hidden="true"><Icon name="key" size={22} /></span>
          <span className="min-w-0">
            <span className="font-display block text-lg font-bold">Redeem code</span>
            <span className="block text-sm text-muted">
              {unlockedCount > 0 ? `${unlockedCount} exclusive ${unlockedCount === 1 ? 'theme' : 'themes'} unlocked` : 'Unlock exclusive themes'}
            </span>
          </span>
        </span>
        <span aria-hidden="true" className="expander-chevron">›</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-muted">Enter an explorer's code to unlock an exclusive theme.</p>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <label className="sr-only" htmlFor="redeem-code">Redeem code</label>
          <div key={shake} className={`redeem-field ${shake ? 'redeem-shake' : ''} ${state.kind === 'bad' ? 'redeem-bad' : ''}`}>
            <input
              id="redeem-code"
              ref={input}
              className="input redeem-input"
              value={code}
              onChange={(e) => { setCode(e.target.value); if (state.kind !== 'idle') setState({ kind: 'idle' }) }}
              placeholder="ENTER CODE"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={waiting}
              aria-invalid={state.kind === 'bad'}
              aria-describedby="redeem-message"
              required
            />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={waiting || state.kind === 'checking' || !code.trim()}>
            {waiting ? `Try again in ${secondsLeft}s` : state.kind === 'checking' ? 'Checking…' : 'Redeem'}
          </button>
        </form>
        <div id="redeem-message" aria-live="polite">
          {state.kind === 'bad' && <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>}
          {state.kind === 'ok' && (
            <p className="redeem-ok">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle className="redeem-ok-ring" cx="12" cy="12" r="10" pathLength={1} />
                <path className="redeem-ok-tick" d="M7 12.5l3.2 3.2L17 8.8" pathLength={1} />
              </svg>
              <span>
                {state.isNew
                  ? `Code accepted. ${themeLabel(state.theme)} unlocked and equipped.`
                  : `${themeLabel(state.theme)} was already unlocked. Equipped.`}
              </span>
            </p>
          )}
        </div>
        {isOwner && unlockedCount > 0 && (
          <button type="button" className="link self-start text-sm" onClick={() => { relockThemes(); setState({ kind: 'idle' }) }}>
            Owner only: lock the exclusive themes again on this device
          </button>
        )}
      </div>
    </details>
  )
}
