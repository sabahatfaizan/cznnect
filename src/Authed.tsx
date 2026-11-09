import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { OFFLINE_MESSAGE, friendlyError, isNetworkError, isOffline, onBackOnline } from './lib/offline'
import { readFamily, saveFamily } from './lib/offlineSession'
import { registerPush } from './lib/push'
import { readActiveFamilyId, saveActiveFamilyId } from './lib/families'
import type { Family } from './types'
import FamilySetup from './components/FamilySetup'
import Shell from './components/Shell'
import Splash from './components/Splash'

// Everything after sign-in. Finds your family, or asks you to create or join one.
export default function Authed({ userId, email, live }: { userId: string; email: string; live: boolean }) {
  const [families, setFamilies] = useState<Family[]>([])
  const [activeId, setActiveId] = useState<string | null>(() => readActiveFamilyId(userId))
  const [family, setFamily] = useState<Family | null | undefined>(undefined)
  const [error, setError] = useState('')
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const fromSaved = useRef(false) // the family on screen is the saved copy, because the phone was offline

  // Once there is a real login, tell the server this phone's push token.
  useEffect(() => {
    if (live) void registerPush()
  }, [live, userId])

  // Shows one family and remembers it as the one to open next time. An id from a newly joined family can be passed in.
  const show = useCallback((list: Family[], wanted: string | null) => {
    const pick = list.find((f) => f.id === wanted) ?? list[0] ?? null
    setFamilies(list)
    setFamily(pick)
    if (pick) {
      setActiveId(pick.id)
      saveActiveFamilyId(userId, pick.id)
      saveFamily(localStorage, userId, pick)
    }
  }, [userId])

  const load = useCallback(async (openId?: string) => {
    setError('')
    const saved = readFamily(localStorage, userId)
    // With no internet, open from the saved copy so the app still shows up (every screen then says it is offline).
    const useSaved = () => {
      if (!saved) return false
      fromSaved.current = true
      setFamilies([saved])
      setFamily(saved)
      return true
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const request = supabase
        .from('family_members')
        .select('families(id, name, invite_code)')
        .eq('user_id', userId)
        .order('joined_at')
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('This is taking longer than expected. Check your connection and try again.')), 15000)
      })
      const result = await Promise.race([request, timeout])
      if (result.error) {
        if ((result.error as { code?: string }).code === 'offline' && useSaved()) return
        setError(result.error.message)
        return
      }
      const list = ((result.data ?? []) as unknown as Array<{ families: Family | null }>).map((r) => r.families).filter((f): f is Family => Boolean(f))
      // Without a real login the database answers as if the person had no family. Do not believe that.
      if (list.length === 0 && !live) {
        if (useSaved()) return
        setError(OFFLINE_MESSAGE)
        return
      }
      fromSaved.current = false
      show(list, openId ?? activeIdRef.current)
    } catch (err) {
      if ((isNetworkError(err) || isOffline()) && useSaved()) return
      setError(friendlyError(err, 'Could not load your family. Check your connection and try again.'))
    } finally {
      if (timer) clearTimeout(timer)
    }
  }, [userId, live, show])

  useEffect(() => {
    void load()
  }, [load])

  // Back online: swap the saved copy for the real thing.
  useEffect(() => onBackOnline(() => { if (fromSaved.current) void load() }), [load])

  const switchFamily = useCallback((id: string) => {
    setFamilies((list) => {
      const pick = list.find((f) => f.id === id)
      if (pick) { setFamily(pick); setActiveId(id); saveActiveFamilyId(userId, id); saveFamily(localStorage, userId, pick) }
      return list
    })
  }, [userId])

  if (error) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
        <div className="card">
          <h1 className="font-display text-2xl font-bold">Could not load your family</h1>
          <p className="mt-2 text-sm">{error}</p>
          <p className="mt-2 text-sm text-muted">Your account is still signed in. No family data has been changed.</p>
          <p className="mt-2 text-sm text-muted">
            If this mentions a missing table, run supabase/01_accounts.sql in Supabase first.
          </p>
          <button className="btn btn-primary mt-4 w-full" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (family === undefined) return <Splash />
  if (family === null) return <FamilySetup onDone={(id) => void load(id)} />
  return (
    <Shell
      key={family.id}
      family={family}
      families={families}
      userId={userId}
      email={email}
      onFamilyChanged={() => void load()}
      onSwitchFamily={switchFamily}
      onFamilyAdded={(id) => void load(id)}
    />
  )
}
