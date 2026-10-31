// Bridge to the Android app (Capacitor). In a normal browser every function here falls back to the web way
// or does nothing. The native side lives in android-native/ and is added to the APK by the build.
export const WEB_APP_URL = 'https://sabahatfaizan.github.io/cznnect/'

const NAME = 'CznnectNative'
type PluginFn = (options: unknown) => Promise<unknown>
type Cap = {
  isNativePlatform?: () => boolean
  Plugins?: Record<string, unknown>
  registerPlugin?: (name: string) => unknown
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>
}
const cap = (): Cap | undefined => (window as unknown as { Capacitor?: Cap }).Capacitor

export function isNative(): boolean {
  try {
    return Boolean(cap()?.isNativePlatform?.())
  } catch {
    return false
  }
}

function callNative(method: string, options: Record<string, unknown>): Promise<unknown> {
  const c = cap()
  if (!c) return Promise.reject(new Error('Not running in the app'))
  const plugin = (c.Plugins?.[NAME] ?? c.registerPlugin?.(NAME)) as Record<string, PluginFn> | undefined
  const fn = plugin?.[method]
  if (typeof fn === 'function') return fn.call(plugin, options)
  if (c.nativePromise) return c.nativePromise(NAME, method, options)
  return Promise.reject(new Error('Native bridge missing'))
}

// The address people should open. Inside the app the page address is only "https://localhost".
export function appUrl(): string {
  return isNative() ? WEB_APP_URL : location.href.split('?')[0]
}

export const canShare = () => isNative() || 'share' in navigator

export async function shareText(text: string, title?: string): Promise<void> {
  if (isNative()) {
    await callNative('share', { text, title: title ?? '' })
    return
  }
  await navigator.share({ text, title })
}

// Switches the launcher icon on the phone's home screen to match the chosen app icon.
export function setLauncherIcon(id: string) {
  if (!isNative()) return
  callNative('setIcon', { id }).catch(() => {})
}
