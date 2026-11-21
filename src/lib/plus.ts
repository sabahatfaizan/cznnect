import { supabase } from '../supabase'
import { withTimeout } from './net'

// Cznnect+, the paid tier. For now it unlocks the coloured app icons. Who has it lives in the database
// (supabase/30_cznnect_plus.sql); the owner always has it and gives it to others from Admin > All users.
export const PLUS_NAME = 'Cznnect+'

export async function hasPlus(): Promise<boolean> {
  try {
    const r = await withTimeout(supabase.rpc('my_plus'))
    return !r.error && r.data === true
  } catch {
    return false
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
