import { useEffect, useMemo, useState } from 'react'
import { DIRECT, EMAIL_CATEGORIES, categoryLabel, type EmailKind } from '../lib/emailCategories'
import { optedOut, recentEmails, sendCustomEmail, type EmailLogRow } from '../lib/customEmails'
import { shownName } from '../lib/avatars'

// Admin > Custom emails. Pick a category, pick the people, write the message, send. People who switched that category
// off are skipped by the server (and marked here), except for "Important notices".
// "Direct message" is different: one person, any message, sent whatever their email switches say, replies come to you.
type U = { user_id: string; display_name: string; nickname: string | null; email: string | null }

export default function CustomEmails({ users, ownerId }: { users: U[] | null; ownerId: string }) {
  const [category, setCategory] = useState<EmailKind>('updates')
  const direct = category === DIRECT
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [off, setOff] = useState<Set<string> | null>(new Set())
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [history, setHistory] = useState<EmailLogRow[]>([])

  useEffect(() => { void recentEmails().then(setHistory) }, [])
  useEffect(() => {
    if (category === 'important' || category === DIRECT) { setOff(new Set()); return }
    let live = true
    void optedOut(category).then((s) => { if (live) setOff(s) })
    return () => { live = false }
  }, [category])

  const withEmail = useMemo(() => (users ?? []).filter((u) => u.email), [users])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return withEmail.filter((u) => !q || `${shownName(u)} ${u.display_name} ${u.email}`.toLowerCase().includes(q))
  }, [withEmail, search])
  const isOff = (id: string) => category !== 'important' && !direct && Boolean(off?.has(id))
  const willSkip = [...picked].filter(isOff).length
  const willSend = picked.size - willSkip
  const cat = direct
    ? { id: DIRECT, label: 'Direct message', hint: 'A personal message to one person', required: true }
    : EMAIL_CATEGORIES.find((c) => c.id === category)!
  const person = direct && picked.size === 1 ? withEmail.find((u) => picked.has(u.user_id)) : undefined

  // A direct message has exactly one person: choosing someone replaces the last choice.
  const toggle = (id: string) => setPicked((p) => {
    if (direct) return p.has(id) ? new Set() : new Set([id])
    const n = new Set(p)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const pickCategory = (c: EmailKind) => {
    setCategory(c)
    // Going into or out of a direct message starts the choice again, so a list of people is never sent as one.
    if (c === DIRECT || direct) setPicked(new Set())
  }
  const written = subject.trim().length > 0 && body.trim().length > 0
  const ready = written && (!direct || picked.size === 1) // a test only goes to you, so it needs no person

  async function run(test: boolean) {
    if (test ? !written : !ready) { setNote({ ok: false, text: direct && !test ? 'Choose one person and write a subject and a message first.' : 'Write a subject and a message first.' }); return }
    if (!test) {
      if (willSend === 0) { setNote({ ok: false, text: 'Choose at least one person who accepts this category.' }); return }
      const to = direct ? (person ? person.display_name || person.email : 'this person') : `${willSend} ${willSend === 1 ? 'person' : 'people'} under ${cat.label}`
      if (!window.confirm(`Send “${subject.trim()}” to ${to}?`)) return
    }
    setBusy(true)
    setNote(null)
    const r = await sendCustomEmail({ category, subject: subject.trim(), body: body.trim(), userIds: [...picked], test })
    setBusy(false)
    if (!r.ok) { setNote({ ok: false, text: r.message }); return }
    const { sent, skipped, failed } = r.data
    setNote({ ok: failed === 0, text: test ? 'Test sent to your own email.' : `Sent to ${sent}. ${skipped ? `${skipped} skipped. ` : ''}${failed ? `${failed} failed.` : ''}`.trim() })
    if (!test) { setSubject(''); setBody(''); setPicked(new Set()); void recentEmails().then(setHistory) }
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="card flex flex-col gap-3">
        <p className="eyebrow">Category</p>
        <div role="radiogroup" aria-label="Email category" className="flex flex-wrap gap-2">
          {EMAIL_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={category === c.id}
              onClick={() => pickCategory(c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold ${category === c.id ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'}`}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={direct}
            onClick={() => pickCategory(DIRECT)}
            className={`rounded-full border px-3 py-1.5 text-sm font-bold ${direct ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'}`}
          >
            Direct message
          </button>
        </div>
        <p className="text-xs text-muted">{cat.hint}. {direct ? 'Choose one person. It is sent even if they turned emails off, and their reply comes to your own email.' : cat.required ? 'Sent to everyone you pick.' : 'People who turned this category off are skipped.'}</p>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">{direct ? `To${person ? `: ${person.display_name || person.email}` : ''}` : `Who (${picked.size} chosen${willSkip ? ` · ${willSkip} will be skipped` : ''})`}</p>
          <span className="text-xs text-muted">{direct ? 'Just one person' : 'Max 200 per send'}</span>
        </div>
        <input className="input" type="search" placeholder="Search name or email" aria-label="Search people" value={search} onChange={(e) => setSearch(e.target.value)} />
        {!direct && <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-plain !min-h-9 !px-3 !text-xs" onClick={() => setPicked(new Set(withEmail.filter((u) => !isOff(u.user_id)).slice(0, 200).map((u) => u.user_id)))}>
            Everyone who accepts this
          </button>
          <button type="button" className="btn btn-plain !min-h-9 !px-3 !text-xs" onClick={() => setPicked((p) => { const n = new Set(p); shown.forEach((u) => { if (!isOff(u.user_id)) n.add(u.user_id) }); return n })}>
            Add shown
          </button>
          <button type="button" className="btn btn-plain !min-h-9 !px-3 !text-xs" onClick={() => setPicked(new Set())}>Clear</button>
        </div>}
        {!users && <p className="text-sm text-muted">Loading people…</p>}
        {off === null && <p role="status" className="text-xs text-muted">Run supabase/32_custom_emails.sql so opt-outs can be shown.</p>}
        <ul className="flex max-h-72 flex-col overflow-y-auto divide-y divide-line">
          {shown.map((u) => {
            const on = picked.has(u.user_id)
            return (
              <li key={u.user_id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
                  <input type={direct ? 'radio' : 'checkbox'} name={direct ? 'ce-direct-person' : undefined} className="size-5 accent-[var(--accent)]" checked={on} onChange={() => toggle(u.user_id)} onClick={direct && on ? () => toggle(u.user_id) : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{shownName(u)}{u.user_id === ownerId && <span className="ml-1.5 text-xs text-muted">you</span>}</span>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                  </span>
                  {isOff(u.user_id) && <span className="shrink-0 text-xs font-bold text-muted">turned off</span>}
                </label>
              </li>
            )
          })}
          {users && shown.length === 0 && <li className="py-3 text-sm text-muted">No one matches.</li>}
        </ul>
      </section>

      <section className="card flex flex-col gap-3">
        <p className="eyebrow">Message</p>
        <label className="label" htmlFor="ce-subject">Subject</label>
        <input id="ce-subject" className="input" maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label className="label" htmlFor="ce-body">Message</label>
        <textarea id="ce-body" className="input !min-h-40" maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={direct ? 'Write plain text. Leave a blank line between paragraphs.\nThey are greeted by name.' : 'Write plain text. Leave a blank line between paragraphs.\nEach person is greeted by name.'} />
        <div className="flex justify-between text-xs text-muted"><span>Plain text only</span><span>{body.length}/5000</span></div>
        <button type="button" className="link self-start" onClick={() => setPreview((p) => !p)}>{preview ? 'Hide preview' : 'Preview'}</button>
        {preview && (
          <div className="overflow-hidden rounded-lg border border-line bg-white text-[#202124]">
            <div className="px-6 pt-6 text-base font-bold tracking-wide">Cznnect</div>
            <div className="px-6 pb-2 pt-6">
              <h2 className="mb-4 text-2xl font-normal leading-tight">{subject.trim() || 'Subject'}</h2>
              <p className="mb-4 text-sm leading-relaxed text-[#3c4043]">Hi {direct && person ? shownName(person) : 'Name'},</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3c4043]">{body.trim() || 'Your message…'}</p>
            </div>
            <div className="px-6 pb-8 pt-4">
              <span className="inline-block rounded-md bg-[#1a56db] px-6 py-3 text-sm font-bold text-white">Open Cznnect</span>
            </div>
            <div className="mx-6 border-t border-[#e3e5e8]" />
            <div className="px-6 py-7 text-center text-xs leading-relaxed text-[#80868b]">
              <p className="mb-3 text-[15px] font-bold tracking-wide">Cznnect</p>
              <p>© 2026 Cznnect</p>
              <p className="mt-3">{direct ? 'You have received this email because someone at Cznnect sent you a personal message.' : category === 'important' ? 'You have received this mandatory service announcement because it contains important information about your Cznnect account.' : `You have received this email because you have a Cznnect account and are subscribed to ${cat.label} emails. You can manage your email preferences in Cznnect under Settings, then Emails.`}</p>
            </div>
          </div>
        )}
        {note && <p role="status" className={`text-sm font-semibold ${note.ok ? '' : 'text-danger'}`}>{note.text}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-plain !min-h-11 !text-sm" disabled={busy || !written} onClick={() => void run(true)}>Send test to me</button>
          <button type="button" className="btn btn-primary !min-h-11 !text-sm" disabled={busy || !ready || willSend === 0} onClick={() => void run(false)}>{busy ? 'Sending…' : direct ? (person ? `Send to ${person.display_name || person.email}` : 'Choose a person') : `Send to ${willSend}`}</button>
        </div>
      </section>

      {history.length > 0 && (
        <section className="card flex flex-col gap-2">
          <p className="eyebrow">Recent sends</p>
          {history.map((h) => (
            <div key={h.id} className="text-sm">
              <p className="font-semibold">{h.subject}</p>
              <p className="text-xs text-muted">{categoryLabel(h.category)} · {h.sent} sent{h.skipped ? ` · ${h.skipped} skipped` : ''}{h.failed ? ` · ${h.failed} failed` : ''} · {new Date(h.created_at).toLocaleString()}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
