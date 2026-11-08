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

/**
 * Calls a method of a plugin that is built into the Android app, by plugin name. The app's own bridge script only
 * provides nativePromise (the web code does not bundle @capacitor/core, so there are no ready-made plugin objects
 * and no registerPlugin), so this is the call that always works. Ready-made objects are used when they exist.
 */
export function callPlugin(name: string, method: string, options: Record<string, unknown> = {}): Promise<unknown> {
  const c = cap()
  if (!c) return Promise.reject(new Error('Not running in the app'))
  const plugin = (c.Plugins?.[name] ?? (typeof c.registerPlugin === 'function' ? c.registerPlugin(name) : undefined)) as Record<string, PluginFn> | undefined
  const fn = plugin?.[method]
  if (typeof fn === 'function') return fn.call(plugin, options)
  if (typeof c.nativePromise === 'function') return c.nativePromise(name, method, options)
  return Promise.reject(new Error('Native bridge missing'))
}

const callNative = (method: string, options: Record<string, unknown>) => callPlugin(NAME, method, options)

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

// Shares a PNG picture (base64, no prefix) with text. Inside the Android app this uses the phone's own share sheet;
// on the web it uses the browser's. Returns false when neither can send a picture, so the caller can fall back.
export async function shareImage(base64: string, text: string): Promise<boolean> {
  try {
    if (isNative()) {
      await callNative('shareImage', { base64, text })
      return true
    }
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const file = new File([bytes], 'cznnect-banner.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text })
      return true
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return true // closed the share sheet
  }
  return false
}

// Switches the launcher icon on the phone's home screen to match the chosen app icon.
export function setLauncherIcon(id: string) {
  if (!isNative()) return
  callNative('setIcon', { id }).catch(() => {})
}

// Starts a file download with Android's download manager. Returns false when that is not possible (not the app, or an
// older app without this), so the caller can fall back to a normal link.
export async function downloadFile(url: string, name: string, install = false): Promise<boolean> {
  if (!isNative()) return false
  try {
    await callNative('downloadFile', { url, name, install })
    return true
  } catch {
    return false
  }
}

// Opens Android's installer for the update that was downloaded last. Returns a message when it cannot.
export async function installUpdate(): Promise<{ ok: boolean; message: string }> {
  if (!isNative()) return { ok: false, message: 'Open the installed app to update.' }
  try {
    await callNative('installUpdate', {})
    return { ok: true, message: '' }
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : 'Could not open the installer. Open the file from your Downloads.'
    return { ok: false, message }
  }
}

// The phone's Firebase push token, or null when this is not the app, the build has no push set up, or the phone
// refuses. Safe to call on every start: Firebase hands back the same token until it rotates it.
export async function getPushToken(): Promise<string | null> {
  if (!isNative()) return null
  try {
    const res = (await callNative('getPushToken', {})) as { token?: string } | undefined
    return res?.token || null
  } catch {
    return null
  }
}
