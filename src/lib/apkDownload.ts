import { useCallback, useEffect, useRef, useState } from 'react'
import { callPlugin, installUpdate } from './native'

// The app update, watched from start to finish. The old version only asked Android to download and then said
// "Downloading" whatever happened, so a failed download looked like a stuck one. This follows the real status, shows
// progress, and when Android's download manager fails it opens the browser to download the file instead.
export type ApkPhase = 'idle' | 'starting' | 'downloading' | 'waiting' | 'done' | 'failed'
export type ApkState = { phase: ApkPhase; percent: number | null; message: string; id: number | null }

const IDLE: ApkState = { phase: 'idle', percent: null, message: '', id: null }
const POLL_MS = 1000
const GIVE_UP_MS = 15 * 60_000
// A download that has not moved a single byte for this long is stuck (the usual "frozen at 99%"): the browser takes over.
const STALL_MS = 30_000

// Android's DownloadManager error codes, in words.
export function failureText(reason: number | undefined): string {
  switch (reason) {
    case 1006: return 'There is not enough space on the phone.'
    case 1007: return 'The phone has no storage to save to.'
    case 1009: return 'A file with that name was already there.'
    case 1004: case 1005: case 1002: case 1001: return 'The connection dropped.'
    case 404: return 'The file was not found online yet.'
    default: return 'The phone could not finish the download.'
  }
}

export function useApkDownload() {
  const [state, setState] = useState<ApkState>(IDLE)
  const timer = useRef<number | undefined>(undefined)
  const alive = useRef(true)

  const stop = useCallback(() => { window.clearInterval(timer.current); timer.current = undefined }, [])
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop() } }, [stop])
  const set = useCallback((s: ApkState) => { if (alive.current) setState(s) }, [])

  // The browser can always save the file, so it is the way out when the download manager cannot.
  const openInBrowser = useCallback(async (url: string) => {
    try {
      await callPlugin('CznnectNative', 'openUrl', { url })
    } catch {
      window.location.href = url
    }
  }, [])

  const start = useCallback(async (url: string, name = 'cznnect.apk') => {
    stop()
    set({ phase: 'starting', percent: null, message: 'Starting the download…', id: null })
    let id: number | null = null
    try {
      const r = (await callPlugin('CznnectNative', 'downloadFile', { url, name, install: true })) as { id?: number } | undefined
      id = typeof r?.id === 'number' ? r.id : null
    } catch {
      set({ phase: 'failed', percent: null, message: 'Could not start the download here. Opening your browser instead.', id: null })
      await openInBrowser(url)
      return
    }
    if (id === null) {
      // An older app build starts the download but cannot report on it.
      set({ phase: 'downloading', percent: null, message: 'Downloading. When it finishes, tap Update in the box Android shows.', id: null })
      return
    }
    const myId = id
    const began = Date.now()
    let unknowns = 0
    let lastBytes = -1
    let lastMoved = Date.now()
    set({ phase: 'downloading', percent: 0, message: 'Downloading…', id: myId })
    timer.current = window.setInterval(async () => {
      try {
        const s = (await callPlugin('CznnectNative', 'downloadStatus', { id: myId })) as { status?: string; downloaded?: number; total?: number; reason?: number }
        if (s.status === 'success') {
          stop()
          set({ phase: 'done', percent: 100, message: 'Downloaded. The installer should open. If it does not, tap Install.', id: myId })
        } else if (s.status === 'failed' || (s.status === 'unknown' && ++unknowns > 3)) {
          stop()
          set({ phase: 'failed', percent: null, message: `${failureText(s.reason)} Opening your browser to download it instead.`, id: myId })
          await openInBrowser(url)
        } else if (s.status === 'paused' || s.status === 'pending') {
          set({ phase: 'waiting', percent: null, message: 'Waiting for a connection…', id: myId })
        } else if (s.status === 'running') {
          if ((s.downloaded ?? 0) !== lastBytes) { lastBytes = s.downloaded ?? 0; lastMoved = Date.now() }
          else if (Date.now() - lastMoved > STALL_MS) {
            stop()
            set({ phase: 'failed', percent: null, message: 'The download got stuck. Opening your browser to download it instead.', id: myId })
            await openInBrowser(url)
            return
          }
          const pct = s.total && s.total > 0 ? Math.min(99, Math.round(((s.downloaded ?? 0) / s.total) * 100)) : null
          set({ phase: 'downloading', percent: pct, message: pct === null ? 'Downloading…' : `Downloading… ${pct}%`, id: myId })
        }
        if (Date.now() - began > GIVE_UP_MS) {
          stop()
          set({ phase: 'failed', percent: null, message: 'This is taking too long. Opening your browser to download it instead.', id: myId })
          await openInBrowser(url)
        }
      } catch {
        // This app build cannot report progress: leave the notification to do the talking.
        stop()
        set({ phase: 'downloading', percent: null, message: 'Downloading. When it finishes, tap Update in the box Android shows.', id: myId })
      }
    }, POLL_MS)
  }, [stop, set, openInBrowser])

  // Opens the installer for the file that was just downloaded. If the phone has not yet allowed Cznnect to install
  // apps, the settings page for that opens and the message says to tap Install again.
  const install = useCallback(async () => {
    const r = await installUpdate()
    if (!r.ok) setState((s) => ({ ...s, message: r.message }))
  }, [])

  return { state, start, install }
}
