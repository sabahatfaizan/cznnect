import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import type { Family } from '../types'
import Avatar from '../components/Avatar'
import { Icon } from '../components/Icons'
import { friendlyError } from '../lib/offline'
import Sheet from '../components/Sheet'
import { markChatRead } from '../lib/pulse'
import { useScreenVisible } from '../lib/screenVisible'

type Msg = { id: number; user_id: string; sender: string; avatar: string | null; body: string; created_at: string; edited_at?: string | null }

const MAX = 200
const EDIT_WINDOW_MS = 15 * 60_000
const HOLD_MS = 450
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
  // Press and hold a message for its options: edit, delete for me, delete for everyone.
  const [menu, setMenu] = useState<Msg | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [editing, setEditing] = useState<Msg | null>(null)
  const [busy, setBusy] = useState(false)
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)
  const [text, setText] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const [navH, setNavH] = useState(72)
  const box = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLFormElement>(null)
  const seen = useRef<Set<number>>(new Set())
  const firstLoad = useRef(true)
  const stick = useRef(true) // follow new messages only while the reader is already at the bottom

  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase.rpc('family_messages', { fid: family.id, lim: 100 })
      if (err) {
        const code = (err as { code?: string }).code
        setError(code === 'PGRST202' || code === '42883' ? 'Chat is not set up yet. In Supabase, run supabase/17_family_chat.sql, then 22_chat_message_options.sql.' : friendlyError(err, 'Could not load the chat.'))
        return
      }
      setError('')
      const rows = (Array.isArray(data) ? data : []) as Msg[]
      // Only change state when something is new, so the screen never flickers while polling.
      const sig = (l: Msg[]) => l.map((m) => `${m.id}:${m.edited_at ?? ''}`).join('|')
      setMessages((old) => (sig(old) === sig(rows) ? old : rows))
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
    // Distance from the bottom of the screen to the top of the bar. Measuring the bar's height alone is not enough
    // when the bar floats above the bottom edge (Glass theme), because the message box then sat behind it.
    const measure = () => {
      const r = nav.getBoundingClientRect()
      const floating = window.innerHeight - r.bottom > 2
      setNavH(Math.round(window.innerHeight - r.top) + (floating ? 8 : 0))
    }
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
  const visible = useScreenVisible()
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last && visible) markChatRead(family.id, last.id)
  }, [messages, family.id, visible])

  // The message bar is fixed to the screen, so while the pages slide it has to travel with its own page.
  useEffect(() => {
    const el = bar.current
    const pager = el?.closest<HTMLElement>('[data-pager]')
    const page = el?.closest<HTMLElement>('[data-pager-index]')
    if (!el || !pager || !page) return
    const index = Number(page.dataset.pagerIndex)
    const sync = () => {
      const dx = Math.round(index * pager.clientWidth - pager.scrollLeft)
      el.style.transform = dx ? `translate3d(${dx}px,0,0)` : ''
    }
    sync()
    pager.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => { pager.removeEventListener('scroll', sync); window.removeEventListener('resize', sync); el.style.transform = '' }
  }, [])

  // Coming back to Chat lands on the newest message.
  useEffect(() => {
    if (!visible || !loaded) return
    const id = requestAnimationFrame(() => end.current?.scrollIntoView({ block: 'end' }))
    return () => cancelAnimationFrame(id)
  }, [visible, loaded])

  useLayoutEffect(() => {
    if (!loaded || !visible) return
    if (firstLoad.current) {
      firstLoad.current = false
      end.current?.scrollIntoView({ block: 'end' })
    } else if (stick.current) {
      end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [messages, pending, loaded, visible])

  const clearPress = () => { if (press.current) { window.clearTimeout(press.current.timer); press.current = null } }
  useEffect(() => clearPress, [])

  function pressStart(e: React.PointerEvent, m: Msg) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    clearPress()
    press.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        press.current = null
        try { navigator.vibrate?.(15) } catch { /* not supported */ }
        setConfirmAll(false)
        setMenu(m)
      }, HOLD_MS),
    }
  }
  function pressMove(e: React.PointerEvent) {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) clearPress()
  }

  const canEdit = (m: Msg) => m.user_id === userId && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS
  const closeMenu = () => { setMenu(null); setConfirmAll(false) }

  // Runs one chat action, shows a clear message when the database part has not been set up yet.
  async function act(name: string, args: Record<string, unknown>, fallback: string): Promise<boolean> {
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.rpc(name, args)
      if (err) {
        const code = (err as { code?: string }).code
        setError(code === 'PGRST202' || code === '42883' ? 'This is not set up yet. In Supabase, run supabase/22_chat_message_options.sql.' : friendlyError(err, fallback))
        return false
      }
      return true
    } catch (e) {
      setError(friendlyError(e, `${fallback} Check your connection and try again.`))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function deleteForEveryone(id: number) {
    if (await act('delete_family_message', { mid: id }, 'Could not delete the message.')) {
      setMessages((old) => old.filter((m) => m.id !== id))
      closeMenu()
    }
  }

  async function deleteForMe(id: number) {
    if (await act('hide_family_message', { mid: id }, 'Could not delete the message.')) {
      setMessages((old) => old.filter((m) => m.id !== id))
      closeMenu()
    }
  }

  function startEdit(m: Msg) {
    closeMenu()
    setEditing(m)
    setText(m.body)
    requestAnimationFrame(() => { resize(); box.current?.focus() })
  }

  function cancelEdit() {
    setEditing(null)
    setText('')
    requestAnimationFrame(resize)
  }

  async function saveEdit() {
    if (!editing) return
    const body = text.trim().slice(0, MAX)
    if (!body) return
    if (body === editing.body) { cancelEdit(); return }
    if (await act('edit_family_message', { mid: editing.id, new_body: body }, 'Could not edit the message.')) {
      const id = editing.id
      setMessages((old) => old.map((m) => (m.id === id ? { ...m, body, edited_at: new Date().toISOString() } : m)))
      cancelEdit()
    }
  }

  function resize() {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }
  // Shrink back to one line after sending or cancelling an edit.
  useEffect(() => { resize() }, [text])

  async function send() {
    if (editing) { void saveEdit(); return }
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
        <p className="text-sm text-muted">Visible to the whole family. Hold a message for options.</p>
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
                    className={`select-none whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[0.95rem] leading-snug [-webkit-touch-callout:none] ${mine ? 'rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md border border-line bg-surface-2'} ${menu?.id === m.id ? 'outline outline-2 outline-offset-2 outline-accent' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${m.sender}: ${m.body}. Hold for options`}
                    onPointerDown={(e) => pressStart(e, m)}
                    onPointerMove={pressMove}
                    onPointerUp={clearPress}
                    onPointerCancel={clearPress}
                    onPointerLeave={clearPress}
                    onContextMenu={(e) => { e.preventDefault(); clearPress(); setConfirmAll(false); setMenu(m) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setConfirmAll(false); setMenu(m) } }}
                  >{m.body}</p>
                  {endsGroup && <p className="mt-0.5 px-1 text-[0.7rem] text-muted">{clock(d)}{m.edited_at ? ' · edited' : ''}</p>}
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
        ref={bar}
        className="fixed inset-x-0 z-30 border-t border-line bg-surface"
        style={{ bottom: navH }}
        onSubmit={(e) => { e.preventDefault(); void send() }}
      >
        {editing && (
          <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 pt-2 text-sm">
            <span className="min-w-0 truncate text-muted">Editing message</span>
            <button type="button" className="min-h-9 shrink-0 font-semibold underline underline-offset-2" onClick={cancelEdit}>Cancel</button>
          </div>
        )}
        <div className="mx-auto flex max-w-xl items-end gap-2 px-3 py-2">
          <textarea
            ref={box}
            className="input !min-h-11 flex-1 !resize-none !rounded-3xl !py-2.5 leading-snug"
            rows={1}
            maxLength={MAX}
            value={text}
            placeholder={editing ? 'Edit your message' : 'Message your family'}
            aria-label="Message"
            enterKeyHint="send"
            onChange={(e) => { setText(e.target.value); resize() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() }
            }}
          />
          {(() => {
            const ready = Boolean(text.trim()) && !busy
            return (
              <button
                type="submit"
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 bg-transparent p-0 transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${ready ? 'scale-100 text-accent-text active:bg-accent-soft' : 'scale-90 text-muted opacity-60'}`}
                aria-label={editing ? 'Save edit' : 'Send'}
                disabled={!ready}
              >
                <span style={ready ? { filter: 'drop-shadow(0 0 6px var(--accent))' } : undefined}><Icon name="send" size={24} /></span>
              </button>
            )
          })()}
        </div>
      </form>

      {menu && (
        <Sheet title="Message options" onClose={closeMenu}>
          <p className="mb-3 line-clamp-2 break-words text-sm text-muted">{menu.body}</p>
          {!confirmAll ? (
            <div className="flex flex-col gap-2">
              {canEdit(menu) && <button type="button" className="btn btn-plain" onClick={() => startEdit(menu)}>Edit</button>}
              <button type="button" className="btn btn-plain" disabled={busy} onClick={() => void deleteForMe(menu.id)}>Delete for me</button>
              {(menu.user_id === userId || canDelete) && (
                <button type="button" className="btn btn-plain !text-danger" disabled={busy} onClick={() => setConfirmAll(true)}>Delete for everyone</button>
              )}
              <button type="button" className="btn btn-plain" onClick={closeMenu}>Cancel</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm">Delete this message for the whole family?</p>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void deleteForEveryone(menu.id)}>{busy ? 'Deleting…' : 'Delete for everyone'}</button>
              <button type="button" className="btn btn-plain" disabled={busy} onClick={() => setConfirmAll(false)}>Back</button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  )
}
