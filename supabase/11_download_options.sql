-- Download page options: separate switches for the Android download, the iPhone install option, and letting
-- website visitors carry on in the browser. Run in the Supabase SQL Editor (new query, paste, Run).
-- Safe to run more than once. Run 09_admin.sql first if you have not yet.
alter table public.app_settings
  add column if not exists android_download_enabled boolean not null default true,
  add column if not exists ios_install_enabled boolean not null default true,
  add column if not exists web_continue_enabled boolean not null default true;

grant update (android_download_enabled, ios_install_enabled, web_continue_enabled) on public.app_settings to authenticated;
