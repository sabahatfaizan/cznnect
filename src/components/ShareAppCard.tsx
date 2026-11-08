import { useState } from 'react'
import { WEB_APP_URL, canShare, shareText } from '../lib/native'

const KEY = 'cznnect-share-pitch'
const HEADLINE = 'Your family, in one place'
const DEFAULT_PITCH =
  'Cznnect is a private home for your family: a family tree, shared plans and places, birthday reminders and chat, all in one app.'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

// Draws the banner as a 1200x630 picture, the size link previews and status posts use.
function makeBanner(pitch: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  const bg = ctx.createLinearGradient(0, 0, 1200, 630)
  bg.addColorStop(0, '#0e1116')
  bg.addColorStop(1, '#1f2735')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1200, 630)
  ctx.fillStyle = '#a8c7fa'
  ctx.fillRect(80, 96, 96, 8)
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 112px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText('Cznnect', 80, 220)
  ctx.font = '700 52px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(HEADLINE, 80, 306)
  ctx.fillStyle = '#c9d1de'
  ctx.font = '400 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  wrap(ctx, pitch, 1040).slice(0, 4).forEach((l, i) => ctx.fillText(l, 80, 380 + i * 48))
  ctx.fillStyle = '#a8c7fa'
  ctx.font = '600 32px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(WEB_APP_URL.replace(/^https?:\/\//, ''), 80, 570)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

// Owner tool: a banner and a short pitch that can be sent to anyone, from the Admin panel.
export default function ShareAppCard() {
  const [pitch, setPitch] = useState(() => {
    try { return localStorage.getItem(KEY) || DEFAULT_PITCH } catch { return DEFAULT_PITCH }
  })
  const [notice, setNotice] = useState('')
  const message = `${pitch.trim()}\n${WEB_APP_URL}`

  function edit(value: string) {
    setPitch(value)
    try { localStorage.setItem(KEY, value) } catch { /* private mode: the text just is not remembered */ }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setNotice('Copied. Paste it anywhere.')
    } catch { setNotice('Could not copy. Select the text and copy it by hand.') }
  }

  async function sharePitch() {
    try {
      if (canShare()) await shareText(message, 'Cznnect')
      else await copy()
    } catch { /* closed the share sheet */ }
  }

  async function shareBanner() {
    setNotice('')
    const blob = await makeBanner(pitch.trim() || DEFAULT_PITCH)
    if (!blob) { setNotice('Could not draw the banner here.'); return }
    const file = new File([blob], 'cznnect-banner.png', { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message })
        return
      }
    } catch { return /* closed the share sheet */ }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'cznnect-banner.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    setNotice('Banner saved as a picture. Send it with the link.')
  }

  return (
    <section className="card flex flex-col gap-3" aria-label="Share the app">
      <p className="eyebrow">Banner preview</p>
      <div className="overflow-hidden rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg,#0e1116,#1f2735)' }}>
        <div className="mb-3 h-1 w-10 rounded-full" style={{ background: '#a8c7fa' }} />
        <p className="font-display text-4xl font-extrabold leading-none">Cznnect</p>
        <p className="mt-2 text-lg font-bold">{HEADLINE}</p>
        <p className="mt-2 text-sm" style={{ color: '#c9d1de' }}>{pitch.trim() || DEFAULT_PITCH}</p>
        <p className="mt-3 text-sm font-semibold" style={{ color: '#a8c7fa' }}>{WEB_APP_URL.replace(/^https?:\/\//, '')}</p>
      </div>
      <label className="label" htmlFor="share-pitch">Your pitch</label>
      <textarea id="share-pitch" className="input min-h-24" maxLength={220} value={pitch} onChange={(e) => edit(e.target.value)} />
      <button type="button" className="btn btn-primary" onClick={() => void shareBanner()}>Share banner</button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-plain" onClick={() => void sharePitch()}>Share text</button>
        <button type="button" className="btn btn-plain" onClick={() => void copy()}>Copy</button>
      </div>
      <button type="button" className="btn btn-plain" onClick={() => edit(DEFAULT_PITCH)}>Reset pitch</button>
      {notice && <p role="status" className="text-center text-sm font-semibold">{notice}</p>}
    </section>
  )
}
