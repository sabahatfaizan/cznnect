// Every call for Convoy goes through here. The database decides everything that matters
// (who is who, whether a code is valid, cooldowns, limits, points); the app only asks and shows the answer.
import { supabase } from '../supabase'
import { withTimeout } from './net'
import type { LedgerLine, Meetup, Recent, Row } from './irl'

export type Out<T> = { ok: true; data: T } | { ok: false; message: string }

const OFFLINE = 'Could not reach the server. Check your connection and try again.'
const NOT_SET_UP = 'Convoy is not set up yet. In Supabase, run supabase/07_irl.sql.'

type DbError = { message: string; code?: string }

function friendly(e: DbError): string {
  if (e.code === 'PGRST202' || e.code === '42883' || e.code === 'PGRST205' || e.code === '42P01') return NOT_SET_UP
  if (e.code === '42501') return 'You do not have permission to do that.'
  return e.message
}

// Most functions answer with a small JSON object. {error, message} means the rule said no.
async function call<T>(fn: string, args: Record<string, unknown>): Promise<Out<T>> {
  try {
    const r = await withTimeout(supabase.rpc(fn, args))
    if (r.error) return { ok: false, message: friendly(r.error) }
    const data = r.data as (T & { error?: string; message?: string }) | null
    if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data && data.error) {
      return { ok: false, message: data.message ?? 'That did not work.' }
    }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, message: OFFLINE }
  }
}

export type MyCode = { handle: string; code: string; seconds_left: number }
export type Looked = { user_id: string; name: string; cooldown_seconds: number; daily_left: number }
export type GroupPreview = { meetup_id: string; title: string | null; host: string; people: number; already_in: boolean }

export const myCode = (fid: string) => call<MyCode>('irl_my_code', { fid })
export const lookup = (fid: string, payload: string) => call<Looked>('irl_lookup', { fid, payload })
export const startPair = (fid: string, payload: string) => call<{ meetup_id: string; existing?: boolean }>('irl_start_pair', { fid, payload })
export const confirmMeetup = (mid: string) => call<{ status: string }>('irl_confirm', { mid })
export const declineMeetup = (mid: string) => call<{ ok: boolean }>('irl_decline', { mid })
export const startGroup = (fid: string, title: string) => call<{ meetup_id: string }>('irl_start_group', { fid, title_in: title })
export const groupPreview = (fid: string, payload: string) => call<GroupPreview>('irl_group_preview', { fid, payload })
export const joinGroup = (fid: string, payload: string) => call<{ meetup_id: string; existing?: boolean }>('irl_join_group', { fid, payload })
export const removePerson = (mid: string, uid: string) => call<{ ok: boolean }>('irl_remove_person', { mid, uid })
export const lockGroup = (mid: string) => call<{ ok: boolean }>('irl_lock_group', { mid })
export const finishGroup = (mid: string) => call<{ ok: boolean }>('irl_finish_group', { mid })

export const mine = (fid: string) => call<Meetup[]>('irl_mine', { fid })
export const scoreboard = (fid: string) => call<Row[]>('irl_scoreboard', { fid })
export const recent = (fid: string, lim = 20) => call<Recent[]>('irl_recent', { fid, lim })

// Points earned this month (the family may read the ledger; nobody can write to it).
export async function ledgerSince(fid: string, sinceIso: string): Promise<Out<LedgerLine[]>> {
  try {
    const r = await withTimeout(
      supabase.from('point_ledger').select('user_id, points, created_at').eq('family_id', fid).gte('created_at', sinceIso),
    )
    if (r.error) return { ok: false, message: friendly(r.error) }
    return { ok: true, data: (r.data ?? []) as LedgerLine[] }
  } catch {
    return { ok: false, message: OFFLINE }
  }
}
