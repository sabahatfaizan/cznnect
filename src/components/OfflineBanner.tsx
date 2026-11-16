import { useOffline, useShowingSaved } from '../lib/offline'

// A small, quiet note at the top of the app while the phone has no internet. It reconnects by itself.
export default function OfflineBanner() {
  const offline = useOffline()
  const saved = useShowingSaved()
  if (!offline) return null
  return (
    <p role="status" className="mb-3 flex items-center justify-center gap-1.5 text-xs text-muted">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {saved ? 'Offline · showing your last saved copy' : 'Offline'}
    </p>
  )
}
