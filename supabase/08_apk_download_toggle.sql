-- Owner switch: show or hide the "Get the latest app" download on the maintenance screen.
-- Run in the Supabase SQL Editor (new query, paste, Run). Safe to run more than once.
alter table public.app_settings add column if not exists apk_download_enabled boolean not null default true;
grant update (apk_download_enabled) on public.app_settings to authenticated;
