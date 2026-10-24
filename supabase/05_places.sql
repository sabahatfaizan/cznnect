-- Cznnect, stage 3: places, the map and the restaurant guide.
-- Run this after 01 to 04. Paste it into Supabase > SQL Editor > New query, then Run.
-- Safe to run again.
--
-- Who can do what:
--   every member of the family   see all places, add places, edit places, rate places
--   the person who added a place   remove it
--   the family owner   remove any place
--   each member rates a place once (1 to 5 stars, optional comment) and can change or remove their own rating
-- A "place" is anywhere the family has been or wants to go. A "restaurant" is a place with a cuisine.

-- 1. Tables ---------------------------------------------------------------------

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null default 'place' check (kind in ('place', 'restaurant')),
  cuisine text check (cuisine is null or length(cuisine) <= 40),
  status text not null default 'been' check (status in ('been', 'want')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  address text check (address is null or length(address) <= 200),
  notes text check (notes is null or length(notes) <= 1000),
  visited_on date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

-- The same name at (about) the same spot cannot be added twice. 3 decimals is roughly 100 metres.
create unique index if not exists places_no_duplicates
  on public.places (family_id, lower(trim(name)), round(lat::numeric, 3), round(lng::numeric, 3));

create index if not exists places_by_family on public.places (family_id);

create table if not exists public.place_ratings (
  place_id uuid not null,
  family_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or length(comment) <= 500),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id),
  foreign key (place_id, family_id) references public.places (id, family_id) on delete cascade
);

-- 2. Privacy rules --------------------------------------------------------------

alter table public.places enable row level security;
alter table public.place_ratings enable row level security;

drop policy if exists "members see places" on public.places;
create policy "members see places" on public.places
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members add places" on public.places;
create policy "members add places" on public.places
  for insert to authenticated
  with check (public.is_family_member(family_id));

drop policy if exists "members edit places" on public.places;
create policy "members edit places" on public.places
  for update to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists "creator or owner removes places" on public.places;
create policy "creator or owner removes places" on public.places
  for delete to authenticated
  using (
    public.is_family_member(family_id)
    and (created_by = auth.uid() or public.is_family_owner(family_id))
  );

drop policy if exists "members see ratings" on public.place_ratings;
create policy "members see ratings" on public.place_ratings
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members remove own rating" on public.place_ratings;
create policy "members remove own rating" on public.place_ratings
  for delete to authenticated
  using (user_id = auth.uid() and public.is_family_member(family_id));

-- Only these columns can be written directly. Nobody can change who added a place.
revoke all on public.places from anon;
revoke all on public.place_ratings from anon;
revoke insert, update on public.places from authenticated;
revoke insert, update, delete on public.place_ratings from authenticated;
grant select, delete on public.places to authenticated;
grant select on public.place_ratings to authenticated;
grant delete on public.place_ratings to authenticated;
grant insert (family_id, name, kind, cuisine, status, lat, lng, address, notes, visited_on)
  on public.places to authenticated;
grant update (name, kind, cuisine, status, lat, lng, address, notes, visited_on)
  on public.places to authenticated;

-- 3. Rating (add or change your own, in one call) -------------------------------

drop function if exists public.rate_place(uuid, int, text);
create function public.rate_place(pid uuid, stars_in int, comment_in text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select family_id into fid from public.places where id = pid;
  if fid is null or not public.is_family_member(fid) then
    raise exception 'That place was not found';
  end if;
  if stars_in is null or stars_in < 1 or stars_in > 5 then
    raise exception 'Choose 1 to 5 stars';
  end if;
  if length(coalesce(comment_in, '')) > 500 then
    raise exception 'That comment is too long (500 characters at most)';
  end if;

  insert into public.place_ratings (place_id, family_id, user_id, stars, comment)
  values (pid, fid, auth.uid(), stars_in, nullif(trim(coalesce(comment_in, '')), ''))
  on conflict (place_id, user_id)
  do update set stars = excluded.stars, comment = excluded.comment, updated_at = now();
end;
$$;

revoke execute on function public.rate_place(uuid, int, text) from public, anon;
grant execute on function public.rate_place(uuid, int, text) to authenticated;
