// Paste your two Supabase values between the quotes (Supabase > Project Settings > API).
// The anon key is meant to be public. Your data is protected by the privacy rules
// in supabase/01_accounts.sql, not by hiding this key.

export const SUPABASE_URL = 'https://quatnrlyzitmgsvqyzbi.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_zs5gX4aC4D-3wCZ4DChDpg_klTDPoB4'

export const configured = SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20

// Where the website lives. QR codes carry links to this address so any phone camera can open them.
export const SITE_URL = 'https://sabahatfaizan.github.io/cznnect/'
