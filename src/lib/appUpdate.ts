import { useEffect, useState } from 'react'
import { LATEST_RELEASE_API, isNativeApp, thisBuild } from './appSettings'
import { isNewerBuild, parseBuildFromNotes } from './updateGate'

// How often the installed app asks GitHub which build is the newest. It checks when it opens and each time it
// comes back to the front, at most this often.
const CHECK_EVERY_MS = 10 * 60 * 1000

/** The newest published build when it is newer than the installed app, otherwise null. Only the Android app asks. */
export function useNewerBuild(): number | null {
  const [latest, setLatest] = useState<number | null>(null)

  useEffect(() => {
    if (!isNativeApp()) return
    let alive = true
    let lastCheck = 0
    const check = async () => {
      if (Date.now() - lastCheck < CHECK_EVERY_MS) return
      lastCheck = Date.now()
      try {
        const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
        if (!res.ok) return
        const json = (await res.json()) as { body?: string }
        const n = parseBuildFromNotes(json.body)
        if (alive && n) setLatest(n)
      } catch {
        // Offline or rate limited: try again next time the app opens.
      }
    }
    void check()
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  return isNewerBuild(latest, thisBuild()) ? latest : null
}
