import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import type { Family } from '../types'
import Avatar from '../components/Avatar'
import { Icon } from '../components/Icons'
import { friendlyError } from '../lib/offline'
import { markChatRead } from '../lib/pulse'

type Msg = { id: number; user_id: string; sender: string; avatar: string | null; body: string; created_at: string }

const MAX = 200
const POLL_MS = 4000

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
function dayLabel(d: Date): string {
  const now = new Date()
  if (sameDay(d, now)) return 'Today'
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}
const clock = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// The family chat: everyone in the family sees the same thread, and every message also goes to the other cousins as a
// phone notification. It is one shared thread, not private messages.
export default function Chat({ family, userId, canDelete = false }: { family: Family; userId: string; canDelete?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  // The owner taps a message to pick it, then confirms. Nobody else sees any of this.
  const [picked, setPicked] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [text, setText] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const [navH, setNavH] = useState(72)
  const box = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const seen = useRef<Set<number>>(new Set())
  const firstLoad = useRef(true)
  const stick = useRef(true) // follow new messages only while the reader is already at the bottom

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase.rpc('family_messages', { fid: family.id, lim: 100 })
      if (err) {
        const code = (err as { code?: string }).code
        setError(code === 'PGRST202' || code === '42883' ? 'Chat is not set up yet. In Supabase, run supabase/17_family_chat.sql.' : friendlyError(err, 'Could not load the chat.'))
        return
      }
      setError('')
      const rows = (Array.isArray(data) ? data : []) as Msg[]
      // Only change state when something is new, so the screen never flickers while polling.
      setMessages((old) => (old.length === rows.length && old[old.length - 1]?.id === rows[rows.length - 1]?.id ? old : rows))
    } catch (e) {
      setError(friendlyError(e, 'Could not load the chat.'))
    } finally {
      setLoaded(true)
    }
  }, [family.id])

  useEffect(() => {
    void load()
    const tick = () => { if (document.visibilityState === 'visible') void load() }
    const id = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [load])

  // Keep the composer just above the bottom bar, whatever height that bar has on this phone.
  useEffect(() => {
    const nav = document.querySelector('.app-nav') as HTMLElement | null
    if (!nav) return
    const measure = () => setNavH(Math.round(nav.getBoundingClientRect().height))
    measure()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(nav)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  useEffect(() => {
    const onScroll = () => { stick.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160 }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Anything on screen counts as read, which clears the badge on the Chat tab and on Home.
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last) markChatRead(family.id, last.id)
  }, [messages, family.id])

  useLayoutEffect(() => {
    if (!loaded) return
    if (firstLoad.current) {
      firstLoad.current = false
      end.current?.scrollIntoView({ block: 'end' })
    } else if (stick.current) {
      end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [messages, pending, loaded])

  async function removeMessage(id: number) {
    setDeleting(true)
    setError('')
    try {
      const { error: err } = await supabase.rpc('delete_family_message', { mid: id })
      if (err) {
        const code = (err as { code?: string }).code
        setError(code === 'PGRST202' || code === '42883' ? 'Deleting is not set up yet. In Supabase, run supabase/19_delete_messages.sql.' : friendlyError(err, 'Could not delete the message.'))
      } else {
        setMessages((old) => old.filter((m) => m.id !== id))
        setPicked(null)
      }
    } catch (e) {
      setError(friendlyError(e, 'Could not delete the message. Check your connection and try again.'))
    } finally {
      setDeleting(false)
    }
  }

  function resize() {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  async function send() {
    const body = text.trim().slice(0, MAX)
    if (!body) return
    setText('')
    setError('')
    stick.current = true
    setPending((p) => [...p, body])
    requestAnimationFrame(resize)
    try {
      const { data, error: err } = await supabase.functions.invoke('send-push', { body: { body, family_id: family.id } })
      if (data?.error) throw new Error(data.error)
      if (err) throw err
      await load()
    } catch (e) {
      setText((t) => (t ? t : body)) // give the words back so nothing is lost
      setError(friendlyError(e, 'Could not send the message. Check your connection and try again.'))
      requestAnimationFrame(resize)
    } finally {
      setPending((p) => { const i = p.indexOf(body); return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)] })
    }
  }

  // Which bubbles are new since the last render, so only they slide in.
  const fresh = new Set<number>()
  if (loaded) {
    for (const m of messages) if (!seen.current.has(m.id)) fresh.add(m.id)
  }
  useEffect(() => { for (const m of messages) seen.current.add(m.id) }, [messages])
  const animate = (id: number) => !firstLoad.current && fresh.has(id)

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Chat</h1>
        <p className="text-sm text-muted">Visible to the whole family.{canDelete ? ' Tap a message to delete it.' : ''}</p>
      </header>

      {error && <p role="alert" className="card text-sm font-bold text-danger">{error}</p>}
      {!loaded && !error && <p role="status" className="py-10 text-center text-sm text-muted">Loading…</p>}
      {loaded && !error && messages.length === 0 && pending.length === 0 && (
        <p className="py-10 text-center text-sm text-muted">No messages yet. Say hi to your cousins.</p>
      )}

      <ol className="flex flex-col" aria-label="Messages" aria-live="polite">
        {messages.map((m, i) => {
          const d = new Date(m.created_at)
          const prev = messages[i - 1]
          const next = messages[i + 1]
          const mine = m.user_id === userId
          const newDay = !prev || !sameDay(new Date(prev.created_at), d)
          const startsGroup = newDay || prev.user_id !== m.user_id || d.getTime() - new Date(prev.created_at).getTime() > 5 * 60_000
          const endsGroup = !next || next.user_id !== m.user_id || !sameDay(new Date(next.created_at), d) || new Date(next.created_at).getTime() - d.getTime() > 5 * 60_000
          return (
            <li key={m.id} className={animate(m.id) ? 'chat-in' : undefined}>
              {newDay && <p className="my-3 text-center text-xs font-semibold text-muted">{dayLabel(d)}</p>}
              <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${startsGroup ? 'mt-3' : 'mt-0.5'}`}>
                {!mine && (
                  <div className="w-8 shrink-0">{endsGroup && <Avatar value={m.avatar} name={m.sender} size={32} />}</div>
                )}
                <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && startsGroup && <p className="mb-0.5 px-1 text-xs font-bold text-muted">{m.sender}</p>}
                  <p
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[0.95rem] leading-snug ${mine ? 'rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md border border-line bg-surface-2'} ${canDelete ? 'cursor-pointer' : ''} ${picked === m.id ? 'outline outline-2 outline-offset-2 outline-danger' : ''}`}
                    {...(canDelete ? { role: 'button', tabIndex: 0, 'aria-pressed': picked === m.id, onClick: () => setPicked(picked === m.id ? null : m.id), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(picked === m.id ? null : m.id) } } } : {})}
                  >{m.body}</p>
                  {canDelete && picked === m.id && (
                    <div className="mt-1 flex items-center gap-2 px-1 text-sm">
                      <span className="text-muted">Delete for everyone?</span>
                      <button type="button" className="min-h-9 font-bold text-danger underline underline-offset-2" disabled={deleting} onClick={() => void removeMessage(m.id)}>{deleting ? 'Deleting…' : 'Delete'}</button>
                      <button type="button" className="min-h-9 font-semibold underline underline-offset-2" disabled={deleting} onClick={() => setPicked(null)}>Cancel</button>
                    </div>
                  )}
                  {endsGroup && <p className="mt-0.5 px-1 text-[0.7rem] text-muted">{clock(d)}</p>}
                </div>
              </div>
            </li>
          )
        })}
        {pending.map((body, i) => (
          <li key={`p${i}`} className="chat-in mt-0.5 flex justify-end">
            <div className="flex max-w-[78%] flex-col items-end">
              <p className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[0.95rem] leading-snug text-accent-ink opacity-60">{body}</p>
              <p className="mt-0.5 px-1 text-[0.7rem] text-muted">Sending…</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Room so the last message is never hidden behind the message bar. */}
      <div ref={end} className="h-20" aria-hidden="true" />

      <form
        className="fixed inset-x-0 z-30 border-t border-line bg-surface"
        style={{ bottom: navH }}
        onSubmit={(e) => { e.preventDefault(); void send() }}
      >
        <div className="mx-auto flex max-w-xl items-end gap-2 px-3 py-2">
          <textarea
            ref={box}
            className="input min-h-11 flex-1 resize-none !rounded-3xl py-2.5"
            rows={1}
            maxLength={MAX}
            value={text}
            placeholder="Message your family"
            aria-label="Message"
            enterKeyHint="send"
            onChange={(e) => { setText(e.target.value); resize() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() }
            }}
          />
          <button type="submit" className="btn btn-primary !h-11 !w-11 shrink-0 !rounded-full !p-0" aria-label="Send" disabled={!text.trim()}>
            <Icon name="send" size={20} />
          </button>
        </div>
      </form>
    </div>
  )
}
