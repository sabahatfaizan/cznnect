-- Explore: "I've been here" for each cousin, and an optional photo album link on a place.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again. Needs 05_places.sql.

-- 1. An optional link to a shared photo album (Google Photos, Drive, iCloud...). Only https links.
alter table public.places add column if not exists album_url text;
alter table public.places drop constraint if exists places_album_url_ok;
alter table public.places add constraint places_album_url_ok
  check (album_url is null or (length(album_url) <= 300 and album_url ~* '^https://'));
grant insert (album_url) on public.places to authenticated;
grant update (album_url) on public.places to authenticated;

-- 2. Who has been to a place. One row per cousin per place.
create table if not exists public.place_visits (
  place_id uuid not null,
  family_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  visited_on date,
  created_at timestamptz not null default now(),
  primary key (place_id, user_id),
  foreign key (place_id, family_id) references public.places (id, family_id) on delete cascade
);

alter table public.place_visits enable row level security;

drop policy if exists "members see visits" on public.place_visits;
create policy "members see visits" on public.place_visits
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members remove own visit" on public.place_visits;
create policy "members remove own visit" on public.place_visits
  for delete to authenticated
  using (user_id = auth.uid() and public.is_family_member(family_id));

revoke all on public.place_visits from anon;
revoke insert, update, delete on public.place_visits from authenticated;
grant select, delete on public.place_visits to authenticated;

-- 3. Mark yourself as having been there (add or change your own, in one call).
drop function if exists public.mark_place_visited(uuid, date);
create function public.mark_place_visited(pid uuid, on_date date default null)
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
  insert into public.place_visits (place_id, family_id, user_id, visited_on)
  values (pid, fid, auth.uid(), on_date)
  on conflict (place_id, user_id) do update set visited_on = excluded.visited_on;
end;
$$;
revoke execute on function public.mark_place_visited(uuid, date) from public, anon;
grant execute on function public.mark_place_visited(uuid, date) to authenticated;
