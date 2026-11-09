-- Gatherings: a planned event (title, date and time, place) that a family member adds in Convoy.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
create table if not exists public.gatherings (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  host_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 80),
  place      text check (place is null or char_length(place) <= 120),
  starts_at  timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists gatherings_family_idx on public.gatherings (family_id, starts_at);

alter table public.gatherings enable row level security;

drop policy if exists "family reads gatherings" on public.gatherings;
create policy "family reads gatherings" on public.gatherings
  for select to authenticated using (public.is_family_member(family_id));

drop policy if exists "member adds own gathering" on public.gatherings;
create policy "member adds own gathering" on public.gatherings
  for insert to authenticated with check (host_id = auth.uid() and public.is_family_member(family_id));

drop policy if exists "host removes own gathering" on public.gatherings;
create policy "host removes own gathering" on public.gatherings
  for delete to authenticated using (host_id = auth.uid());

grant select, insert, delete on public.gatherings to authenticated;
