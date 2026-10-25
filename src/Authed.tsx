import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Family } from './types'
import FamilySetup from './components/FamilySetup'
import Shell from './components/Shell'
import Splash from './components/Splash'

// Everything after sign-in. Finds your family, or asks you to create or join one.
export default function Authed({ userId, email }: { userId: string; email: string }) {
  const [family, setFamily] = useState<Family | null | undefined>(undefined)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { data, error } = await supabase
      .from('family_members')
      .select('families(id, name, invite_code)')
      .eq('user_id', userId)
      .order('joined_at')
      .limit(1)
      .maybeSingle()
    if (error) {
      setError(error.message)
      return
    }
    setFamily((data?.families as unknown as Family | undefined) ?? null)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
        <div className="card">
          <h1 className="font-display text-2xl font-bold">Could not load your family</h1>
          <p className="mt-2 text-sm">{error}</p>
          <p className="mt-2 text-sm text-muted">
            If this mentions a missing table, run supabase/01_accounts.sql in Supabase first.
          </p>
          <button className="btn btn-primary mt-4 w-full" onClick={load}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (family === undefined) return <Splash />
  if (family === null) return <FamilySetup onDone={load} />
  return <Shell family={family} userId={userId} email={email} onFamilyChanged={load} />
}
