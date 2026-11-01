-- A narrow token for the APK build: it can only raise the required app build number, nothing else.
-- Run in the Supabase SQL Editor (new query, paste, Run). Run 09_admin.sql first.
-- The last line shows the token ONCE. Copy it into GitHub: repo Settings > Secrets and variables > Actions >
-- New repository secret, name BUILD_TOKEN. Running this file again makes a new token and the old one stops working.

create table if not exists public.app_secrets (
  id integer primary key check (id = 1),
  build_token_hash text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

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
  -- Only raises, and only while forced updates are on (min_build above 0).
  update public.app_settings
    set min_build = build, updated_at = now()
    where id = 1 and min_build > 0 and min_build < build;
  get diagnostics changed = row_count;
  return case when changed > 0 then 'raised' else 'unchanged' end;
end;
$$;
revoke all on function public.raise_min_build(text, integer) from public;
grant execute on function public.raise_min_build(text, integer) to anon, authenticated;

with new_token as (
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as tok
),
saved as (
  insert into public.app_secrets (id, build_token_hash)
  select 1, encode(sha256(convert_to(tok, 'utf8')), 'hex') from new_token
  on conflict (id) do update set build_token_hash = excluded.build_token_hash
  returning 1
)
select tok as "Copy this into GitHub as BUILD_TOKEN" from new_token, saved;
