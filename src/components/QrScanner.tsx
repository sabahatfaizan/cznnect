import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

// Opens the back camera and looks for a QR code about 8 times a second.
// Nothing is recorded or uploaded: frames are read in the browser and thrown away.
// With `fill`, the camera covers its whole container (used for the full-screen scanner) instead of a rounded square.
export default function QrScanner({ onText, fill = false }: { onText: (text: string) => void; fill?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const grab = useRef<HTMLCanvasElement>(null)
  const callback = useRef(onText)
  callback.current = onText
  const [problem, setProblem] = useState('')
  // True once real frames are on screen. Until then the camera stays hidden, so there is no grey box that suddenly
  // turns into a blurry picture: the picture fades in instead.
  const [shown, setShown] = useState(false)
  const track = useRef<MediaStreamTrack | null>(null)

  // Tap the picture to focus again (where the phone's camera allows it), then go back to continuous focus.
  async function refocus() {
    const t = track.current
    if (!t) return
    try {
      const caps = (t.getCapabilities?.() ?? {}) as { focusMode?: string[] }
      if (!caps.focusMode?.includes('single-shot')) return
      await t.applyConstraints({ advanced: [{ focusMode: 'single-shot' } as MediaTrackConstraintSet] })
      window.setTimeout(() => {
        if (caps.focusMode?.includes('continuous')) t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {})
      }, 1500)
    } catch {
      // Not every camera can do this. Continuous focus keeps working.
    }
  }

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem('This browser cannot open the camera. Type the code below instead.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: false,
        })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        // Ask for continuous autofocus right away: without it many phones start out of focus and hunt for a few seconds.
        const t = stream.getVideoTracks()[0]
        track.current = t ?? null
        try {
          const caps = (t?.getCapabilities?.() ?? {}) as { focusMode?: string[] }
          if (caps.focusMode?.includes('continuous')) await t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
        } catch {
          // The phone does not allow it. The default focus is used.
        }
        const v = video.current
        if (!v) return
        v.srcObject = stream
        v.setAttribute('playsinline', 'true')
        await v.play()
        // Show the picture only once a real frame has arrived (and focus has had a moment to settle).
        const reveal = () => window.setTimeout(() => { if (!stopped) setShown(true) }, 350)
        const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void }).requestVideoFrameCallback
        if (rvfc) rvfc.call(v, reveal)
        else reveal()
        tick()
      } catch (e) {
        const name = e instanceof DOMException ? e.name : ''
        setProblem(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera access was blocked. Allow the camera for Cznnect (in your phone\'s app settings, or the browser\'s site settings), or type the code below.'
            : name === 'NotFoundError'
              ? 'No camera was found. Type the code below instead.'
              : 'Could not start the camera. Type the code below instead.',
        )
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
    <div className={`scan-view ${fill ? 'scan-view-fill' : ''}`} onClick={() => void refocus()}>
      <video
        ref={video}
        muted
        playsInline
        className="h-full w-full object-cover transition-opacity duration-300"
        style={{ opacity: shown ? 1 : 0 }}
        aria-label="Camera view"
      />
      <canvas ref={grab} className="hidden" />
      {!problem && shown && <div className={`scan-reticle ${fill ? 'scan-reticle-fill' : ''}`} aria-hidden="true" />}
      {problem && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-bold text-white" role="alert">
          {problem}
        </p>
      )}
      {!problem && !shown && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white" role="status">
          <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/25 border-t-white" aria-hidden="true" />
          <span className="text-sm font-bold">Starting the camera...</span>
        </div>
      )}
    </div>
  )
}
