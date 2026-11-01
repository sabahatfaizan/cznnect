import { afterEach, describe, expect, it, vi } from 'vitest'
import { callPlugin } from './native'
import { sendTestReminder } from './birthdayReminders'

// The Android app's bridge script only provides nativePromise: no Capacitor.Plugins entries and no registerPlugin.
function stubApp(answer: (plugin: string, method: string) => unknown) {
  const nativePromise = vi.fn(async (plugin: string, method: string, _options?: unknown) => answer(plugin, method))
  vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true, nativePromise } })
  return nativePromise
}

afterEach(() => vi.unstubAllGlobals())

describe('calling the app plugins', () => {
  it('uses nativePromise when there are no ready-made plugin objects', async () => {
    const nativePromise = stubApp(() => ({ display: 'granted' }))
    await expect(callPlugin('LocalNotifications', 'checkPermissions')).resolves.toEqual({ display: 'granted' })
    expect(nativePromise).toHaveBeenCalledWith('LocalNotifications', 'checkPermissions', {})
  })

  it('prefers a ready-made plugin object when one exists', async () => {
    const checkPermissions = vi.fn(async () => ({ display: 'prompt' }))
    vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: { checkPermissions } }, nativePromise: vi.fn() } })
    await expect(callPlugin('LocalNotifications', 'checkPermissions')).resolves.toEqual({ display: 'prompt' })
    expect(checkPermissions).toHaveBeenCalled()
  })
})

describe('the test reminder in the Android app', () => {
  it('asks for permission, then schedules a notification through the bridge', async () => {
    const nativePromise = stubApp((_plugin, method) => (method === 'schedule' ? {} : { display: 'granted' }))
    await expect(sendTestReminder()).resolves.toBe('sent')
    const schedule = nativePromise.mock.calls.find((c) => c[1] === 'schedule')
    expect(schedule?.[0]).toBe('LocalNotifications')
    expect((schedule?.[2] as { notifications: unknown[] }).notifications).toHaveLength(1)
  })

  it('says blocked when the phone refuses notifications', async () => {
    stubApp(() => ({ display: 'denied' }))
    await expect(sendTestReminder()).resolves.toBe('blocked')
  })
})
