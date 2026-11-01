-- Owner switch for the "Download the app" button on the website's sign-in screen.
-- Run in the Supabase SQL Editor (new query, paste, Run). Safe to run more than once.
-- Run 09_admin.sql first if you have not yet.
alter table public.app_settings
  add column if not exists login_download_button_enabled boolean not null default true;

grant update (login_download_button_enabled) on public.app_settings to authenticated;
