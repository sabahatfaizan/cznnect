// A saved copy of what the person last looked at, so the app can still show it with no internet.
// - Only read-only list/lookups from the database (GET requests) are saved. Logins, codes (QR), settings,
//   anything that changes data and everything outside the database is never saved.
// - It belongs to the signed-in person, stays on this phone, and is deleted on sign-out.
// - Nothing is saved until the app knows who is signed in.
const PREFIX = 'cznnect-data-'
const MAX_ENTRIES = 250
const KEY_HOST = 'https://saved.cznnect.invalid/'

let owner: string | null = null

function store(): CacheStorage | null {
  return typeof caches === 'undefined' ? null : caches
}

async function purge(keep: string | null) {
  try {
    const c = store()
    if (!c) return
    for (const name of await c.keys()) if (name.startsWith(PREFIX) && name !== PREFIX + keep) await c.delete(name)
  } catch {
    /* nothing saved, nothing to clear */
  }
}

/** Tells the saved copy whose it is. Switching person (or signing out) removes everyone else's. */
export function setSavedDataOwner(id: string | null) {
  if (owner === id) return
  owner = id
  void purge(id)
}

export function clearSavedData() {
  owner = null
  void purge(null)
}

type Req = { url: string; accept: string }

function describe(input: RequestInfo | URL, init?: RequestInit): Req | null {
  const req = typeof Request !== 'undefined' && input instanceof Request ? input : null
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : (req?.url ?? '')
  const method = (init?.method ?? req?.method ?? 'GET').toUpperCase()
  if (method !== 'GET') return null
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  // Only database tables and views. Not rpc (codes, scores, actions), not settings, not login or file storage.
  if (!u.pathname.startsWith('/rest/v1/') || u.pathname.startsWith('/rest/v1/rpc/') || u.pathname === '/rest/v1/app_settings') return null
  const accept = new Headers(init?.headers ?? req?.headers).get('accept') ?? ''
  return { url: u.href, accept }
}

function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36) + text.length.toString(36)
}

const keyFor = (r: Req) => new Request(KEY_HOST + hash(`${r.url}|${r.accept}`))

export async function saveResponse(input: RequestInfo | URL, init: RequestInit | undefined, res: Response): Promise<void> {
  try {
    const c = store()
    const r = describe(input, init)
    if (!c || !owner || !r || !res.ok) return
    const body = await res.clone().text()
    const headers = new Headers({ 'content-type': res.headers.get('content-type') ?? 'application/json', 'x-saved-at': String(Date.now()) })
    const range = res.headers.get('content-range')
    if (range) headers.set('content-range', range)
    const cache = await c.open(PREFIX + owner)
    await cache.put(keyFor(r), new Response(body, { status: 200, headers }))
    const keys = await cache.keys()
    for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await cache.delete(keys[i])
  } catch {
    /* the copy is a bonus: never let it break a real request */
  }
}

export async function savedResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
  try {
    const c = store()
    const r = describe(input, init)
    if (!c || !owner || !r) return null
    const cache = await c.open(PREFIX + owner)
    return (await cache.match(keyFor(r))) ?? null
  } catch {
    return null
  }
}
