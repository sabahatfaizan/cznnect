import type { useApkDownload } from '../lib/apkDownload'

// Progress and result of the app update download, with an Install button for when the installer did not open by itself.
export default function ApkStatus({ apk }: { apk: ReturnType<typeof useApkDownload> }) {
  const { state, install } = apk
  if (state.phase === 'idle') return null
  return (
    <div role="status" className="flex flex-col gap-2">
      <p className="text-sm text-muted">{state.message}</p>
      {state.phase === 'downloading' && state.percent !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${state.percent}%` }} />
        </div>
      )}
      {state.phase === 'done' && <button type="button" className="btn btn-primary" onClick={() => void install()}>Install</button>}
    </div>
  )
}
