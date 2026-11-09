import { Mark } from './Logo'
import { useState } from 'react'
import { WEB_APP_URL, canShare, shareImage, shareText } from '../lib/native'

type Theme = { id: string; name: string; from: string; to: string; accent: string }
const THEMES: Theme[] = [
  { id: 'midnight', name: 'Midnight', from: '#0e1116', to: '#1f2735', accent: '#a8c7fa' },
  { id: 'moon', name: 'Moon', from: '#000000', to: '#222222', accent: '#ffffff' },
  { id: 'sunset', name: 'Sunset', from: '#2b1020', to: '#7a2e3a', accent: '#ffd29a' },
  { id: 'forest', name: 'Forest', from: '#0d1f1a', to: '#1f4a3b', accent: '#9fe3c4' },
]

type Banner = { brand: string; headline: string; pitch: string; cta: string; theme: string; logo: number }
const DEFAULTS: Banner = {
  brand: 'Cznnect',
  headline: 'Your family, in one place',
  pitch: 'A private home for your family: a family tree, shared plans and places, birthday reminders and chat, all in one app.',
  cta: 'Use this link to unlock the full features',
  theme: 'midnight',
  logo: 50,
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

const COPYRIGHT = '© 2026 Sabahat Faizan. All rights reserved.'

// Draws the banner as a 1080x1350 (4:5) picture. That shape shows whole inside a WhatsApp chat or any feed without
// being cropped or needing a tap to open, which a tall story-sized picture does not. Returns base64 PNG.
function drawBanner(b: Banner): string | null {
  const t = THEMES.find((x) => x.id === b.theme) ?? THEMES[0]
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const bg = ctx.createLinearGradient(0, 0, 1080, 1350)
  bg.addColorStop(0, t.from)
  bg.addColorStop(1, t.to)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1080, 1350)
  // The Cznnect square (an O and a Z in one frame) sits faint in the middle, behind the text.
  ctx.save()
  ctx.globalAlpha = Math.min(100, Math.max(0, b.logo)) / 100
  ctx.translate(540 - 340, 675 - 340)
  ctx.scale(680 / 64, 680 / 64)
  const mark = ctx.createLinearGradient(6, 6, 58, 58)
  mark.addColorStop(0, '#ffffff')
  mark.addColorStop(0.4, t.accent)
  mark.addColorStop(1, '#ffffff')
  ctx.fillStyle = mark
  ctx.fill(new Path2D('M6 6H58V58H6Z M16 16V48H48V16Z'), 'evenodd')
  ctx.strokeStyle = mark
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.rect(6, 6, 52, 52)
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(0, 64)
  ctx.lineTo(64, 0)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = t.accent
  ctx.fillRect(90, 110, 130, 12)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 130px ${FONT}`
  ctx.fillText(b.brand.slice(0, 20), 90, 255, 900)
  ctx.font = `700 76px ${FONT}`
  wrap(ctx, b.headline, 900, 3).forEach((l, i) => ctx.fillText(l, 90, 370 + i * 90))
  ctx.fillStyle = '#d3d9e4'
  ctx.font = `400 40px ${FONT}`
  wrap(ctx, b.pitch, 900, 6).forEach((l, i) => ctx.fillText(l, 90, 650 + i * 54))
  ctx.fillStyle = t.accent
  ctx.font = `700 46px ${FONT}`
  wrap(ctx, b.cta, 900, 2).forEach((l, i) => ctx.fillText(l, 90, 1050 + i * 56))
  ctx.font = `600 42px ${FONT}`
  ctx.fillText(SHOWN_LINK, 90, 1190, 900)
  ctx.fillStyle = '#9aa3b2'
  ctx.font = `400 28px ${FONT}`
  ctx.fillText(COPYRIGHT, 90, 1296, 900)
  return canvas.toDataURL('image/png').split(',')[1] ?? null
}

// Owner tool: a banner you write yourself (name, headline, pitch, call to action, colours) and send as a picture with the link.
export default function ShareAppCard() {
  const [b, setB] = useState<Banner>(load)
  const [notice, setNotice] = useState('')
  const theme = THEMES.find((x) => x.id === b.theme) ?? THEMES[0]
  // The colon only follows a line that has text and no punctuation of its own; an empty line adds nothing.
  const cta = b.cta.trim()
  const ctaLine = cta ? (/[.:!?]$/.test(cta) ? cta : `${cta}:`) : ''
  const message = [[b.headline.trim(), b.pitch.trim()].filter(Boolean).join('\n'), ctaLine ? `${ctaLine}\n${WEB_APP_URL}` : WEB_APP_URL].filter(Boolean).join('\n\n')

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
      <div
        className="mx-auto relative flex w-full max-w-[280px] flex-col overflow-hidden rounded-2xl px-[23px] pb-[20px] pt-[24px] text-white"
        style={{ aspectRatio: '4 / 5', background: `linear-gradient(160deg,${theme.from},${theme.to})` }}
      >
        {/* The faint square in the middle, same as on the picture that gets shared. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center" style={{ opacity: b.logo / 100 }}>
          <Mark className="h-3/5 w-3/5" />
        </div>
        <div className="relative mb-[10px] h-[3px] w-[34px] rounded-full" style={{ background: theme.accent }} />
        <p className="relative font-display text-[34px] font-extrabold leading-none">{b.brand}</p>
        <p className="relative mt-[18px] text-[20px] font-bold leading-[1.18]">{b.headline}</p>
        <p className="relative mt-[18px] text-[10.4px] leading-[1.35]" style={{ color: '#d3d9e4' }}>{b.pitch}</p>
        <div className="relative mt-auto">
          {b.cta.trim() && <p className="text-[12px] font-bold leading-[1.2]" style={{ color: theme.accent }}>{b.cta}</p>}
          <p className="mt-[8px] text-[11px] font-semibold" style={{ color: theme.accent }}>{SHOWN_LINK}</p>
          <p className="mt-[16px] text-[7px]" style={{ color: '#9aa3b2' }}>{COPYRIGHT}</p>
        </div>
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
      <label className="label" htmlFor="share-logo">Logo strength: {b.logo}%</label>
      <input id="share-logo" type="range" min={0} max={100} step={5} value={b.logo} onChange={(e) => edit({ logo: Number(e.target.value) })} className="w-full" />
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
