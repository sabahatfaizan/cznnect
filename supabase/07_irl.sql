-- Cznnect, Convoy: meet cousins in person, confirm it, earn points, climb the scoreboard.
-- Run this after 01 to 06. Paste it into Supabase > SQL Editor > New query, then Run.
-- Safe to run again.
--
-- How it works
--   Everyone has a personal QR code. It holds an opaque random handle plus a one-time code that
--   changes every 5 minutes (it works for 5 to 10 minutes), so a screenshot is useless later.
--   It contains no name, email or account id.
--   Pair meetup: one cousin scans the other and taps "We are together"; the other cousin confirms.
--   Group meetup (3 to 12 cousins): the host starts it and shows a QR; cousins scan to join; the host
--   locks the group; everyone confirms; then it is verified.
--   Points are decided only by the functions below and recorded in point_ledger. The app cannot write them.
--
-- Rules (change the numbers here if you want to):
--   pair meetup = 10 points each; group = 10 + 5 for each cousin beyond two, at most 40 each
--   the same two cousins earn points together at most once every 24 hours
--   one person earns points from at most 3 meetups in any 24 hours
--   an unconfirmed pair meetup expires after 30 minutes; a group after 90 minutes
--   at most 12 meetups started per person per hour; 15 wrong codes in 10 minutes pauses scanning

-- 1. Tables ---------------------------------------------------------------------

