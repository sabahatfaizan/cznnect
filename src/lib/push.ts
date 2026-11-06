import { supabase } from '../supabase'
import { getPushToken } from './native'

const KEY = 'cznnect.pushToken'
const OFF_KEY = 'cznnect.pushOff'

// Whether this phone should get family notifications. On unless the person switched it off in Settings.
export function pushEnabled(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== '1'
  } catch {
    return true
  }
}

export async function setPushEnabled(on: boolean): Promise<void> {
  try {
    if (on) localStorage.removeItem(OFF_KEY)
    else localStorage.setItem(OFF_KEY, '1')
  } catch {
    // Private mode: the choice just will not stick.
  }
  if (on) await registerPush()
  else await unregisterPush()
}

// Gives the server this phone's push token so it can send notifications. Does nothing outside the Android app or in
// a build without Firebase set up. Safe to call on every start.
export async function registerPush(): Promise<void> {
  if (!pushEnabled()) return
  try {
    const token = await getPushToken()
    if (!token) return
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: 'android' })
    if (!error) localStorage.setItem(KEY, token)
  } catch {
    // Push is a nice-to-have: never bother the person with a failure here.
  }
}

// Takes this phone off the signed-in account, so the next person who signs in on it does not get the old account's
// notifications. Needs the session, so call it before signing out.
export async function unregisterPush(): Promise<void> {
  try {
    const token = localStorage.getItem(KEY)
    if (!token) return
    await supabase.rpc('unregister_push_token', { p_token: token })
    localStorage.removeItem(KEY)
  } catch {
    // Ignore: signing out must always work.
  }
}

export async function signOut(): Promise<void> {
  await unregisterPush()
  await supabase.auth.signOut()
}
