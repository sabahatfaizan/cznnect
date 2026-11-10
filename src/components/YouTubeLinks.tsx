import { useEffect, useState } from 'react'

// Paste a YouTube link and play it with YouTube's own embedded player. Nothing is downloaded or extracted: the
// official player does the playing, so it needs a connection, some videos refuse to be embedded, and it usually
// pauses when the app goes to the background or the screen locks. Only the links are remembered, on this phone.
type Item = { id: string; kind: 'video' | 'list'; title: string }
const KEY = 'cznnect-music-youtube'

function parse(input: string): { id: string; kind: 'video' | 'list' } | null {
  const text = input.trim()
  if (!text) return null
  let url: URL
  try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`) } catch { return null }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  const okId = (v: string | null | undefined) => (v && /^[A-Za-z0-9_-]{6,}$/.test(v) ? v : null)
  if (host === 'youtu.be') {
    const id = okId(url.pathname.split('/')[1])
    return id ? { id, kind: 'video' } : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = okId(url.searchParams.get('v'))
    if (v) return { id: v, kind: 'video' }
    const parts = url.pathname.split('/').filter(Boolean)
    if (['shorts', 'embed', 'live', 'v'].includes(parts[0]) && okId(parts[1]) && parts[1] !== 'videoseries') return { id: parts[1], kind: 'video' }
    const list = okId(url.searchParams.get('list'))
    if (list) return { id: list, kind: 'list' }
  }
  return null
}

function load(): Item[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Item[]
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.id === 'string' && typeof i.title === 'string') : []
  } catch { return [] }
}

export type NowPlaying = { key: string; id: string; kind: 'video' | 'list'; title: string }

export default function YouTubeLinks({ onStart, onNow, halt }: { onStart: () => void; onNow: (n: NowPlaying | null) => void; halt: number }) {
  const [items, setItems] = useState<Item[]>(load)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* the list just is not remembered */ }
  }, [items])

  // Playing a song from the phone stops the YouTube player.
  useEffect(() => { setPlaying(null) }, [halt])

  async function add() {
    const p = parse(text)
    if (!p) { setError('That does not look like a YouTube link.'); return }
    setError('')
    setText('')
    const key = `${p.kind}:${p.id}`
    if (!items.some((i) => `${i.kind}:${i.id}` === key)) {
      let title = p.kind === 'list' ? 'YouTube playlist' : 'YouTube video'
      if (p.kind === 'video') {
        try {
          const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${p.id}`)}`)
          if (r.ok) title = String(((await r.json()) as { title?: string }).title || title)
        } catch { /* offline or blocked: the generic name stays */ }
      }
      setItems((prev) => [...prev, { id: p.id, kind: p.kind, title }])
    }
    play(key)
  }

  function play(key: string) {
    onStart()
    setPlaying(key)
  }

  const now = items.find((i) => `${i.kind}:${i.id}` === playing)
  const nowKey = now ? `${now.kind}:${now.id}` : ''
  const nowTitle = now?.title ?? ''
  const nowId = now?.id ?? ''
  const nowKind = now?.kind ?? 'video'
  // Tells the page (and Listen together) which video is playing, or that none is.
  useEffect(() => {
    onNow(nowKey ? { key: nowKey, id: nowId, kind: nowKind, title: nowTitle } : null)
  }, [nowKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="space-y-3" aria-label="YouTube links">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add() }}>
        <input className="input min-w-0 flex-1" inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder="Paste a YouTube link" value={text} onChange={(e) => { setText(e.target.value); setError('') }} aria-label="YouTube link" />
        <button type="submit" className="btn btn-primary">Play</button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {items.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-line">
          {items.map((i) => {
            const key = `${i.kind}:${i.id}`
            const on = key === playing
            return (
              <li key={key} className={`flex items-center border-b border-line last:border-b-0 ${on ? 'bg-[var(--accent-soft)]' : ''}`}>
                <button type="button" onClick={() => play(key)} className={`min-w-0 flex-1 truncate px-4 py-3 text-left ${on ? 'font-semibold text-[var(--accent-text)]' : ''}`}>{i.title}</button>
                <button type="button" aria-label={`Remove ${i.title}`} onClick={() => { setItems((p) => p.filter((x) => `${x.kind}:${x.id}` !== key)); if (on) setPlaying(null) }} className="px-4 py-3 text-lg leading-none text-muted">×</button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