create table if not exists public.irl_secrets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  handle text not null unique,
  secret text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.irl_failures (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists irl_failures_recent on public.irl_failures (user_id, at);

create table if not exists public.meetups (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('pair', 'group')),
  host_id uuid references public.profiles (id) on delete set null,
  title text check (title is null or length(title) <= 60),
  join_code text,
  status text not null default 'pending'
    check (status in ('pending', 'open', 'locked', 'verified', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  points_each int,
  unique (id, family_id)
);
create unique index if not exists meetups_join_code_once on public.meetups (join_code) where join_code is not null;
create index if not exists meetups_by_family on public.meetups (family_id, status);

create table if not exists public.meetup_people (
  meetup_id uuid not null,
  family_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  confirmed boolean not null default false,
  confirmed_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (meetup_id, user_id),
  foreign key (meetup_id, family_id) references public.meetups (id, family_id) on delete cascade
);
create index if not exists meetup_people_by_user on public.meetup_people (user_id);

-- The permanent record of every point awarded. One row per person per meetup (0 points is recorded too).
create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  meetup_id uuid not null,
  points int not null check (points >= 0),
  note text not null,
  created_at timestamptz not null default now(),
  unique (meetup_id, user_id),
  foreign key (meetup_id, family_id) references public.meetups (id, family_id) on delete cascade
);
create index if not exists point_ledger_by_user on public.point_ledger (family_id, user_id);

-- When two cousins last earned points together (a is always the smaller id).
create table if not exists public.pair_log (
  family_id uuid not null references public.families (id) on delete cascade,
  a uuid not null,
  b uuid not null,
  last_at timestamptz not null default now(),
  primary key (family_id, a, b),
  check (a < b)
);

-- 2. Privacy rules --------------------------------------------------------------

create or replace function public.is_meetup_participant(mid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.meetup_people where meetup_id = mid and user_id = auth.uid());
$$;

create or replace function public.meetup_is_verified(mid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.meetups where id = mid and status = 'verified');
$$;

alter table public.irl_secrets enable row level security;
alter table public.irl_failures enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_people enable row level security;
alter table public.point_ledger enable row level security;
alter table public.pair_log enable row level security;

drop policy if exists "see verified meetups and your own" on public.meetups;
create policy "see verified meetups and your own" on public.meetups
  for select to authenticated
  using (public.is_family_member(family_id) and (status = 'verified' or public.is_meetup_participant(id)));

drop policy if exists "see who was at a meetup" on public.meetup_people;
create policy "see who was at a meetup" on public.meetup_people
  for select to authenticated
  using (public.is_family_member(family_id)
         and (public.is_meetup_participant(meetup_id) or public.meetup_is_verified(meetup_id)));

drop policy if exists "family sees the points" on public.point_ledger;
create policy "family sees the points" on public.point_ledger
  for select to authenticated
  using (public.is_family_member(family_id));

-- The app can only read. Every change goes through the functions below.
revoke all on public.irl_secrets, public.irl_failures, public.meetups, public.meetup_people,
              public.point_ledger, public.pair_log from anon, authenticated;
grant select on public.meetups, public.meetup_people, public.point_ledger to authenticated;

-- 3. Internal helpers (not callable from the app) --------------------------------

create or replace function public.irl_code_for(secret_in text, win bigint)
returns text
language sql
immutable
as $$
  select upper(substr(encode(sha256(convert_to(secret_in || ':' || win::text, 'UTF8')), 'hex'), 1, 10));
$$;

-- The user a QR payload points to, or null when it is wrong, expired, or for someone outside the family.
create or replace function public.irl_resolve(fid uuid, payload text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  parts text[];
  s record;
  w bigint := floor(extract(epoch from now()) / 300)::bigint;
begin
  parts := string_to_array(upper(trim(coalesce(payload, ''))), '.');
  if array_length(parts, 1) is distinct from 3 or parts[1] <> 'CZN1' then
    return null;
  end if;
  select * into s from public.irl_secrets where handle = parts[2];
  if not found then
    return null;
  end if;
  if not exists (select 1 from public.family_members where family_id = fid and user_id = s.user_id) then
    return null;
  end if;
  if parts[3] = public.irl_code_for(s.secret, w) or parts[3] = public.irl_code_for(s.secret, w - 1) then
    return s.user_id;
  end if;
  return null;
end;
$$;

create or replace function public.irl_expire(fid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.meetups
     set status = 'expired', ended_at = now(), join_code = null
   where family_id = fid and status in ('pending', 'open', 'locked') and expires_at < now();
$$;

-- Common checks. Raises for "not signed in / not in this family"; returns an error object when scanning is paused.
create or replace function public.irl_gate(fid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.is_family_member(fid) then
    raise exception 'You are not in that family';
  end if;
  perform public.irl_expire(fid);
  delete from public.irl_failures where at < now() - interval '1 day';
  if (select count(*) from public.irl_failures where user_id = auth.uid() and at > now() - interval '10 minutes') >= 15 then
    return jsonb_build_object('error', 'paused', 'message', 'Too many wrong codes. Wait a few minutes and try again.');
  end if;
  return null;
end;
$$;

create or replace function public.irl_bad_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.irl_failures (user_id) values (auth.uid());
  return jsonb_build_object('error', 'invalid', 'message', 'That QR code is not valid or has expired. Ask them to open their code again.');
end;
$$;

-- Decide the points and close the meetup, once every person has confirmed.
create or replace function public.irl_finalize(mid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  n int;
  base int;
  p record;
  pts int;
  fresh boolean;
  today_count int;
begin
  select * into m from public.meetups where id = mid for update;
  if not found or m.status not in ('pending', 'locked') then
    return;
  end if;
  if exists (select 1 from public.meetup_people where meetup_id = mid and not confirmed) then
    return;
  end if;
  select count(*) into n from public.meetup_people where meetup_id = mid;
  if (m.kind = 'pair' and n <> 2) or (m.kind = 'group' and n < 3) then
    return;
  end if;

  base := case when m.kind = 'pair' then 10 else least(40, 10 + 5 * (n - 2)) end;

  for p in select user_id from public.meetup_people where meetup_id = mid loop
    -- Points need at least one person here that this cousin has not earned with in the last 24 hours.
    fresh := exists (
      select 1 from public.meetup_people q
      where q.meetup_id = mid and q.user_id <> p.user_id
        and not exists (
          select 1 from public.pair_log l
          where l.family_id = m.family_id
            and l.a = least(p.user_id, q.user_id) and l.b = greatest(p.user_id, q.user_id)
            and l.last_at > now() - interval '24 hours'
        )
    );
    select count(*) into today_count from public.point_ledger
      where family_id = m.family_id and user_id = p.user_id and points > 0
        and created_at > now() - interval '24 hours';
    pts := case when fresh and today_count < 3 then base else 0 end;
    insert into public.point_ledger (family_id, user_id, meetup_id, points, note)
    values (m.family_id, p.user_id, mid, pts,
            case when pts > 0 then 'meetup' when not fresh then 'cooldown' else 'daily limit' end);
  end loop;

  insert into public.pair_log (family_id, a, b, last_at)
  select m.family_id, least(x.user_id, y.user_id), greatest(x.user_id, y.user_id), now()
  from public.meetup_people x
  join public.meetup_people y on y.meetup_id = x.meetup_id and x.user_id < y.user_id
  where x.meetup_id = mid
  on conflict (family_id, a, b) do update set last_at = now()
    where public.pair_log.last_at <= now() - interval '24 hours';

  update public.meetups
     set status = 'verified', ended_at = now(), points_each = base, join_code = null
   where id = mid;
end;
$$;

-- 4. Your QR code ----------------------------------------------------------------

drop function if exists public.irl_my_code(uuid);
create function public.irl_my_code(fid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  w bigint := floor(extract(epoch from now()) / 300)::bigint;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.is_family_member(fid) then
    raise exception 'You are not in that family';
  end if;
  insert into public.irl_secrets (user_id, handle, secret)
  values (
    auth.uid(),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  )
  on conflict (user_id) do nothing;
  select * into s from public.irl_secrets where user_id = auth.uid();
  return jsonb_build_object(
    'handle', s.handle,
    'code', public.irl_code_for(s.secret, w),
    'seconds_left', 300 - (floor(extract(epoch from now()))::bigint % 300)
  );
end;
$$;

-- 5. Pair meetups ----------------------------------------------------------------

drop function if exists public.irl_lookup(uuid, text);
create function public.irl_lookup(fid uuid, payload text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gate jsonb;
  target uuid;
  last timestamptz;
  cool int := 0;
  mine int;
begin
  gate := public.irl_gate(fid);
  if gate is not null then return gate; end if;
  target := public.irl_resolve(fid, payload);
  if target is null then return public.irl_bad_code(); end if;
  if target = auth.uid() then
    return jsonb_build_object('error', 'self', 'message', 'That is your own code. Scan a cousin''s.');
  end if;
  select l.last_at into last from public.pair_log l
    where l.family_id = fid and l.a = least(auth.uid(), target) and l.b = greatest(auth.uid(), target);
  if last is not null and last > now() - interval '24 hours' then
    cool := ceil(extract(epoch from (last + interval '24 hours' - now())))::int;
  end if;
  select greatest(0, 3 - count(*)) into mine from public.point_ledger
    where family_id = fid and user_id = auth.uid() and points > 0 and created_at > now() - interval '24 hours';
  return jsonb_build_object(
    'ok', true,
    'user_id', target,
    'name', (select display_name from public.profiles where id = target),
    'cooldown_seconds', cool,
    'daily_left', mine
  );
end;
$$;

drop function if exists public.irl_start_pair(uuid, text);
create function public.irl_start_pair(fid uuid, payload text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gate jsonb;
  target uuid;
  last timestamptz;
  ex uuid;
  mid uuid;
begin
  gate := public.irl_gate(fid);
  if gate is not null then return gate; end if;
  target := public.irl_resolve(fid, payload);
  if target is null then return public.irl_bad_code(); end if;
  if target = auth.uid() then
    return jsonb_build_object('error', 'self', 'message', 'That is your own code. Scan a cousin''s.');
  end if;

  -- They may already have started this meetup with you. Your tap is then your confirmation.
  select m.id into ex from public.meetups m
   where m.family_id = fid and m.kind = 'pair' and m.status = 'pending' and m.expires_at > now()
     and exists (select 1 from public.meetup_people p where p.meetup_id = m.id and p.user_id = auth.uid())
     and exists (select 1 from public.meetup_people p where p.meetup_id = m.id and p.user_id = target)
   limit 1;
  if ex is not null then
    update public.meetup_people set confirmed = true, confirmed_at = coalesce(confirmed_at, now())
     where meetup_id = ex and user_id = auth.uid();
    perform public.irl_finalize(ex);
    return jsonb_build_object('ok', true, 'meetup_id', ex, 'existing', true);
  end if;

  select l.last_at into last from public.pair_log l
    where l.family_id = fid and l.a = least(auth.uid(), target) and l.b = greatest(auth.uid(), target);
  if last is not null and last > now() - interval '24 hours' then
    return jsonb_build_object('error', 'cooldown',
      'message', 'You two already earned points together in the last 24 hours. Try again in about '
                 || ceil(extract(epoch from (last + interval '24 hours' - now())) / 3600)::int || ' hours.');
  end if;

  if (select count(*) from public.meetups where host_id = auth.uid() and created_at > now() - interval '1 hour') >= 12 then
    return jsonb_build_object('error', 'rate', 'message', 'You have started a lot of meetups. Try again in a while.');
  end if;

  insert into public.meetups (family_id, kind, host_id, status, expires_at)
  values (fid, 'pair', auth.uid(), 'pending', now() + interval '30 minutes')
  returning id into mid;
  insert into public.meetup_people (meetup_id, family_id, user_id, confirmed, confirmed_at)
  values (mid, fid, auth.uid(), true, now()), (mid, fid, target, false, null);
  return jsonb_build_object('ok', true, 'meetup_id', mid);
end;
$$;

-- 6. Confirm, decline ------------------------------------------------------------

drop function if exists public.irl_confirm(uuid);
create function public.irl_confirm(mid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select * into m from public.meetups where id = mid for update;
  if not found or not exists (select 1 from public.meetup_people where meetup_id = mid and user_id = auth.uid()) then
    return jsonb_build_object('error', 'missing', 'message', 'That meetup was not found.');
  end if;
  if m.status = 'verified' then
    return jsonb_build_object('ok', true, 'status', 'verified');
  end if;
  if m.status in ('pending', 'open', 'locked') and m.expires_at < now() then
    update public.meetups set status = 'expired', ended_at = now(), join_code = null where id = mid;
    return jsonb_build_object('error', 'expired', 'message', 'This meetup expired. Start it again.');
  end if;
  if m.status = 'open' then
    return jsonb_build_object('error', 'not_locked', 'message', 'The host has not locked the group yet.');
  end if;
  if m.status not in ('pending', 'locked') then
    return jsonb_build_object('error', 'closed', 'message', 'This meetup is no longer open.');
  end if;
  update public.meetup_people set confirmed = true, confirmed_at = coalesce(confirmed_at, now())
   where meetup_id = mid and user_id = auth.uid();
  perform public.irl_finalize(mid);
  return jsonb_build_object('ok', true, 'status', (select status from public.meetups where id = mid));
end;
$$;

drop function if exists public.irl_decline(uuid);
create function public.irl_decline(mid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  n int;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select * into m from public.meetups where id = mid for update;
  if not found or not exists (select 1 from public.meetup_people where meetup_id = mid and user_id = auth.uid()) then
    return jsonb_build_object('error', 'missing', 'message', 'That meetup was not found.');
  end if;
  if m.status not in ('pending', 'open', 'locked') then
    return jsonb_build_object('ok', true);
  end if;
  if m.kind = 'pair' or m.host_id = auth.uid() then
    update public.meetups set status = 'cancelled', ended_at = now(), join_code = null where id = mid;
    return jsonb_build_object('ok', true);
  end if;
  delete from public.meetup_people where meetup_id = mid and user_id = auth.uid();
  select count(*) into n from public.meetup_people where meetup_id = mid;
  if m.status = 'locked' and n < 3 then
    update public.meetups set status = 'cancelled', ended_at = now() where id = mid;
  else
    perform public.irl_finalize(mid);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 7. Group meetups ---------------------------------------------------------------

drop function if exists public.irl_start_group(uuid, text);
create function public.irl_start_group(fid uuid, title_in text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gate jsonb;
  mid uuid;
  t text := nullif(trim(coalesce(title_in, '')), '');
begin
  gate := public.irl_gate(fid);
  if gate is not null then return gate; end if;
  if t is not null and length(t) > 60 then
    return jsonb_build_object('error', 'title', 'message', 'Keep the name under 60 characters.');
  end if;
  if exists (
    select 1 from public.meetups
    where family_id = fid and kind = 'group' and host_id = auth.uid() and status in ('open', 'locked')
  ) then
    return jsonb_build_object('error', 'busy', 'message', 'You already have a group meetup in progress. Finish or cancel it first.');
  end if;
  if (select count(*) from public.meetups where host_id = auth.uid() and created_at > now() - interval '1 hour') >= 12 then
    return jsonb_build_object('error', 'rate', 'message', 'You have started a lot of meetups. Try again in a while.');
  end if;
  insert into public.meetups (family_id, kind, host_id, title, join_code, status, expires_at)
  values (fid, 'group', auth.uid(), t, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), 'open',
          now() + interval '90 minutes')
  returning id into mid;
  insert into public.meetup_people (meetup_id, family_id, user_id, confirmed, confirmed_at)
  values (mid, fid, auth.uid(), true, now());
  return jsonb_build_object('ok', true, 'meetup_id', mid);
end;
$$;

create or replace function public.irl_group_by_payload(fid uuid, payload text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  parts text[] := string_to_array(upper(trim(coalesce(payload, ''))), '.');
  mid uuid;
begin
  if array_length(parts, 1) is distinct from 2 or parts[1] <> 'CZN1G' then
    return null;
  end if;
  select id into mid from public.meetups
   where family_id = fid and kind = 'group' and status = 'open' and expires_at > now() and join_code = parts[2];
  return mid;
end;
$$;

drop function if exists public.irl_group_preview(uuid, text);
create function public.irl_group_preview(fid uuid, payload text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gate jsonb;
  mid uuid;
  m record;
begin
  gate := public.irl_gate(fid);
  if gate is not null then return gate; end if;
  mid := public.irl_group_by_payload(fid, payload);
  if mid is null then return public.irl_bad_code(); end if;
  select * into m from public.meetups where id = mid;
  return jsonb_build_object(
    'ok', true,
    'meetup_id', mid,
    'title', m.title,
    'host', (select display_name from public.profiles where id = m.host_id),
    'people', (select count(*) from public.meetup_people where meetup_id = mid),
    'already_in', exists (select 1 from public.meetup_people where meetup_id = mid and user_id = auth.uid())
  );
end;
$$;

drop function if exists public.irl_join_group(uuid, text);
create function public.irl_join_group(fid uuid, payload text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gate jsonb;
  mid uuid;
begin
  gate := public.irl_gate(fid);
  if gate is not null then return gate; end if;
  mid := public.irl_group_by_payload(fid, payload);
  if mid is null then return public.irl_bad_code(); end if;
  perform 1 from public.meetups where id = mid for update;
  if exists (select 1 from public.meetup_people where meetup_id = mid and user_id = auth.uid()) then
    return jsonb_build_object('ok', true, 'meetup_id', mid, 'existing', true);
  end if;
  if (select count(*) from public.meetup_people where meetup_id = mid) >= 12 then
    return jsonb_build_object('error', 'full', 'message', 'This group already has 12 cousins.');
  end if;
  insert into public.meetup_people (meetup_id, family_id, user_id, confirmed) values (mid, fid, auth.uid(), false);
  return jsonb_build_object('ok', true, 'meetup_id', mid);
end;
$$;

drop function if exists public.irl_remove_person(uuid, uuid);
create function public.irl_remove_person(mid uuid, uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  n int;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select * into m from public.meetups where id = mid for update;
  if not found or m.kind <> 'group' or m.host_id is distinct from auth.uid() then
    return jsonb_build_object('error', 'host', 'message', 'Only the host can do that.');
  end if;
  if uid = auth.uid() then
    return jsonb_build_object('error', 'self', 'message', 'The host cannot be removed. Cancel the meetup instead.');
  end if;
  if m.status not in ('open', 'locked') then
    return jsonb_build_object('error', 'closed', 'message', 'This meetup is no longer open.');
  end if;
  delete from public.meetup_people where meetup_id = mid and user_id = uid;
  select count(*) into n from public.meetup_people where meetup_id = mid;
  if m.status = 'locked' and n < 3 then
    update public.meetups set status = 'cancelled', ended_at = now() where id = mid;
  elsif m.status = 'locked' then
    perform public.irl_finalize(mid);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

drop function if exists public.irl_lock_group(uuid);
create function public.irl_lock_group(mid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select * into m from public.meetups where id = mid for update;
  if not found or m.kind <> 'group' or m.host_id is distinct from auth.uid() then
    return jsonb_build_object('error', 'host', 'message', 'Only the host can do that.');
  end if;
  if m.status <> 'open' or m.expires_at < now() then
    return jsonb_build_object('error', 'closed', 'message', 'This meetup is no longer open.');
  end if;
  if (select count(*) from public.meetup_people where meetup_id = mid) < 3 then
    return jsonb_build_object('error', 'small', 'message', 'A group meetup needs at least 3 cousins. For two, scan each other.');
  end if;
  update public.meetups
     set status = 'locked', join_code = null, expires_at = greatest(expires_at, now() + interval '30 minutes')
   where id = mid;
  return jsonb_build_object('ok', true);
end;
$$;

-- The host can finish without anyone who has not confirmed (at least 3 must have).
drop function if exists public.irl_finish_group(uuid);
create function public.irl_finish_group(mid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  n int;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select * into m from public.meetups where id = mid for update;
  if not found or m.kind <> 'group' or m.host_id is distinct from auth.uid() then
    return jsonb_build_object('error', 'host', 'message', 'Only the host can do that.');
  end if;
  if m.status <> 'locked' then
    return jsonb_build_object('error', 'closed', 'message', 'Lock the group first.');
  end if;
  select count(*) into n from public.meetup_people where meetup_id = mid and confirmed;
  if n < 3 then
    return jsonb_build_object('error', 'small', 'message', 'At least 3 cousins need to confirm. Wait for more, or cancel.');
  end if;
  delete from public.meetup_people where meetup_id = mid and not confirmed;
  perform public.irl_finalize(mid);
  return jsonb_build_object('ok', true);
end;
$$;

-- 8. Reading: my meetups, the scoreboard, recent meetups -----------------------------

drop function if exists public.irl_mine(uuid);
create function public.irl_mine(fid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.is_family_member(fid) then
    raise exception 'You are not in that family';
  end if;
  perform public.irl_expire(fid);
  return coalesce((
    select jsonb_agg(t.row order by t.created_at desc)
    from (
      select m.created_at,
        jsonb_build_object(
          'id', m.id, 'kind', m.kind, 'title', m.title, 'status', m.status, 'host_id', m.host_id,
          'expires_at', m.expires_at, 'ended_at', m.ended_at, 'points_each', m.points_each,
          'join_code', case when m.status = 'open' and m.host_id = auth.uid() then m.join_code end,
          'my_points', (select l.points from public.point_ledger l where l.meetup_id = m.id and l.user_id = auth.uid()),
          'people', (
            select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', pr.display_name, 'confirmed', p.confirmed)
                             order by p.joined_at)
            from public.meetup_people p join public.profiles pr on pr.id = p.user_id
            where p.meetup_id = m.id
          )
        ) as row
      from public.meetups m
      where m.family_id = fid
        and exists (select 1 from public.meetup_people me where me.meetup_id = m.id and me.user_id = auth.uid())
        and (m.status in ('pending', 'open', 'locked')
             or (m.status in ('verified', 'cancelled', 'expired') and m.ended_at > now() - interval '10 minutes'))
    ) t
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.irl_scoreboard(uuid);
create function public.irl_scoreboard(fid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.is_family_member(fid) then
    raise exception 'You are not in that family';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(s) order by s.points desc, s.meetups desc, s.name)
    from (
      select fm.user_id,
        pr.display_name as name,
        coalesce((select sum(l.points) from public.point_ledger l where l.family_id = fid and l.user_id = fm.user_id), 0)::int as points,
        (select count(*) from public.meetup_people p join public.meetups m on m.id = p.meetup_id
          where p.user_id = fm.user_id and m.family_id = fid and m.status = 'verified')::int as meetups,
        (select count(distinct q.user_id) from public.meetup_people p
           join public.meetups m on m.id = p.meetup_id and m.family_id = fid and m.status = 'verified'
           join public.meetup_people q on q.meetup_id = m.id and q.user_id <> p.user_id
          where p.user_id = fm.user_id)::int as cousins_met,
        coalesce((select max(c.n) from (
           select (select count(*) from public.meetup_people z where z.meetup_id = m.id) as n
           from public.meetup_people p join public.meetups m on m.id = p.meetup_id
           where p.user_id = fm.user_id and m.family_id = fid and m.status = 'verified' and m.kind = 'group'
        ) c), 0)::int as biggest_group,
        exists (
          select 1 from public.meetups m
          where m.family_id = fid and m.status = 'verified' and m.kind = 'group' and m.host_id = fm.user_id
            and (select count(*) from public.meetup_people z where z.meetup_id = m.id) >= 4
        ) as hosted_big,
        (select max(m.ended_at) from public.meetup_people p join public.meetups m on m.id = p.meetup_id
          where p.user_id = fm.user_id and m.family_id = fid and m.status = 'verified') as last_at
      from public.family_members fm
      join public.profiles pr on pr.id = fm.user_id
      where fm.family_id = fid
    ) s
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.irl_recent(uuid, int);
create function public.irl_recent(fid uuid, lim int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.is_family_member(fid) then
    raise exception 'You are not in that family';
  end if;
  return coalesce((
    select jsonb_agg(t.row order by t.ended_at desc)
    from (
      select m.ended_at,
        jsonb_build_object(
          'id', m.id, 'kind', m.kind, 'title', m.title, 'verified_at', m.ended_at, 'points_each', m.points_each,
          'people', (
            select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', pr.display_name, 'points', coalesce(l.points, 0))
                             order by pr.display_name)
            from public.meetup_people p
            join public.profiles pr on pr.id = p.user_id
            left join public.point_ledger l on l.meetup_id = m.id and l.user_id = p.user_id
            where p.meetup_id = m.id
          )
        ) as row
      from public.meetups m
      where m.family_id = fid and m.status = 'verified'
      order by m.ended_at desc
      limit least(greatest(coalesce(lim, 20), 1), 50)
    ) t
  ), '[]'::jsonb);
end;
$$;

-- 9. Who may call what ---------------------------------------------------------------

revoke execute on function
  public.irl_code_for(text, bigint), public.irl_resolve(uuid, text), public.irl_expire(uuid),
  public.irl_gate(uuid), public.irl_bad_code(), public.irl_finalize(uuid), public.irl_group_by_payload(uuid, text)
  from public, anon, authenticated;

revoke execute on function
  public.irl_my_code(uuid), public.irl_lookup(uuid, text), public.irl_start_pair(uuid, text),
  public.irl_confirm(uuid), public.irl_decline(uuid), public.irl_start_group(uuid, text),
  public.irl_group_preview(uuid, text), public.irl_join_group(uuid, text),
  public.irl_remove_person(uuid, uuid), public.irl_lock_group(uuid), public.irl_finish_group(uuid),
  public.irl_mine(uuid), public.irl_scoreboard(uuid), public.irl_recent(uuid, int)
  from public, anon;

grant execute on function
  public.irl_my_code(uuid), public.irl_lookup(uuid, text), public.irl_start_pair(uuid, text),
  public.irl_confirm(uuid), public.irl_decline(uuid), public.irl_start_group(uuid, text),
  public.irl_group_preview(uuid, text), public.irl_join_group(uuid, text),
  public.irl_remove_person(uuid, uuid), public.irl_lock_group(uuid), public.irl_finish_group(uuid),
  public.irl_mine(uuid), public.irl_scoreboard(uuid), public.irl_recent(uuid, int)
  to authenticated;
