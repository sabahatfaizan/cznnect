// Decides whether this copy of the app must be updated before it can be used. Kept free of other imports so it
// can be tested on its own.

export type UpdateCheck = {
  /** The owner's minimum allowed app build. 0 means nobody is forced. */
  minBuild: number
  /** This app's build number, or null when it has none. */
  build: number | null
  /** True only inside the installed Android app. */
  native: boolean
}

/** Only the installed Android app can be forced, and everyone on it is, the owner included. The website and the
 * home-screen web app update by themselves. */
export function mustUpdate({ minBuild, build, native }: UpdateCheck): boolean {
  if (!native || minBuild <= 0) return false
  // An app with no build number counts as the oldest.
  return minBuild > (build ?? 0)
}

/** The build number to send to the database with every request, or null when this app has none (the website). */
export function buildHeaderValue(raw: unknown): string | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? String(n) : null
}

export type DeviceKind = 'ios' | 'android' | 'other'

/** Which kind of phone this is, from the browser's user-agent text. Used to show the download that can work. */
export function deviceKind(userAgent: string): DeviceKind {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'other'
}

/** How long a "build in progress" flag is believed. A build that was killed before it could clear the flag stops
 * showing the notice after this. */
export const BUILD_FLAG_MAX_AGE_MS = 25 * 60 * 1000

/** True while a new app build is being published: the flag is on and was set recently. */
export function isBuildActive(flag: unknown, startedAt: unknown, now: number = Date.now()): boolean {
  if (flag !== true || typeof startedAt !== 'string') return false
  const started = Date.parse(startedAt)
  if (!Number.isFinite(started)) return false
  return now - started >= -60_000 && now - started < BUILD_FLAG_MAX_AGE_MS
}
