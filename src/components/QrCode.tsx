import { useMemo } from 'react'
import { create } from 'qrcode'

// Draws a QR code as a styled SVG: rounded bars and dots, ring-style corner markers, on a lobed tile.
// Always dark on light, in every theme, because phone cameras read that best.
const INK = '#0b1220'
const TILE = '#eef0f3'

function build(text: string) {
  const { size, data } = create(text, { errorCorrectionLevel: 'M' }).modules
  const at = (x: number, y: number) => data[y * size + x] === 1
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
  const unit = 60 / size
  const origin = 20
  const shapes: { k: string; p: Record<string, number> }[] = []
  for (let y = 0; y < size; y++) {
    let x = 0
    while (x < size) {
      if (at(x, y) && !finder(x, y)) {
        const start = x
        while (x < size && at(x, y) && !finder(x, y) && x - start < 3) x++
        const run = x - start
        if (run === 1) {
          shapes.push({ k: 'c', p: { cx: origin + (start + 0.5) * unit, cy: origin + (y + 0.5) * unit, r: unit * 0.46 } })
        } else {
          shapes.push({
            k: 'r',
            p: {
              x: origin + start * unit + unit * 0.04,
              y: origin + y * unit + unit * 0.04,
              width: run * unit - unit * 0.08,
              height: unit * 0.92,
              rx: unit * 0.46,
            },
          })
        }
      } else x++
    }
  }
  const corners = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ].map(([fx, fy]) => ({ cx: origin + (fx + 3.5) * unit, cy: origin + (fy + 3.5) * unit }))
  return { shapes, corners, unit }
}

export default function QrCode({ text, size = 232, label }: { text: string; size?: number; label: string }) {
  const art = useMemo(() => {
    try {
      return build(text)
    } catch {
      return null
    }
  }, [text])

  if (!art) {
    return <p className="p-6 text-center text-sm font-bold text-danger">Could not draw the code. Use the typed code below.</p>
  }

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label} style={{ maxWidth: '100%', height: 'auto' }}>
      <g fill={TILE}>
        <circle cx="26" cy="26" r="26" />
        <circle cx="74" cy="26" r="26" />
        <circle cx="26" cy="74" r="26" />
        <circle cx="74" cy="74" r="26" />
        <rect x="10" y="10" width="80" height="80" rx="14" />
      </g>
      <g fill={INK}>
        {art.shapes.map((s, i) => (s.k === 'c' ? <circle key={i} {...s.p} /> : <rect key={i} {...s.p} />))}
        {art.corners.map((c, i) => (
          <g key={`f${i}`}>
            <circle cx={c.cx} cy={c.cy} r={art.unit * 3} fill="none" stroke={INK} strokeWidth={art.unit} />
            <circle cx={c.cx} cy={c.cy} r={art.unit * 1.6} />
          </g>
        ))}
      </g>
    </svg>
  )
}
