import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, configured } from './config'
import { buildHeaderValue } from './lib/updateGate'

// The installed Android app tells the database which build it is, so the database can refuse apps older than the
// owner's minimum (supabase/10_enforce_min_build.sql). The website has no build number and sends nothing.
const build = buildHeaderValue(import.meta.env.VITE_BUILD_NUMBER)

// Placeholders keep the app from crashing before the real values are pasted in.
export const supabase = createClient(
  configured ? SUPABASE_URL : 'https://not-configured.supabase.co',
  configured ? SUPABASE_ANON_KEY : 'not-configured',
  build ? { global: { headers: { 'x-app-build': build } } } : undefined,
)
