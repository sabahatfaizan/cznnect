import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'

type Announcement = {
  id: string
  title: string
  body: string
  image_url: string
  action_label: string
  action_url: string
}

export default function AnnouncementPopup({ userId, live }: { userId: string; live: boolean }) {
  const [item, setItem] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(false)

  const dismiss = useCallback(async () => {
    const current = item
    if (!current) return
    setItem(null)
    if (live) {
      const { error } = await supabase.from('app_announcement_dismissals').upsert(
        { announcement_id: current.id, user_id: userId },
        { onConflict: 'announcement_id,user_id', ignoreDuplicates: true },
      )
      if (error) console.warn('Could not save announcement dismissal:', error.message)
    }
  }, [item, live, userId])

  useEffect(() => {
    if (!live || !userId) return
    let alive = true
    setLoading(true)
    const load = async () => {
      try {
        const { data: dismissed, error: dismissedError } = await supabase
          .from('app_announcement_dismissals')
          .select('announcement_id')
          .eq('user_id', userId)
        if (dismissedError) throw dismissedError
        const excluded = (dismissed ?? []).map((row) => row.announcement_id)
        const { data, error } = await supabase.from('app_announcements')
          .select('id,title,body,image_url,action_label,action_url,starts_at,ends_at')
          .eq('published', true).order('created_at', { ascending: false }).limit(50)
        if (error) throw error
        const now = Date.now()
        const hidden = new Set(excluded)
        const eligible = (data ?? []).find((row) =>
          !hidden.has(row.id) &&
          (!row.starts_at || new Date(row.starts_at).getTime() <= now) &&
          (!row.ends_at || new Date(row.ends_at).getTime() > now),
        )
        if (alive) setItem((eligible as Announcement | undefined) ?? null)
      } catch (error) {
        console.warn('Could not load Cznnect announcements:', error)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [live, userId])

  if (!item || loading) return null
  const openAction = () => {
    const target = item.action_url.trim()
    if (!target) return
    if (target.startsWith('/')) window.location.assign(target)
    else {
      try {
        const url = new URL(target)
        if (url.protocol === 'https:' || url.protocol === 'http:') window.open(url.toString(), '_blank', 'noopener,noreferrer')
      } catch { /* Ignore malformed admin-entered URLs. */ }
    }
    void dismiss()
  }

  return createPortal(
    <div className="fixed inset-0 z-[180] flex flex-col items-center justify-center gap-4 bg-black/65 p-5" role="presentation" onClick={() => void dismiss()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cznnect-announcement-title"
        className="relative w-full max-w-md overflow-hidden rounded-[26px] border border-white/15 bg-[var(--surface)] text-[var(--ink)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {item.image_url && <img src={item.image_url} alt="" className="block h-auto w-auto max-h-[65vh] max-w-full object-contain" />}
        <div className="flex flex-col gap-3 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-accent-text">Cznnect announcement</p>
          <h2 id="cznnect-announcement-title" className="font-display text-xl font-bold leading-tight">{item.title}</h2>
          {item.body && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{item.body}</p>}
          {item.action_label && item.action_url && (
            <button type="button" className="btn btn-primary mt-1 w-full" onClick={openAction}>{item.action_label}</button>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
