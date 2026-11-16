import { useMemo } from 'react'
import { create } from 'qrcode'

// Draws a QR code as a styled SVG: rounded bars and dots, ring-style corner markers, on a softly blended lobed tile with faint dots in the gaps.
// Always dark on light, in every theme, because phone cameras read that best.
const INK = '#0b1220'
const TILE = '#eef0f3'
const SPECK = '#cdd2dc' // the faint dots that fill the gaps, like the Android Wi-Fi share code

// One smooth, blended outline: a lobe in each corner, joined by gently dipped sides (no sharp notches).
const TILE_PATH =
  'M50 5 C62 5 66 0 80 0 C94 0 100 6 100 20 C100 34 95 38 95 50 C95 62 100 66 100 80 C100 94 94 100 80 100 ' +
  'C66 100 62 95 50 95 C38 95 34 100 20 100 C6 100 0 94 0 80 C0 66 5 62 5 50 C5 38 0 34 0 20 C0 6 6 0 20 0 C34 0 38 5 50 5 Z'

function build(text: string) {
  const { size, data } = create(text, { errorCorrectionLevel: 'M' }).modules
  const at = (x: number, y: number) => data[y * size + x] === 1
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
  const unit = 76 / size
  const origin = 12
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
  // Faint dots in every empty cell (and a ring of them just outside the code), kept off the corner markers.
  const specks: { cx: number; cy: number }[] = []
  for (let y = -2; y < size + 2; y++) {
    for (let x = -2; x < size + 2; x++) {
      const inside = x >= 0 && y >= 0 && x < size && y < size
      if (inside && at(x, y)) continue
      const nearFinder = (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8)
      if (nearFinder) continue
      // Skip the very corners of the margin ring so the dots stay inside the tile's outline.
      if (!inside && (x < -1 || y < -1 || x > size || y > size)) continue
      specks.push({ cx: origin + (x + 0.5) * unit, cy: origin + (y + 0.5) * unit })
    }
  }
  return { shapes, corners, specks, unit }
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
      <path d={TILE_PATH} fill={TILE} />
      <g fill={SPECK}>
        {art.specks.map((d, i) => <circle key={i} cx={d.cx} cy={d.cy} r={art.unit * 0.17} />)}
      </g>
      <g fill={INK}>
        {art.shapes.map((s, i) => (s.k === 'c' ? <circle key={i} {...s.p} /> : <rect key={i} {...s.p} />))}
        {art.corners.map((c, i) => (
          <g key={`f${i}`}>
            <circle cx={c.cx} cy={c.cy} r={art.unit * 3} fill="none" stroke={INK} strokeWidth={art.unit} />
            <circle cx={c.cx} cy={c.cy} r={art.unit * 1.3} />
            {Array.from({ length: 8 }, (_, k) => (
              <circle key={k} cx={c.cx + Math.cos((k * Math.PI) / 4) * art.unit * 1.3} cy={c.cy + Math.sin((k * Math.PI) / 4) * art.unit * 1.3} r={art.unit * 0.5} />
            ))}
          </g>
        ))}
      </g>
    </svg>
  )
}
