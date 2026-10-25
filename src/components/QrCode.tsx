import { useEffect, useRef, useState } from 'react'
import { toCanvas } from 'qrcode'

// Draws a QR code. Always dark on white, in every theme, because phone cameras read that best.
export default function QrCode({ text, size = 232, label }: { text: string; size?: number; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    setFailed(false)
    toCanvas(el, text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      color: { dark: '#0b1220', light: '#ffffff' },
    }).catch(() => setFailed(true))
  }, [text, size])

  return (
    <div className="qr-frame" role="img" aria-label={label}>
      {failed ? (
        <p className="p-6 text-center text-sm font-bold text-danger">Could not draw the code. Use the typed code below.</p>
      ) : (
        <canvas ref={canvas} width={size} height={size} style={{ width: size, height: size, maxWidth: '100%' }} />
      )}
    </div>
  )
}
