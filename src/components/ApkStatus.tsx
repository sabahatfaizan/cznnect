import type { useApkDownload } from '../lib/apkDownload'

// Progress and result of the app download. The bar fills as bytes arrive; when the phone cannot say how big the file
// is yet, it slides back and forth instead, so it never looks frozen.
export default function ApkStatus({ apk }: { apk: ReturnType<typeof useApkDownload> }) {
  const { state, install } = apk
  if (state.phase === 'idle') return null
  const busy = state.phase === 'starting' || state.phase === 'downloading' || state.phase === 'waiting'
  const pct = state.percent
  return (
    <div role="status" className="flex flex-col gap-2">
      {busy && (
        <div
          className="h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Download progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
        >
          {pct === null || pct <= 0 ? (
            <div className="progress-indeterminate h-full w-1/3 rounded-full bg-accent" />
          ) : (
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          )}
        </div>
      )}
      <p className="text-center text-xs text-muted">{state.message}</p>
      {state.phase === 'done' && <button type="button" className="btn btn-primary !min-h-12 w-full" onClick={() => void install()}>Install</button>}
    </div>
  )
}
