import { useEffect, useState } from 'react'
import { cachedPlus, hasPlus } from './plus'

// Does this person have Cznnect+? Starts with the last answer kept on the phone, then checks.
export function usePlus(): boolean {
  const [plus, setPlus] = useState(cachedPlus())
  useEffect(() => { void hasPlus().then(setPlus) }, [])
  return plus
}
