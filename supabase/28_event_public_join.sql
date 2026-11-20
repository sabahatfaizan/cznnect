-- Events: anyone can RSVP from a normal QR code (phone camera, Google Lens) with no account and no app.
-- The invite QR is now a web link; the page it opens asks for a name and a phone or email (only if they have no account).
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again. Run supabase/27_events.sql first.

-- Guests without an account: the row gets its own id, and user_id may be empty.
alter table public.event_guests add column if not exists id uuid not null default gen_random_uuid();
alter table public.event_guests add column if not exists guest_phone text check (guest_phone is null or char_length(guest_phone) <= 40);
alter table public.event_guests add column if not exists guest_email text check (guest_email is null or char_length(guest_email) <= 120);
alter table public.event_guests add column if not exists guest_note  text check (guest_note  is null or char_length(guest_note)  <= 300);

do $$
declare idnum smallint;
begin
  select attnum into idnum from pg_attribute where attrelid = 'public.event_guests'::regclass and attname = 'id';
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_guests'::regclass and contype = 'p' and conkey = array[idnum]) then
    alter table public.event_guests drop constraint if exists event_guests_pkey;
    alter table public.event_guests add constraint event_guests_pkey primary key (id);
  end if;
end $$;
alter table public.event_guests alter column user_id drop not null;
create unique index if not exists event_guests_event_user_uq on public.event_guests (event_id, user_id) where user_id is not null;

-- Joining with an account (same as before, written for the new table shape).
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
    on conflict (event_id, user_id) where user_id is not null do nothing;
  return e.id;
end $$;

-- What the public page may show about an event: the details a guest needs, never the guest list.
create or replace function public.public_event_info(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('title', title, 'place', place, 'details', details, 'starts_at', starts_at, 'host_name', host_name)
  from public.events where code = upper(btrim(p_code))
$$;

-- RSVP with no account. Returns the guest's own ticket id. The same phone or email on one event reuses the same ticket.
create or replace function public.public_event_join(p_code text, p_name text, p_phone text default null, p_email text default null, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  e public.events; g uuid;
  nm text := btrim(coalesce(p_name, ''));
  ph text := nullif(btrim(coalesce(p_phone, '')), '');
  em text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into e from public.events where code = upper(btrim(p_code));
  if not found then raise exception 'No event has that code'; end if;
  if char_length(nm) < 1 or char_length(nm) > 80 then raise exception 'Please enter your name'; end if;
  if ph is null and em is null then raise exception 'Add a phone number or an email so the host can reach you'; end if;
  if ph is not null and char_length(ph) > 40 then raise exception 'That phone number is too long'; end if;
  if em is not null and (char_length(em) > 120 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'That email does not look right'; end if;
  if nt is not null and char_length(nt) > 300 then raise exception 'That note is too long'; end if;
  select id into g from public.event_guests
    where event_id = e.id and user_id is null and ((ph is not null and guest_phone = ph) or (em is not null and lower(guest_email) = em)) limit 1;
  if g is not null then
    update public.event_guests set guest_name = nm, guest_phone = coalesce(ph, guest_phone), guest_email = coalesce(em, guest_email), guest_note = coalesce(nt, guest_note) where id = g;
    return g;
  end if;
  if (select count(*) from public.event_guests where event_id = e.id) >= 500 then raise exception 'This event is full'; end if;
  insert into public.event_guests (event_id, user_id, guest_name, guest_phone, guest_email, guest_note)
    values (e.id, null, nm, ph, em, nt) returning id into g;
  return g;
end $$;

-- A guest reopens their own ticket page from its link. The ticket id is long and random, so only they have it.
create or replace function public.public_event_ticket(p_guest uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('guest_name', g.guest_name, 'checked_in', g.checked_in_at is not null, 'title', e.title, 'place', e.place, 'starts_at', e.starts_at)
  from public.event_guests g join public.events e on e.id = g.event_id where g.id = p_guest
$$;

-- The host (or the owner) marks any guest present by the guest's row. Pass present = false to undo it.
create or replace function public.check_in_guest_row(p_guest uuid, p_present boolean default true) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare ev uuid; t timestamptz;
begin
  select event_id into ev from public.event_guests where id = p_guest;
  if not found then raise exception 'That person has not joined this event'; end if;
  if not (public.is_event_host(ev) or public.is_app_owner()) then raise exception 'Only the host can check guests in'; end if;
  update public.event_guests set checked_in_at = case when p_present then coalesce(checked_in_at, now()) else null end
    where id = p_guest returning checked_in_at into t;
  return t;
end $$;

grant execute on function public.public_event_info(text) to anon, authenticated;
grant execute on function public.public_event_join(text, text, text, text, text) to anon, authenticated;
grant execute on function public.public_event_ticket(uuid) to anon, authenticated;
grant execute on function public.join_event(text) to authenticated;
grant execute on function public.check_in_guest_row(uuid, boolean) to authenticated;
