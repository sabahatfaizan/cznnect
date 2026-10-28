-- Cznnect: richer profiles (nickname, bio, in-app avatar) and private contact details.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.

-- 1. Public-to-family profile fields. Family members already see each other's profiles.
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar text;

alter table public.profiles drop constraint if exists profiles_nickname_len;
alter table public.profiles add constraint profiles_nickname_len check (nickname is null or char_length(nickname) <= 24);
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 140);
alter table public.profiles drop constraint if exists profiles_avatar_len;
alter table public.profiles add constraint profiles_avatar_len check (avatar is null or char_length(avatar) <= 16);

-- 2. Contact details live in their own table so the privacy switch is enforced by the
--    database, not just hidden in the app. Other family members can read a row only
--    while its owner has "share" switched on.
create table if not exists public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text check (phone is null or char_length(phone) <= 30),
  contact_email text check (contact_email is null or char_length(contact_email) <= 120),
  share_contact boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profile_contacts enable row level security;

drop policy if exists "see own or shared contact" on public.profile_contacts;
create policy "see own or shared contact" on public.profile_contacts
  for select to authenticated
  using (user_id = auth.uid() or (share_contact and public.shares_family_with(user_id)));

drop policy if exists "add own contact" on public.profile_contacts;
create policy "add own contact" on public.profile_contacts
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "edit own contact" on public.profile_contacts;
create policy "edit own contact" on public.profile_contacts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
