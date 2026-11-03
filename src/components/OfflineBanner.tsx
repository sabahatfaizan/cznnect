import { useOffline, useShowingSaved } from '../lib/offline'

// Shown at the top of the app while the phone has no internet.
export default function OfflineBanner() {
  const offline = useOffline()
  const saved = useShowingSaved()
  if (!offline) return null
  return (
    <p role="status" className="card mb-4 text-sm font-semibold">
      {saved
        ? "You're offline. You're seeing the last saved copy, and changes won't work until you're back online. We'll reconnect by ourselves."
        : "You're offline. Most features won't work until you're back online. We'll reconnect by ourselves."}
    </p>
  )
}
