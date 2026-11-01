// Decides whether this copy of the app must be updated before it can be used. Kept free of other imports so it
// can be tested on its own.

export type UpdateCheck = {
  /** The owner's minimum allowed app build. 0 means nobody is forced. */
  minBuild: number
  /** This app's build number, or null when it has none. */
  build: number | null
  /** True only inside the installed Android app. */
  native: boolean
  /** The owner account is never blocked. */
  owner: boolean
}

/** Only the installed Android app can be forced. The website and the home-screen web app update by themselves. */
export function mustUpdate({ minBuild, build, native, owner }: UpdateCheck): boolean {
  if (!native || owner || minBuild <= 0) return false
  // An app with no build number counts as the oldest.
  return minBuild > (build ?? 0)
}

/** The build number to send to the database with every request, or null when this app has none (the website). */
export function buildHeaderValue(raw: unknown): string | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? String(n) : null
}
