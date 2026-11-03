-- Lets the APK build tell the app "a new version is being published", so the app can show a please-wait notice.
-- Run in the Supabase SQL Editor (new query, paste, Run). Needs 12_build_token.sql to have been run first.
alter table public.app_settings
  add column if not exists build_in_progress boolean not null default false,
  add column if not exists build_started_at timestamptz;

create or replace function public.set_build_status(token text, building boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  saved text;
begin
  select build_token_hash into saved from public.app_secrets where id = 1;
  if saved is null or encode(sha256(convert_to(coalesce(token, ''), 'utf8')), 'hex') <> saved then
    raise exception 'Invalid token';
  end if;
  update public.app_settings
    set build_in_progress = building,
        build_started_at = case when building then now() else build_started_at end
    where id = 1;
  return case when building then 'building' else 'idle' end;
end;
$$;
revoke all on function public.set_build_status(text, boolean) from public;
grant execute on function public.set_build_status(text, boolean) to anon, authenticated;
