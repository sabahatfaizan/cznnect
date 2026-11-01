import { useEffect, useRef, useState } from 'react'
import { AVATAR_COLORS, hexToHsv, hsvToHex, type Hsv } from '../lib/avatars'

const SIZE = 184 // CSS pixels
const SWATCHES = [...AVATAR_COLORS.map((c) => c[0]), '#111111', '#6b7280', '#f6ecd2', '#ffffff']

// A colour wheel: go round for the colour, in or out for how strong it is, then the slider for how bright.
// There is also a hex box and a row of quick swatches. Calls onChange with "#rrggbb".
export default function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))
  const [typed, setTyped] = useState(value)

  // Follow outside changes (a swatch, or another part of the page) without fighting the wheel while it is dragged.
  useEffect(() => {
    if (hsvToHex(hsv) !== value.toLowerCase()) setHsv(hexToHsv(value))
    setTyped(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const px = Math.round(SIZE * dpr)
    c.width = c.height = px
    const g = c.getContext('2d')
    if (!g) return
    const img = g.createImageData(px, px)
    const R = px / 2
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const dx = x + 0.5 - R
        const dy = y + 0.5 - R
        const d = Math.hypot(dx, dy)
        if (d > R) continue
        const hex = hsvToHex({ h: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, s: d / R, v: 1 })
        const n = parseInt(hex.slice(1), 16)
        const i = (y * px + x) * 4
        img.data[i] = (n >> 16) & 255
        img.data[i + 1] = (n >> 8) & 255
        img.data[i + 2] = n & 255
        img.data[i + 3] = Math.round(255 * Math.min(1, R - d + 0.5))
      }
    }
    g.putImageData(img, 0, 0)
  }, [])

  function push(next: Hsv) {
    setHsv(next)
    onChange(hsvToHex(next))
  }

  function pick(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    const R = r.width / 2
    push({ h: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, s: Math.min(1, Math.hypot(dx, dy) / R), v: hsv.v })
  }

  const a = (hsv.h * Math.PI) / 180
  const mx = SIZE / 2 + Math.cos(a) * hsv.s * (SIZE / 2)
  const my = SIZE / 2 + Math.sin(a) * hsv.s * (SIZE / 2)
  const full = hsvToHex({ h: hsv.h, s: hsv.s, v: 1 })

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="presentation"
        className="color-wheel"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e) }}
        onPointerMove={(e) => { if (e.buttons) pick(e) }}
      >
        <canvas ref={canvas} style={{ width: SIZE, height: SIZE }} aria-hidden="true" />
        <span className="color-wheel-dot" style={{ left: mx, top: my, background: value }} />
      </div>
      <label className="flex w-full max-w-[16rem] items-center gap-3 text-sm font-bold">
        <span className="w-14 flex-none text-muted">Bright</span>
        <input
          type="range"
          min={15}
          max={100}
          value={Math.round(hsv.v * 100)}
          aria-label="Brightness"
          onChange={(e) => push({ ...hsv, v: Number(e.target.value) / 100 })}
          className="color-slider"
          style={{ background: `linear-gradient(90deg, #000, ${full})` }}
        />
      </label>
      <div className="flex w-full max-w-[16rem] items-center gap-3">
        <span className="size-9 flex-none rounded-full border border-line" style={{ background: value }} aria-hidden="true" />
        <input
          className="input !min-h-10 text-center font-mono uppercase"
          value={typed}
          maxLength={7}
          spellCheck={false}
          autoCapitalize="characters"
          aria-label="Colour code"
          onChange={(e) => {
            const t = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            setTyped(t)
            if (/^#[0-9a-fA-F]{6}$/.test(t)) {
              setHsv(hexToHsv(t))
              onChange(t.toLowerCase())
            }
          }}
        />
      </div>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Quick colours">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Use ${c}`}
            onClick={() => { setHsv(hexToHsv(c)); onChange(c) }}
            className={`size-7 rounded-full border border-line ${value.toLowerCase() === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}
