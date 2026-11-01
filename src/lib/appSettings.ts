import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

// Always the newest APK: the build workflow republishes it under this fixed name on every push to main.
export const LATEST_APK_URL = 'https://github.com/sabahatfaizan/cznnect/releases/download/latest-apk/cznnect.apk'
export const LATEST_RELEASE_API = 'https://api.github.com/repos/sabahatfaizan/cznnect/releases/tags/latest-apk'
export const DEFAULT_MAINTENANCE_MESSAGE = 'We’re improving Cznnect. Please check back soon.'

export type AppSettings = {
  maintenanceEnabled: boolean
  maintenanceMessage: string
  /** Website visitors are sent to the download page instead of sign-in. */
  apkDownloadEnabled: boolean
  /** The Android download card is shown. */
  androidDownloadEnabled: boolean
  /** The iPhone install card is shown. */
  iosInstallEnabled: boolean
  /** Website visitors may carry on in the browser from the download page. */
  webContinueEnabled: boolean
  announcementEnabled: boolean
  announcementText: string
  /** Android app builds older than this are asked to update. 0 means nobody is forced. */
  minBuild: number
}

// Columns added by the SQL files may not exist yet, so every field has a safe default.
export function parseSettings(row: Record<string, unknown> | null | undefined): AppSettings {
  const r = row ?? {}
  const min = Number(r.min_build)
  return {
    maintenanceEnabled: Boolean(r.maintenance_enabled),
    maintenanceMessage: (typeof r.maintenance_message === 'string' && r.maintenance_message) || DEFAULT_MAINTENANCE_MESSAGE,
    apkDownloadEnabled: r.apk_download_enabled !== false,
    androidDownloadEnabled: r.android_download_enabled !== false,
    iosInstallEnabled: r.ios_install_enabled !== false,
    webContinueEnabled: r.web_continue_enabled !== false,
    announcementEnabled: Boolean(r.announcement_enabled),
    announcementText: typeof r.announcement_text === 'string' ? r.announcement_text : '',
    minBuild: Number.isFinite(min) && min > 0 ? Math.floor(min) : 0,
  }
}

/** This app's build number, or null for a local or website build that has none. */
export function thisBuild(): number | null {
  const n = Number(import.meta.env.VITE_BUILD_NUMBER)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** True only inside the installed Android app. The website and home-screen web app update themselves. */
export function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return Boolean(cap?.isNativePlatform?.())
}

/** True for the website added to a phone's home screen. It runs as an app and updates itself. */
export function isInstalledWebApp(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

export function useAppSettings(pollMs = 30000) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
    if (error) setError(error.message)
    else { setError(''); setSettings(parseSettings(data)) }
  }, [])

  useEffect(() => {
    void reload()
    const t = setInterval(() => void reload(), pollMs)
    return () => clearInterval(t)
  }, [reload, pollMs])

  return { settings, error, reload, setSettings }
}
