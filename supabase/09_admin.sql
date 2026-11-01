-- Owner admin page: announcement banner and forced app updates.
-- Run in the Supabase SQL Editor (new query, paste, Run). Safe to run more than once.
-- Also run 08_apk_download_toggle.sql if you have not yet.
alter table public.app_settings
  add column if not exists announcement_enabled boolean not null default false,
  add column if not exists announcement_text text not null default '',
  add column if not exists min_build integer not null default 0 check (min_build >= 0);

-- Only the owner can change settings: the existing "Only Cznnect owner can update maintenance" policy
-- already limits updates to the owner's email; these grants add the new columns to it.
grant update (announcement_enabled, announcement_text, min_build, apk_download_enabled) on public.app_settings to authenticated;
