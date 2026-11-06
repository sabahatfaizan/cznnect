-- Cznnect: the live family pulse (who is around right now). Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- Run it after 01_accounts.sql.
--
-- Each phone says "I'm here" about once a minute while the app is open. Family members can see who has been around
-- lately, unless that person turned "Show when I'm online" off in Settings. Only family members see anything.
create table if not exists public.member_presence (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  last_seen timestamptz not null default now(),
  visible   boolean not null default true
);
alter table public.member_presence enable row level security;
revoke all on public.member_presence from anon, authenticated;

create or replace function public.touch_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.member_presence (user_id, last_seen) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen = now();
end;
$$;

create or replace function public.set_presence_visible(show boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  insert into public.member_presence (user_id, visible) values (auth.uid(), show)
  on conflict (user_id) do update set visible = show;
end;
$$;

create or replace function public.my_presence_visible()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select visible from public.member_presence where user_id = auth.uid()), true);
$$;

-- Who in this family was around in the last 24 hours (and has not hidden themselves).
create or replace function public.family_presence(fid uuid)
returns table (user_id uuid, last_seen timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.last_seen
  from public.member_presence p
  join public.family_members fm on fm.user_id = p.user_id and fm.family_id = fid
  where public.is_family_member(fid)
    and p.visible
    and p.last_seen > now() - interval '24 hours';
$$;

revoke execute on function public.touch_presence() from public, anon;
revoke execute on function public.set_presence_visible(boolean) from public, anon;
revoke execute on function public.my_presence_visible() from public, anon;
revoke execute on function public.family_presence(uuid) from public, anon;
grant execute on function public.touch_presence() to authenticated;
grant execute on function public.set_presence_visible(boolean) to authenticated;
grant execute on function public.my_presence_visible() to authenticated;
grant execute on function public.family_presence(uuid) to authenticated;
