import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

// Opens the back camera and looks for a QR code about 8 times a second.
// Nothing is recorded or uploaded: frames are read in the browser and thrown away.
export default function QrScanner({ onText }: { onText: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const grab = useRef<HTMLCanvasElement>(null)
  const callback = useRef(onText)
  callback.current = onText
  const [problem, setProblem] = useState('')
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem('This browser cannot open the camera. Type the code below instead.')
        setStarting(false)
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const v = video.current
        if (!v) return
        v.srcObject = stream
        v.setAttribute('playsinline', 'true')
        await v.play()
        setStarting(false)
        tick()
      } catch (e) {
        const name = e instanceof DOMException ? e.name : ''
        setProblem(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera access was blocked. Allow the camera for this site in your browser settings, or type the code below.'
            : name === 'NotFoundError'
              ? 'No camera was found. Type the code below instead.'
              : 'Could not start the camera. Type the code below instead.',
        )
        setStarting(false)
      }
    }

    function tick() {
      if (stopped) return
      const v = video.current
      const c = grab.current
      if (v && c && v.readyState >= 2 && v.videoWidth > 0) {
        const scale = Math.min(1, 480 / v.videoWidth)
        const w = Math.round(v.videoWidth * scale)
        const h = Math.round(v.videoHeight * scale)
        c.width = w
        c.height = h
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h)
          const img = ctx.getImageData(0, 0, w, h)
          const hit = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
          if (hit && hit.data) callback.current(hit.data)
        }
      }
      timer = window.setTimeout(tick, 125)
    }

    start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="scan-view">
      <video ref={video} muted playsInline className="h-full w-full object-cover" aria-label="Camera view" />
      <canvas ref={grab} className="hidden" />
      {!problem && <div className="scan-reticle" aria-hidden="true" />}
      {(starting || problem) && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-bold text-white" role={problem ? 'alert' : 'status'}>
          {problem || 'Starting the camera...'}
        </p>
      )}
    </div>
  )
}
