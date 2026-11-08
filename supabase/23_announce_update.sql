-- Announce an update: the "A new version is ready" card in the Android app appears only for builds older than the
-- build you announce in Admin, under Updates. 0 means nothing is announced, so everyone stays on the build they have.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again. Needs 09_admin.sql to have been run.
alter table public.app_settings
  add column if not exists announced_build integer not null default 0;

grant update (announced_build) on public.app_settings to authenticated;
