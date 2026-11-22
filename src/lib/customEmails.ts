import { supabase } from '../supabase'
import { withTimeout } from './net'
import { OFFLINE_MESSAGE, probeConnection, reportNetwork } from './offline'
import { SUPABASE_URL } from '../config'
import type { EmailCategory, EmailKind } from './emailCategories'
import { PROMO_CATEGORIES } from './promoEmails'

// Custom emails. The owner sends through the send-custom-email function (it holds the SMTP login or email service key and does
// the skipping of people who turned a category off). A "direct" message goes to one person whatever their switches say. People manage their own switches in the email_optouts table.
export type SendResult = { sent: number; skipped: number; failed: number }
export type EmailLogRow = { id: string; category: string; subject: string; sent: number; skipped: number; failed: number; created_at: string }

async function readError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const j = (await ctx.json()) as { error?: string }
      if (j.error) return j.error
    } catch { /* fall through */ }
  }
  const m = (error as { message?: string } | null)?.message ?? ''
  if (/not found|404/i.test(m)) return 'The email function is not deployed yet. Run: supabase functions deploy send-custom-email'
  return m || 'Could not send. Check your connection and try again.'
}

// The app turns any request that cannot reach the server into "You're offline". For the email function that is often wrong:
// the phone is fine, but the function is not deployed (or crashed on start), so its reply never reaches the app. Check whether
// the server itself answers; if it does, say what is really wrong and clear the false "Offline" label.
async function explain(message: string): Promise<string> {
  if (message !== OFFLINE_MESSAGE && !/failed to send a request|failed to fetch|load failed/i.test(message)) return message
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return OFFLINE_MESSAGE
  if (!(await probeConnection(SUPABASE_URL))) return OFFLINE_MESSAGE
  reportNetwork(true)
  return 'You are online, but the email function did not answer. In Supabase, deploy send-custom-email (supabase functions deploy send-custom-email) and check its logs.'
}

export async function sendCustomEmail(args: { category: EmailKind; subject: string; body: string; userIds: string[]; test?: boolean }): Promise<{ ok: true; data: SendResult } | { ok: false; message: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-custom-email', {
      body: { category: args.category, subject: args.subject, body: args.body, user_ids: args.userIds, test: Boolean(args.test) },
    })
    if (error) return { ok: false, message: await explain(await readError(error)) }
    if (data?.error) return { ok: false, message: String(data.error) }
    return { ok: true, data: { sent: data?.sent ?? 0, skipped: data?.skipped ?? 0, failed: data?.failed ?? 0 } }
  } catch (e) {
    return { ok: false, message: await explain(await readError(e)) }
  }
}

// Who has switched this category off (owner only). Null when the database part is not set up yet.
export async function optedOut(category: EmailCategory): Promise<Set<string> | null> {
  try {
    const r = await withTimeout(supabase.rpc('admin_email_optouts', { p_category: category }))
    return r.error ? null : new Set((r.data ?? []) as string[])
  } catch {
    return null
  }
}

export async function recentEmails(): Promise<EmailLogRow[]> {
  try {
    const r = await withTimeout(supabase.from('email_log').select('id, category, subject, sent, skipped, failed, created_at').order('created_at', { ascending: false }).limit(8))
    return r.error ? [] : ((r.data ?? []) as EmailLogRow[])
  } catch {
    return []
  }
}

// A person's own switches.
export async function myOptOuts(userId: string): Promise<Set<string> | null> {
  try {
    const r = await withTimeout(supabase.from('email_optouts').select('category').eq('user_id', userId))
    return r.error ? null : new Set(((r.data ?? []) as { category: string }[]).map((x) => x.category))
  } catch {
    return null
  }
}

export async function setMyOptOut(userId: string, category: EmailCategory, off: boolean): Promise<boolean> {
  try {
    const r = off
      ? await withTimeout(supabase.from('email_optouts').upsert({ user_id: userId, category }))
      : await withTimeout(supabase.from('email_optouts').delete().eq('user_id', userId).eq('category', category))
    return !r.error
  } catch {
    return false
  }
}

// A new person who unticked "Send me news and updates by email": switch the four promo categories off for them.
export async function optOutOfPromos(userId: string): Promise<boolean> {
  try {
    const r = await withTimeout(supabase.from('email_optouts').upsert(PROMO_CATEGORIES.map((category) => ({ user_id: userId, category }))))
    return !r.error
  } catch {
    return false
  }
}
