-- Forced updates: a build number you set stays exactly as you set it, unless you turn on "Always require the newest build".
-- Before this, every new APK build raised the required build to itself whenever forced updates were on, which is why a
-- specific number behaved like "Require latest". Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- Needs 09_admin.sql and 12_build_token.sql to have been run.
alter table public.app_settings
  add column if not exists auto_raise_min_build boolean not null default false;

grant update (auto_raise_min_build) on public.app_settings to authenticated;

create or replace function public.raise_min_build(token text, build integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  saved text;
  changed integer;
begin
  select build_token_hash into saved from public.app_secrets where id = 1;
  if saved is null or encode(sha256(convert_to(coalesce(token, ''), 'utf8')), 'hex') <> saved then
    raise exception 'Invalid token';
  end if;
  -- Only raises, only while forced updates are on, and only when the owner has switched on automatic raising.
  update public.app_settings
    set min_build = build, updated_at = now()
    where id = 1 and auto_raise_min_build and min_build > 0 and min_build < build;
  get diagnostics changed = row_count;
  return case when changed > 0 then 'raised' else 'unchanged' end;
end;
$$;
revoke all on function public.raise_min_build(text, integer) from public;
grant execute on function public.raise_min_build(text, integer) to anon, authenticated;
