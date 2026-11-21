-- Cznnect+ features that the server enforces: more families, and bigger guest lists for events you host.
-- Free: up to 3 families, and 50 guests per event. Cznnect+ (and the owner): up to 10 families, and 500 guests per event.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again. Run supabase/28_event_public_join.sql and 30_cznnect_plus.sql first.
-- To change a number, edit it below and run this again.

create or replace function public.family_limit() returns int
language sql stable security definer set search_path = public as $$
  select case when public.my_plus() then 10 else 3 end
$$;

-- The guest limit for one event depends on its host, not on whoever is joining.
create or replace function public.event_guest_cap(p_event uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when exists (
    select 1 from public.events e
    where e.id = p_event
      and (exists (select 1 from public.plus_members m where m.user_id = e.host_id)
           or exists (select 1 from auth.users u where u.id = e.host_id and lower(u.email) = 'faizanplayz11@gmail.com'))
  ) then 500 else 50 end
$$;

create or replace function public.create_family(family_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  lim int := public.family_limit();
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if trim(coalesce(family_name, '')) = '' then
    raise exception 'Give your family a name';
  end if;
  if (select count(*) from public.family_members where user_id = auth.uid()) >= lim then
    raise exception 'You can be in up to % families. Leave one first.', lim;
  end if;

  insert into public.families (name, created_by)
  values (trim(family_name), auth.uid())
  returning id into fid;

  insert into public.family_members (family_id, user_id, role)
  values (fid, auth.uid(), 'owner');

  return fid;
end;
$$;

create or replace function public.join_family(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  lim int := public.family_limit();
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;

  select id into fid from public.families
  where invite_code = lower(trim(code));

  if fid is null then
    raise exception 'That invite code does not match any family';
  end if;

  -- Already in it: nothing to add. Otherwise the limit applies.
  if not exists (select 1 from public.family_members where family_id = fid and user_id = auth.uid())
     and (select count(*) from public.family_members where user_id = auth.uid()) >= lim then
    raise exception 'You can be in up to % families. Leave one first.', lim;
  end if;

  insert into public.family_members (family_id, user_id)
  values (fid, auth.uid())
  on conflict do nothing;

  return fid;
end;
$$;

-- Joining an event with an account now respects the guest limit too.
create or replace function public.join_event(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.events; me text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into e from public.events where code = upper(trim(p_code));
  if not found then raise exception 'No event has that code'; end if;
  if not exists (select 1 from public.event_guests where event_id = e.id and user_id = auth.uid())
     and (select count(*) from public.event_guests where event_id = e.id) >= public.event_guest_cap(e.id) then
    raise exception 'This event is full';
  end if;
  select display_name into me from public.profiles where id = auth.uid();
  insert into public.event_guests (event_id, user_id, guest_name)
    values (e.id, auth.uid(), coalesce(me, ''))
    on conflict (event_id, user_id) where user_id is not null do nothing;
  return e.id;
end $$;

-- RSVP with no account: same as before, with the guest limit coming from the host.
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
  if (select count(*) from public.event_guests where event_id = e.id) >= public.event_guest_cap(e.id) then raise exception 'This event is full'; end if;
  insert into public.event_guests (event_id, user_id, guest_name, guest_phone, guest_email, guest_note)
    values (e.id, null, nm, ph, em, nt) returning id into g;
  return g;
end $$;

revoke execute on function public.family_limit() from public, anon;
grant execute on function public.family_limit() to authenticated;
revoke execute on function public.event_guest_cap(uuid) from public, anon, authenticated;
revoke execute on function public.create_family(text) from public, anon;
revoke execute on function public.join_family(text) from public, anon;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
grant execute on function public.join_event(text) to authenticated;
grant execute on function public.public_event_join(text, text, text, text, text) to anon, authenticated;
