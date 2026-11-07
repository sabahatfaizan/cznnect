import { useState } from 'react'
import { Icon } from './Icons'
import { LATEST_APK_URL } from '../lib/appSettings'
import { useNewerBuild } from '../lib/appUpdate'
import { downloadFile, installUpdate } from '../lib/native'

// Shown inside the Android app when a newer build is published. One tap downloads it and opens the installer.
export default function UpdatePrompt({ building }: { building: boolean }) {
  const newer = useNewerBuild()
  const [dismissed, setDismissed] = useState(false)
  const [started, setStarted] = useState(false)
  const [hint, setHint] = useState('')

  // While a build is still being published the new file may not be ready, so say nothing until it is.
  if (newer === null || dismissed || building) return null

  async function update() {
    const ok = await downloadFile(LATEST_APK_URL, 'cznnect.apk', true)
    if (ok) setStarted(true)
    else window.location.href = LATEST_APK_URL
  }

  async function install() {
    const r = await installUpdate()
    setHint(r.ok ? '' : r.message)
  }

  return (
    <div role="status" className="card mb-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink"><Icon name="download" size={22} /></span>
        <div className="min-w-0">
          <p className="font-bold">A new version is ready</p>
          <p className="text-sm text-muted">
            {hint || (started ? 'Downloading. When it finishes the installer opens. If it does not, tap Install.' : 'Update takes under a minute. Your data stays as it is.')}
          </p>
        </div>
      </div>
      {!started && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-plain" onClick={() => setDismissed(true)}>Later</button>
          <button type="button" className="btn btn-primary" onClick={() => void update()}>Update now</button>
        </div>
      )}
      {started && (
        <button type="button" className="btn btn-primary" onClick={() => void install()}>Install</button>
      )}
    </div>
  )
}
