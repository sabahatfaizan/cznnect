import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { OFFLINE_MESSAGE, isShowingSaved, offlineAwareFetch, reportNetwork } from './offline'
import { clearSavedData, setSavedDataOwner } from './savedData'

// A small stand-in for the browser's Cache Storage.
function fakeCaches() {
  const all = new Map<string, Map<string, Response>>()
  return {
    all,
    keys: async () => [...all.keys()],
    delete: async (name: string) => all.delete(name),
    open: async (name: string) => {
      if (!all.has(name)) all.set(name, new Map())
      const m = all.get(name)!
      return {
        put: async (req: Request, res: Response) => { m.delete(req.url); m.set(req.url, res) },
        match: async (req: Request) => m.get(req.url)?.clone(),
        keys: async () => [...m.keys()].map((u) => new Request(u)),
        delete: async (req: Request) => m.delete(req.url),
      }
    },
  }
}

const URL_ = 'https://quatnrlyzitmgsvqyzbi.supabase.co'
const tick = () => new Promise((r) => setTimeout(r, 15))
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })

let caches: ReturnType<typeof fakeCaches>
beforeEach(() => {
  caches = fakeCaches()
  vi.stubGlobal('caches', caches)
  vi.stubGlobal('navigator', { onLine: true })
  setSavedDataOwner('u1')
})
afterEach(() => {
  clearSavedData()
  vi.unstubAllGlobals()
  reportNetwork(true)
})

const goOffline = () => vi.stubGlobal('navigator', { onLine: false })

describe('the saved copy of what you last looked at', () => {
  it('shows the last list again when there is no internet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([{ id: 1, name: 'Cox’s Bazar' }])))
    const client = createClient(URL_, 'sb_publishable_test_key_123456', { global: { fetch: offlineAwareFetch } })
    expect((await client.from('places').select('*')).data).toEqual([{ id: 1, name: 'Cox’s Bazar' }])
    await tick()
    goOffline()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const again = await client.from('places').select('*')
    expect(again.error).toBeNull()
    expect(again.data).toEqual([{ id: 1, name: 'Cox’s Bazar' }])
    expect(isShowingSaved()).toBe(true)
    reportNetwork(true)
    expect(isShowingSaved()).toBe(false)
  })

  it('keeps a single-row lookup apart from a list of the same table', async () => {
    const one = { id: 7 }
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: RequestInit) => json(new Headers(init?.headers).get('accept')?.includes('object') ? one : [one, { id: 8 }])))
    const client = createClient(URL_, 'sb_publishable_test_key_123456', { global: { fetch: offlineAwareFetch } })
    await client.from('places').select('*').eq('id', 7).single()
    await client.from('places').select('*').eq('id', 7)
    await tick()
    goOffline()
    expect((await client.from('places').select('*').eq('id', 7).single()).data).toEqual(one)
    expect((await client.from('places').select('*').eq('id', 7)).data).toEqual([one, { id: 8 }])
  })

  it('never saves codes, settings, logins or changes, so they say offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true })))
    for (const [url, init] of [
      [`${URL_}/rest/v1/rpc/irl_my_code`, { method: 'POST', body: '{}' }],
      [`${URL_}/rest/v1/app_settings?select=*`, undefined],
      [`${URL_}/auth/v1/user`, undefined],
      [`${URL_}/rest/v1/places`, { method: 'POST', body: '{}' }],
    ] as [string, RequestInit | undefined][]) {
      await offlineAwareFetch(url, init)
    }
    await tick()
    expect([...caches.all.values()].reduce((n, m) => n + m.size, 0)).toBe(0)
    goOffline()
    const res = await offlineAwareFetch(`${URL_}/rest/v1/rpc/irl_my_code`, { method: 'POST', body: '{}' })
    expect(res.status).toBe(502)
    expect((await res.json()).message).toBe(OFFLINE_MESSAGE)
  })

  it('saves nothing until it knows who is signed in', async () => {
    setSavedDataOwner(null)
    vi.stubGlobal('fetch', vi.fn(async () => json([{ id: 1 }])))
    await offlineAwareFetch(`${URL_}/rest/v1/places?select=*`)
    await tick()
    expect([...caches.all.values()].reduce((n, m) => n + m.size, 0)).toBe(0)
  })

  it('is removed on sign-out and when someone else signs in', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([{ id: 1 }])))
    await offlineAwareFetch(`${URL_}/rest/v1/places?select=*`)
    await tick()
    expect([...caches.all.keys()]).toEqual(['cznnect-data-u1'])
    setSavedDataOwner('u2')
    await tick()
    expect([...caches.all.keys()]).toEqual([])
    await offlineAwareFetch(`${URL_}/rest/v1/places?select=*`)
    await tick()
    clearSavedData()
    await tick()
    expect([...caches.all.keys()]).toEqual([])
    goOffline()
    expect((await offlineAwareFetch(`${URL_}/rest/v1/places?select=*`)).status).toBe(502)
  })
})
