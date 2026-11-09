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

type Banner = { brand: string; headline: string; pitch: string; cta: string; theme: string; logo: number; stores: boolean }
const DEFAULTS: Banner = {
  brand: 'Cznnect',
  headline: 'Your family, in one place',
  pitch: 'A private home for your family: a family tree, shared plans and places, birthday reminders and chat, all in one app.',
  cta: 'Use this link to unlock the full features',
  theme: 'midnight',
  logo: 50,
  stores: true,
}
// The Android and Apple logos (24x24), drawn in the banner's own accent colour so they match its theme.
const ANDROID_PATH = 'M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0004.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396'
const APPLE_PATH = 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701'
const STORES = [
  { label: 'Android', path: ANDROID_PATH },
  { label: 'iPhone', path: APPLE_PATH },
] as const

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
  wrap(ctx, b.cta, 900, 2).forEach((l, i) => ctx.fillText(l, 90, (b.stores ? 1015 : 1050) + i * 56))
  if (b.stores) {
    // "Available on" badges: a pill each for Android and iPhone, in the accent colour.
    ctx.font = `700 32px ${FONT}`
    let x = 90
    for (const st of STORES) {
      const textW = ctx.measureText(st.label).width
      const w = 28 + 36 + 12 + textW + 28
      ctx.save()
      ctx.globalAlpha = 0.16
      ctx.fillStyle = t.accent
      ctx.beginPath()
      ctx.roundRect(x, 1085, w, 70, 35)
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = t.accent
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(x, 1085, w, 70, 35)
      ctx.stroke()
      ctx.save()
      ctx.translate(x + 28, 1085 + 17)
      ctx.scale(36 / 24, 36 / 24)
      ctx.fillStyle = t.accent
      ctx.fill(new Path2D(st.path))
      ctx.restore()
      ctx.fillStyle = t.accent
      ctx.fillText(st.label, x + 28 + 36 + 12, 1085 + 46)
      x += w + 20
    }
  }
  ctx.font = `600 42px ${FONT}`
  ctx.fillStyle = t.accent
  ctx.fillText(SHOWN_LINK, 90, b.stores ? 1228 : 1190, 900)
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
          {b.stores && (
            <div className="mt-[8px] flex gap-[5px]">
              {STORES.map((st) => (
                <span key={st.label} className="inline-flex items-center gap-[3px] rounded-full border px-[7px] py-[2px] text-[8px] font-bold" style={{ color: theme.accent, borderColor: theme.accent, background: `color-mix(in srgb, ${theme.accent} 16%, transparent)` }}>
                  <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" aria-hidden="true"><path d={st.path} /></svg>
                  {st.label}
                </span>
              ))}
            </div>
          )}
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
      <label className="flex items-center justify-between gap-3 text-sm font-semibold" htmlFor="share-stores">
        Show “Android” and “iPhone” badges
        <input id="share-stores" type="checkbox" className="h-5 w-5" style={{ accentColor: 'var(--accent)' }} checked={b.stores} onChange={(e) => edit({ stores: e.target.checked })} />
      </label>
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
