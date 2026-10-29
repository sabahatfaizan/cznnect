// Every change to polls and bucket lists goes through here, so errors always come back as
// plain sentences the screens can show.
import { supabase } from '../supabase'
import { withTimeout } from './net'
import type { Horizon, Difficulty } from './plans'

type DbError = { message: string; code?: string }

function friendly(e: DbError): string {
  if (e.code === '23505') return 'That is already on the list.'
  if (e.code === '42501') return 'You do not have permission to do that.'
  if (e.code === '23514') return 'Please check the details. A title is required, and some fields have a length limit.'
  if (e.code === 'PGRST205' || e.code === '42P01' || e.code === 'PGRST202') {
    return 'Polls and bucket lists are not set up yet. In Supabase, run supabase/06_plans.sql.'
  }
  return e.message
}

async function run<T>(
  fn: () => PromiseLike<{ data: T | null; error: DbError | null }>,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const r = await withTimeout(fn())
    return { data: r.data, error: r.error ? friendly(r.error) : null }
  } catch {
    return { data: null, error: 'Could not reach the server. Check your connection and try again.' }
  }
}

// ----- polls -----

export async function createPoll(familyId: string, question: string, choices: string[]): Promise<string | null> {
  const r = await run<string>(() => supabase.rpc('create_poll', { fid: familyId, question_in: question, options_in: choices }))
  return r.error
}

export async function castVote(pollId: string, optionId: string): Promise<string | null> {
  const r = await run<null>(() => supabase.rpc('cast_vote', { pid: pollId, oid: optionId }))
  return r.error
}

export async function removeVote(pollId: string, userId: string): Promise<string | null> {
  const r = await run<{ poll_id: string }[]>(() =>
    supabase.from('poll_votes').delete().eq('poll_id', pollId).eq('user_id', userId).select('poll_id'),
  )
  if (r.error) return r.error
  return (r.data?.length ?? 0) === 0 ? 'Could not take back your vote. The poll may be closed.' : null
}

export async function setPollClosed(pollId: string, closed: boolean): Promise<string | null> {
  const r = await run<null>(() => supabase.rpc('set_poll_closed', { pid: pollId, closed_in: closed }))
  return r.error
}

export async function deletePoll(pollId: string): Promise<string | null> {
  const r = await run<{ id: string }[]>(() => supabase.from('polls').delete().eq('id', pollId).select('id'))
  if (r.error) return r.error
  return (r.data?.length ?? 0) === 0 ? 'Only the owner or the person who started this poll can remove it.' : null
}

// ----- bucket list -----

export type ItemValues = {
  title: string
  notes: string
  horizon: Horizon
  due_date: string // '' when there is no deadline
  assigned_to: string // '' when nobody
  difficulty: Difficulty
}

function clean(v: ItemValues) {
  return {
    title: v.title.trim(),
    notes: v.notes.trim() || null,
    horizon: v.horizon,
    due_date: v.due_date || null,
    assigned_to: v.assigned_to || null,
    difficulty: v.difficulty,
  }
}

export async function addItem(familyId: string, v: ItemValues): Promise<{ id: string | null; error: string | null }> {
  const r = await run<{ id: string }>(() =>
    supabase.from('bucket_items').insert({ family_id: familyId, ...clean(v) }).select('id').single(),
  )
  return { id: r.data?.id ?? null, error: r.error }
}

export async function updateItem(id: string, v: ItemValues): Promise<string | null> {
  const r = await run<{ id: string }[]>(() => supabase.from('bucket_items').update(clean(v)).eq('id', id).select('id'))
  if (r.error) return r.error
  return (r.data?.length ?? 0) === 0 ? 'Could not save. This item may have been removed.' : null
}

export async function setItemDone(id: string, done: boolean): Promise<string | null> {
  const r = await run<{ id: string }[]>(() => supabase.from('bucket_items').update({ done }).eq('id', id).select('id'))
  if (r.error) return r.error
  return (r.data?.length ?? 0) === 0 ? 'Could not update. This item may have been removed.' : null
}

export async function deleteItem(id: string): Promise<string | null> {
  const r = await run<{ id: string }[]>(() => supabase.from('bucket_items').delete().eq('id', id).select('id'))
  if (r.error) return r.error
  return (r.data?.length ?? 0) === 0 ? 'Only the owner or the person who added this can remove it.' : null
}

export async function setImIn(itemId: string, familyId: string, userId: string, on: boolean): Promise<string | null> {
  if (on) {
    const r = await run<null>(() => supabase.from('bucket_votes').insert({ item_id: itemId, family_id: familyId }))
    // Tapping twice is harmless: it just means they were already in.
    return r.error && r.error !== friendly({ message: '', code: '23505' }) ? r.error : null
  }
  const r = await run<{ item_id: string }[]>(() =>
    supabase.from('bucket_votes').delete().eq('item_id', itemId).eq('user_id', userId).select('item_id'),
  )
  return r.error
}
