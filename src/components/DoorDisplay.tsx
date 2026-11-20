import { useEffect } from 'react'
import QrCode from './QrCode'
import { useBackClose } from '../lib/backStack'
import { inviteUrl } from '../lib/events'

// A phone or tablet left at the doorway: the invite QR as big as the screen allows, the typed code under it, and nothing
// else. It goes full screen where the browser allows it and keeps the screen awake. A small close mark in the corner
// (and the Back button) leaves it, so guests are not tempted to tap around.
export default function DoorDisplay({ code, onClose }: { code: string; onClose: () => void }) {
  useBackClose(onClose)

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    let alive = true
    const keepAwake = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        if (wl && alive && document.visibilityState === 'visible') lock = await wl.request('screen')
      } catch { /* the screen may dim on this device */ }
    }
    void keepAwake()
    // The browser gives the wake lock back when the tab is hidden; take it again when the tab returns.
    const again = () => { if (document.visibilityState === 'visible') void keepAwake() }
    document.addEventListener('visibilitychange', again)
    try { void document.documentElement.requestFullscreen?.().catch(() => undefined) } catch { /* not allowed here */ }
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', again)
      void lock?.release().catch(() => undefined)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-label="Door display"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-[3vmin] p-[4vmin]"
      style={{ background: '#ffffff', color: '#000000' }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the door display"
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full text-2xl"
        style={{ color: '#9a9a9a' }}
      >
        ×
      </button>
      <div style={{ width: 'min(92vw, 70vh)' }}>
        <QrCode plain text={inviteUrl(code)} size={1000} label="Scan to join the event" />
      </div>
      <p className="font-bold tracking-[0.3em]" style={{ fontSize: 'min(9vw, 6vh)' }}>{code}</p>
    </div>
  )
}
