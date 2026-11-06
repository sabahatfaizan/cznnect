import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

// The live family pulse: who is around, and what is new. Every call fails quietly (and the card just shows less)
// until supabase/18_pulse.sql and supabase/17_family_chat.sql have been run.

export const ONLINE_MS = 2 * 60_000

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 90) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h === 1 ? '1 hour ago' : `${h} hours ago`
}

// Says "I'm here" about once a minute while the app is open and visible.
export function useHeartbeat() {
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState === 'visible') void Promise.resolve(supabase.rpc('touch_presence')).catch(() => {})
    }
    beat()
    const id = window.setInterval(beat, 60_000)
    document.addEventListener('visibilitychange', beat)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', beat) }
  }, [])
}

// user id -> when they were last around, for people who have not hidden themselves.
export function usePresence(familyId: string, pollMs = 30_000): Map<string, string> {
  const [seen, setSeen] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const { data, error } = await supabase.rpc('family_presence', { fid: familyId })
        if (!alive || error || !Array.isArray(data)) return
        setSeen(new Map((data as { user_id: string; last_seen: string }[]).map((r) => [r.user_id, r.last_seen])))
      } catch {
        // The card just shows nobody.
      }
    }
    void load()
    const id = window.setInterval(load, pollMs)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; window.clearInterval(id); document.removeEventListener('visibilitychange', load) }
  }, [familyId, pollMs])
  return seen
}

export async function getPresenceVisible(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('my_presence_visible')
    return error ? true : data !== false
  } catch {
    return true
  }
}

export async function setPresenceVisible(show: boolean): Promise<void> {
  try {
    await supabase.rpc('set_presence_visible', { show })
  } catch {
    // Offline: the switch is tried again the next time it is flipped.
  }
}

// ----- chat: what is new since you last looked -----

export type ChatPulse = { unread: number; latest: { sender: string; body: string; created_at: string; mine: boolean } | null }
type Row = { id: number; user_id: string; sender: string; body: string; created_at: string }

const readKey = (familyId: string) => `cznnect-chat-read-${familyId}`
const READ_EVENT = 'cznnect-chat-read'

// The chat page calls this with the newest message it has shown.
export function markChatRead(familyId: string, id: number) {
  try {
    localStorage.setItem(readKey(familyId), String(id))
  } catch {
    // Private mode: the badge just comes back next time.
  }
  window.dispatchEvent(new Event(READ_EVENT))
}

export function useChatPulse(familyId: string, userId: string, pollMs = 15_000): ChatPulse {
  const [pulse, setPulse] = useState<ChatPulse>({ unread: 0, latest: null })
  const rows = useRef<Row[]>([])

  const compute = useCallback(() => {
    const list = rows.current
    const last = list[list.length - 1]
    if (!last) { setPulse({ unread: 0, latest: null }); return }
    let read: number | null = null
    try {
      const raw = localStorage.getItem(readKey(familyId))
      read = raw === null ? null : Number(raw)
    } catch {
      read = null
    }
    // The first time on this phone nothing counts as unread, so old messages never show up as a pile of "new".
    if (read === null) {
      read = last.id
      try { localStorage.setItem(readKey(familyId), String(read)) } catch { /* ignore */ }
    }
    const unread = list.filter((m) => m.id > (read as number) && m.user_id !== userId).length
    setPulse({ unread, latest: { sender: last.sender, body: last.body, created_at: last.created_at, mine: last.user_id === userId } })
  }, [familyId, userId])

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const { data, error } = await supabase.rpc('family_messages', { fid: familyId, lim: 30 })
        if (!alive || error || !Array.isArray(data)) return
        rows.current = data as Row[]
        compute()
      } catch {
        // No badge until the chat is set up.
      }
    }
    void load()
    const id = window.setInterval(load, pollMs)
    document.addEventListener('visibilitychange', load)
    window.addEventListener(READ_EVENT, compute)
    return () => { alive = false; window.clearInterval(id); document.removeEventListener('visibilitychange', load); window.removeEventListener(READ_EVENT, compute) }
  }, [familyId, pollMs, compute])

  return pulse
}

// Polls the family has open that this person has not voted in yet.
export async function pollsAwaitingVote(familyId: string, userId: string): Promise<number> {
  try {
    const [polls, votes] = await Promise.all([
      supabase.from('polls').select('id').eq('family_id', familyId).eq('closed', false),
      supabase.from('poll_votes').select('poll_id').eq('family_id', familyId).eq('user_id', userId),
    ])
    if (polls.error || votes.error) return 0
    const voted = new Set((votes.data ?? []).map((v: { poll_id: string }) => v.poll_id))
    return (polls.data ?? []).filter((p: { id: string }) => !voted.has(p.id)).length
  } catch {
    return 0
  }
}
