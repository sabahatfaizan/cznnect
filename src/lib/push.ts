import { supabase } from '../supabase'
import { getPushToken, isNative } from './native'

// Gives the database this phone's push token so the server can notify the signed-in person. Does nothing in a
// browser or in a build without push set up, and never throws: push is optional and must not break sign-in.
export async function registerPush(): Promise<void> {
  if (!isNative()) return
  try {
    const token = await getPushToken()
    if (!token) return
    await supabase.rpc('register_push_token', { p_token: token, p_platform: 'android' })
  } catch {
    // Offline or not set up: the next app start tries again.
  }
}

// Removes this phone's token for the signed-in person (call before signing out).
export async function unregisterPush(): Promise<void> {
  if (!isNative()) return
  try {
    const token = await getPushToken()
    if (token) await supabase.rpc('unregister_push_token', { p_token: token })
  } catch {
    // Ignore: signing out must always work.
  }
}
