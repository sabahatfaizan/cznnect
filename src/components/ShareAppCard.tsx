import { useState } from 'react'
import { WEB_APP_URL, canShare, shareImage, shareText } from '../lib/native'

type Theme = { id: string; name: string; from: string; to: string; accent: string }
const THEMES: Theme[] = [
  { id: 'midnight', name: 'Midnight', from: '#0e1116', to: '#1f2735', accent: '#a8c7fa' },
  { id: 'moon', name: 'Moon', from: '#000000', to: '#222222', accent: '#ffffff' },
  { id: 'sunset', name: 'Sunset', from: '#2b1020', to: '#7a2e3a', accent: '#ffd29a' },
  { id: 'forest', name: 'Forest', from: '#0d1f1a', to: '#1f4a3b', accent: '#9fe3c4' },
]

type Banner = { brand: string; headline: string; pitch: string; cta: string; theme: string }
const DEFAULTS: Banner = {
  brand: 'Cznnect',
  headline: 'Your family, in one place',
  pitch: 'A private home for your family: a family tree, shared plans and places, birthday reminders and chat, all in one app.',
  cta: 'Use this link to unlock the full features',
  theme: 'midnight',
}
const KEY = 'cznnect-share-banner'
const SHOWN_LINK = WEB_APP_URL.replace(/^https?:\/\//, '')
const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

function load(): Banner {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Banner>) }
  } catch { /* nothing saved yet */ }
  return DEFAULTS
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

// Draws the banner as a 1200x630 picture, the size link previews and status posts use. Returns base64 PNG.
function drawBanner(b: Banner): string | null {
  const t = THEMES.find((x) => x.id === b.theme) ?? THEMES[0]
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const bg = ctx.createLinearGradient(0, 0, 1200, 630)
  bg.addColorStop(0, t.from)
  bg.addColorStop(1, t.to)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1200, 630)
  ctx.fillStyle = t.accent
  ctx.fillRect(80, 76, 96, 8)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 96px ${FONT}`
  ctx.fillText(b.brand.slice(0, 20), 80, 186, 1040)
  ctx.font = `700 54px ${FONT}`
  wrap(ctx, b.headline, 1040, 2).forEach((l, i) => ctx.fillText(l, 80, 262 + i * 64))
  ctx.fillStyle = '#d3d9e4'
  ctx.font = `400 32px ${FONT}`
  wrap(ctx, b.pitch, 1040, 3).forEach((l, i) => ctx.fillText(l, 80, 400 + i * 44))
  ctx.fillStyle = t.accent
  ctx.font = `700 34px ${FONT}`
  ctx.fillText(b.cta, 80, 556, 1040)
  ctx.font = `600 30px ${FONT}`
  ctx.fillText(SHOWN_LINK, 80, 598, 1040)
  return canvas.toDataURL('image/png').split(',')[1] ?? null
}

// Owner tool: a banner you write yourself (name, headline, pitch, call to action, colours) and send as a picture with the link.
export default function ShareAppCard() {
  const [b, setB] = useState<Banner>(load)
  const [notice, setNotice] = useState('')
  const theme = THEMES.find((x) => x.id === b.theme) ?? THEMES[0]
  const message = [b.headline.trim(), b.pitch.trim(), '', `${b.cta.trim()}:`, WEB_APP_URL].filter((l, i) => l !== '' || i === 2).join('\n')

  function edit(patch: Partial<Banner>) {
    const next = { ...b, ...patch }
    setB(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: the text just is not remembered */ }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setNotice('Copied. Paste it anywhere.')
    } catch { setNotice('Could not copy. Select the text and copy it by hand.') }
  }

  async function sharePicture() {
    setNotice('')
    const data = drawBanner(b)
    if (!data) { setNotice('Could not draw the banner here.'); return }
    if (await shareImage(data, message)) return
    // This phone cannot send a picture directly, so the text goes out instead.
    try {
      if (canShare()) await shareText(message, b.brand)
      else await copy()
      setNotice('This phone could not send the picture, so the text and link were shared.')
    } catch { /* closed the share sheet */ }
  }

  async function shareMessage() {
    try {
      if (canShare()) await shareText(message, b.brand)
      else await copy()
    } catch { /* closed the share sheet */ }
  }

  const field = (id: keyof Banner, label: string, max: number, multi = false) => (
    <>
      <label className="label" htmlFor={`share-${id}`}>{label}</label>
      {multi ? (
        <textarea id={`share-${id}`} className="input min-h-20" maxLength={max} value={b[id]} onChange={(e) => edit({ [id]: e.target.value })} />
      ) : (
        <input id={`share-${id}`} className="input" maxLength={max} value={b[id]} onChange={(e) => edit({ [id]: e.target.value })} />
      )}
    </>
  )

  return (
    <section className="card flex flex-col gap-3" aria-label="Share the app">
      <p className="eyebrow">Banner preview</p>
      <div className="overflow-hidden rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg,${theme.from},${theme.to})` }}>
        <div className="mb-3 h-1 w-10 rounded-full" style={{ background: theme.accent }} />
        <p className="font-display text-3xl font-extrabold leading-none">{b.brand}</p>
        <p className="mt-2 text-lg font-bold">{b.headline}</p>
        <p className="mt-2 text-sm" style={{ color: '#d3d9e4' }}>{b.pitch}</p>
        <p className="mt-3 text-sm font-bold" style={{ color: theme.accent }}>{b.cta}</p>
        <p className="text-sm font-semibold" style={{ color: theme.accent }}>{SHOWN_LINK}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Banner colours">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={b.theme === t.id}
            aria-label={t.name}
            title={t.name}
            onClick={() => edit({ theme: t.id })}
            className="h-10 w-10 rounded-full border-2"
            style={{ background: `linear-gradient(135deg,${t.from},${t.to})`, borderColor: b.theme === t.id ? t.accent : 'transparent', outline: b.theme === t.id ? `2px solid ${t.accent}` : 'none', outlineOffset: 2 }}
          />
        ))}
      </div>
      {field('brand', 'Name', 20)}
      {field('headline', 'Headline', 70)}
      {field('pitch', 'Pitch', 200, true)}
      {field('cta', 'Line above the link', 60)}
      <p className="text-xs text-muted">The link is always {SHOWN_LINK}.</p>
      <button type="button" className="btn btn-primary" onClick={() => void sharePicture()}>Share banner</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-plain" onClick={() => void shareMessage()}>Share text only</button>
        <button type="button" className="btn btn-plain" onClick={() => void copy()}>Copy</button>
      </div>
      <button type="button" className="btn btn-plain" onClick={() => { setB(DEFAULTS); try { localStorage.removeItem(KEY) } catch { /* ignore */ } }}>Reset banner</button>
      {notice && <p role="status" className="text-center text-sm font-semibold">{notice}</p>}
    </section>
  )
}
