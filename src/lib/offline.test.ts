import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { OFFLINE_MESSAGE, friendlyError, isNetworkError, isOffline, offlineAwareFetch, reportNetwork } from './offline'
import { clearFamilies, readFamily, readStoredUser, saveFamily, supabaseSessionKey } from './offlineSession'

function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial }
  const store = {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v },
    removeItem: (k: string) => { delete data[k] },
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() { return Object.keys(data).length },
  }
  return Object.assign(store, { data }) as typeof store & { data: Record<string, string> } & Storage
}

afterEach(() => {
  vi.unstubAllGlobals()
  reportNetwork(true)
})

describe('network errors', () => {
  it('recognises what browsers throw when there is no connection', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true)
    expect(isNetworkError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true)
    expect(isNetworkError(new Error('duplicate key value'))).toBe(false)
    const abort = new Error('aborted'); abort.name = 'AbortError'
    expect(isNetworkError(abort)).toBe(false)
  })

  it('never shows the raw TypeError text', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe(OFFLINE_MESSAGE)
    expect(friendlyError(new Error('Row not found'))).toBe('Row not found')
    expect(friendlyError(undefined)).toBe('Something went wrong. Please try again.')
  })
})

describe('the Supabase fetch', () => {
  it('answers instantly without a request while the phone says it is offline', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('navigator', { onLine: false })
    const res = await offlineAwareFetch('https://example.supabase.co/rest/v1/places')
    expect(res.status).toBe(502)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(isOffline()).toBe(true)
  })

  it('turns a failed request into a readable error and marks the app offline, then recovers', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const res = await offlineAwareFetch('https://example.supabase.co/rest/v1/places')
    expect((await res.json()).message).toBe(OFFLINE_MESSAGE)
    expect(isOffline()).toBe(true)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })))
    await offlineAwareFetch('https://example.supabase.co/rest/v1/places')
    expect(isOffline()).toBe(false)
  })

  it('shows "You\'re offline" instead of "TypeError: Failed to fetch" in real Supabase calls', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const client = createClient('https://example.supabase.co', 'sb_publishable_test_key_123456', { global: { fetch: offlineAwareFetch } })
    const table = await client.from('places').select('*')
    expect(table.error?.message).toBe(OFFLINE_MESSAGE)
    expect(table.error?.code).toBe('offline')
    const rpc = await client.rpc('irl_my_code')
    expect(rpc.error?.message).toBe(OFFLINE_MESSAGE)
    expect(JSON.stringify(rpc.error)).not.toMatch(/TypeError|Failed to fetch/)
  })

  it('does not hide other errors, such as an aborted request', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const abort = new Error('aborted'); abort.name = 'AbortError'
    vi.stubGlobal('fetch', vi.fn(async () => { throw abort }))
    await expect(offlineAwareFetch('https://example.supabase.co/x')).rejects.toBe(abort)
  })
})

describe('opening the app with no internet', () => {
  const URL_ = 'https://quatnrlyzitmgsvqyzbi.supabase.co'

  it('reads who is signed in from the saved login without the network', () => {
    const key = supabaseSessionKey(URL_)
    expect(key).toBe('sb-quatnrlyzitmgsvqyzbi-auth-token')
    const store = fakeStore({ [key]: JSON.stringify({ access_token: 'x', user: { id: 'u1', email: 'a@b.co' } }) })
    expect(readStoredUser(store, URL_)).toEqual({ id: 'u1', email: 'a@b.co' })
    expect(readStoredUser(fakeStore(), URL_)).toBeNull()
    expect(readStoredUser(fakeStore({ [key]: 'not json' }), URL_)).toBeNull()
  })

  it('remembers the family for next time and forgets it on sign-out', () => {
    const store = fakeStore()
    saveFamily(store, 'u1', { id: 'f1', name: 'The Rahmans', invite_code: 'ABCD' })
    expect(readFamily(store, 'u1')).toEqual({ id: 'f1', name: 'The Rahmans', invite_code: 'ABCD' })
    expect(readFamily(store, 'someone-else')).toBeNull()
    clearFamilies(store)
    expect(readFamily(store, 'u1')).toBeNull()
  })
})

describe('the saved login while offline', () => {
  it('is kept (not signed out) when the login cannot be refreshed because there is no internet', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const url = 'https://quatnrlyzitmgsvqyzbi.supabase.co'
    const key = supabaseSessionKey(url)
    const expired = { access_token: 'old', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 1000, user: { id: 'u1', email: 'a@b.co' } }
    const store = fakeStore({ [key]: JSON.stringify(expired) })
    const client = createClient(url, 'sb_publishable_test_key_123456', {
      global: { fetch: offlineAwareFetch },
      auth: { storage: store, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const events: string[] = []
    client.auth.onAuthStateChange((event) => { events.push(event) })
    // Refreshing keeps retrying for a while, so only wait a moment: the point is that nothing signs the person out.
    await Promise.race([client.auth.getSession(), new Promise((r) => setTimeout(r, 400))])
    expect(store.getItem(key)).not.toBeNull() // still there, so the app can open from it and refresh later
    expect(events).not.toContain('SIGNED_OUT')
    expect(readStoredUser(store, url)).toEqual({ id: 'u1', email: 'a@b.co' })
  })
})
