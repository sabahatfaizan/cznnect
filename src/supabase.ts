import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, configured } from './config'
import { buildHeaderValue } from './lib/updateGate'
import { offlineAwareFetch } from './lib/offline'

// The installed Android app tells the database which build it is, so the database can refuse apps older than the
// owner's minimum (supabase/10_enforce_min_build.sql). The website has no build number and sends nothing.
const build = buildHeaderValue(import.meta.env.VITE_BUILD_NUMBER)

// Placeholders keep the app from crashing before the real values are pasted in.
export const supabase = createClient(
  configured ? SUPABASE_URL : 'https://not-configured.supabase.co',
  configured ? SUPABASE_ANON_KEY : 'not-configured',
  // Every request goes through offlineAwareFetch, so with no internet screens get a readable "You're offline" error
  // instead of the browser's "TypeError: Failed to fetch".
  { global: { fetch: offlineAwareFetch, ...(build ? { headers: { 'x-app-build': build } } : {}) } },
)
