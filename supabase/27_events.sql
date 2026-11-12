-- Events: anyone can host an event, guests join with a code or QR, the host checks them in at the door.
-- The app owner can see and manage every event. Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references auth.users (id) on delete cascade,
  host_name   text not null default '',
  title       text not null check (char_length(title) between 1 and 80),
  place       text check (place is null or char_length(place) <= 120),
  details     text check (details is null or char_length(details) <= 500),
  starts_at   timestamptz not null,
  code        text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  created_at  timestamptz not null default now()
);

create table if not exists public.event_guests (
  event_id       uuid not null references public.events (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  guest_name     text not null default '',
  joined_at      timestamptz not null default now(),
  checked_in_at  timestamptz,
  primary key (event_id, user_id)
);

create index if not exists events_host_idx on public.events (host_id, starts_at);
create index if not exists event_guests_user_idx on public.event_guests (user_id);

-- Who is the app owner (the supervisor), judged by the signed-in email.
create or replace function public.is_app_owner() returns boolean
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com' $$;

create or replace function public.is_event_host(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = eid and host_id = auth.uid())
$$;

create or replace function public.is_event_guest(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_guests where event_id = eid and user_id = auth.uid())
$$;

alter table public.events enable row level security;
alter table public.event_guests enable row level security;

drop policy if exists "see own, joined or all (owner) events" on public.events;
create policy "see own, joined or all (owner) events" on public.events
  for select to authenticated using (host_id = auth.uid() or public.is_event_guest(id) or public.is_app_owner());

drop policy if exists "host adds event" on public.events;
create policy "host adds event" on public.events
  for insert to authenticated with check (host_id = auth.uid());

drop policy if exists "host or owner edits event" on public.events;
create policy "host or owner edits event" on public.events
  for update to authenticated using (host_id = auth.uid() or public.is_app_owner())
  with check (host_id = auth.uid() or public.is_app_owner());

drop policy if exists "host or owner removes event" on public.events;
create policy "host or owner removes event" on public.events
  for delete to authenticated using (host_id = auth.uid() or public.is_app_owner());

drop policy if exists "see own, hosted or all (owner) guest rows" on public.event_guests;
create policy "see own, hosted or all (owner) guest rows" on public.event_guests
  for select to authenticated using (user_id = auth.uid() or public.is_event_host(event_id) or public.is_app_owner());

drop policy if exists "leave, or host/owner removes guest" on public.event_guests;
create policy "leave, or host/owner removes guest" on public.event_guests
  for delete to authenticated using (user_id = auth.uid() or public.is_event_host(event_id) or public.is_app_owner());

grant select, insert, update, delete on public.events to authenticated;
grant select, delete on public.event_guests to authenticated;

-- Join with the event code (typed, or read from the invite QR). Returns the event id.
create or replace function public.join_event(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.events; me text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into e from public.events where code = upper(trim(p_code));
  if not found then raise exception 'No event has that code'; end if;
  select display_name into me from public.profiles where id = auth.uid();
  insert into public.event_guests (event_id, user_id, guest_name)
    values (e.id, auth.uid(), coalesce(me, ''))
    on conflict (event_id, user_id) do nothing;
  return e.id;
end $$;

-- The host (or the owner) marks a guest as present. Pass present = false to undo it.
create or replace function public.check_in_guest(p_event uuid, p_user uuid, p_present boolean default true) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz;
begin
  if not (public.is_event_host(p_event) or public.is_app_owner()) then raise exception 'Only the host can check guests in'; end if;
  update public.event_guests set checked_in_at = case when p_present then coalesce(checked_in_at, now()) else null end
    where event_id = p_event and user_id = p_user returning checked_in_at into t;
  if not found then raise exception 'That person has not joined this event'; end if;
  return t;
end $$;

grant execute on function public.join_event(text) to authenticated;
grant execute on function public.check_in_guest(uuid, uuid, boolean) to authenticated;
