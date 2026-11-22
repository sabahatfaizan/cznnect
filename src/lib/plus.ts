import { supabase } from '../supabase'
import { withTimeout } from './net'
import { isOwnerEmail } from '../owner'

// Cznnect+, the paid tier. For now it unlocks the coloured app icons. Who has it lives in the database
// (supabase/30_cznnect_plus.sql); the owner always has it and gives it to others from Admin > All users.
export const PLUS_NAME = 'Cznnect+'

// Cznnect+ is looked up on every start, and the last answer is kept on this phone so the screen does not flicker while
// it loads. The cache only affects looks; the server decides the things that matter (family and guest limits).
const CACHE = 'cznnect-plus-cache'
export function cachedPlus(): boolean {
  try { return localStorage.getItem(CACHE) === '1' } catch { return false }
}
// Fired whenever the answer changes, so the app name, the logo and the phone's launcher entry follow at once.
export const PLUS_EVENT = 'cznnect-plus-changed'
function remember(on: boolean) {
  let changed = false
  try {
    changed = (localStorage.getItem(CACHE) === '1') !== on
    localStorage.setItem(CACHE, on ? '1' : '0')
  } catch { /* ignore */ }
  if (changed && typeof window !== 'undefined') window.dispatchEvent(new Event(PLUS_EVENT))
}

export async function hasPlus(): Promise<boolean> {
  try {
    const { data: s } = await supabase.auth.getSession()
    if (!s.session) { remember(false); return false } // nobody is signed in, so nobody has Cznnect+
    if (isOwnerEmail(s.session?.user.email)) { remember(true); return true }
    const r = await withTimeout(supabase.rpc('my_plus'))
    if (r.error) return cachedPlus()
    remember(r.data === true)
    return r.data === true
  } catch {
    return cachedPlus()
  }
}

export async function plusMemberIds(): Promise<string[] | null> {
  try {
    const r = await withTimeout(supabase.rpc('admin_plus_members'))
    return r.error ? null : ((r.data ?? []) as string[])
  } catch {
    return null
  }
}

export async function setPlus(userId: string, on: boolean): Promise<string | null> {
  try {
    const r = await withTimeout(supabase.rpc('admin_set_plus', { p_user: userId, p_on: on }))
    return r.error ? (r.error.code === 'PGRST202' ? 'Run supabase/30_cznnect_plus.sql in Supabase first.' : r.error.message) : null
  } catch {
    return 'Could not reach the server. Check your connection and try again.'
  }
}

// The next person to sign in on this phone must not see the last person's name, and opening the app again picks up a
// grant or a removal made while it was closed.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') remember(false) })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void hasPlus() })
}
