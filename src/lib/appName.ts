import { useEffect, useState } from 'react'
import { PLUS_EVENT, PLUS_NAME, cachedPlus } from './plus'

// The app's name. A person who has Cznnect+ sees "Cznnect+" everywhere: in the logo, the headers, the browser tab and,
// in the Android app, under the icon on the phone's home screen. Taking Cznnect+ away puts the plain name back.
export const APP_NAME = 'Cznnect'
export const appName = (plus: boolean = cachedPlus()): string => (plus ? PLUS_NAME : APP_NAME)

// Does this person have Cznnect+? Reads the last answer kept on the phone and follows changes. Unlike usePlus it does
// not ask the server, so it is cheap to use anywhere (the logo uses it).
export function useCachedPlus(): boolean {
  const [plus, setPlus] = useState(cachedPlus())
  useEffect(() => {
    const on = () => setPlus(cachedPlus())
    window.addEventListener(PLUS_EVENT, on)
    on()
    return () => window.removeEventListener(PLUS_EVENT, on)
  }, [])
  return plus
}
export const useAppName = (): string => appName(useCachedPlus())

// The browser tab and the installed web app's title.
export function applyAppName() {
  if (typeof document === 'undefined') return
  const name = appName()
  document.title = name
  for (const key of ['application-name', 'apple-mobile-web-app-title']) {
    document.querySelector(`meta[name="${key}"]`)?.setAttribute('content', name)
  }
}
if (typeof window !== 'undefined') window.addEventListener(PLUS_EVENT, applyAppName)
