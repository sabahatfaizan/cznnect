-- Cznnect in-app announcements. Run once in Supabase SQL Editor.
create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  image_url text not null default '',
  action_label text not null default '',
  action_url text not null default '',
  published boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_announcement_dismissals (
  announcement_id uuid not null references public.app_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.app_announcements enable row level security;
alter table public.app_announcement_dismissals enable row level security;

drop policy if exists "Users can view published announcements" on public.app_announcements;
create policy "Users can view published announcements" on public.app_announcements
  for select to authenticated
  using (published and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

drop policy if exists "Owner manages announcements" on public.app_announcements;
create policy "Owner manages announcements" on public.app_announcements
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com');

drop policy if exists "Users view own announcement dismissals" on public.app_announcement_dismissals;
create policy "Users view own announcement dismissals" on public.app_announcement_dismissals
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users dismiss announcements for themselves" on public.app_announcement_dismissals;
create policy "Users dismiss announcements for themselves" on public.app_announcement_dismissals
  for insert to authenticated with check (user_id = auth.uid());

grant select, insert, update, delete on public.app_announcements to authenticated;
grant select, insert on public.app_announcement_dismissals to authenticated;

-- Public poster bucket; only the owner can upload, replace or delete poster files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcement-posters', 'announcement-posters', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view announcement posters" on storage.objects;
create policy "Public can view announcement posters" on storage.objects
  for select using (bucket_id = 'announcement-posters');

drop policy if exists "Owner uploads announcement posters" on storage.objects;
create policy "Owner uploads announcement posters" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'announcement-posters'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com'
  );

drop policy if exists "Owner updates announcement posters" on storage.objects;
create policy "Owner updates announcement posters" on storage.objects
  for update to authenticated using (
    bucket_id = 'announcement-posters'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com'
  ) with check (
    bucket_id = 'announcement-posters'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com'
  );

drop policy if exists "Owner deletes announcement posters" on storage.objects;
create policy "Owner deletes announcement posters" on storage.objects
  for delete to authenticated using (
    bucket_id = 'announcement-posters'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com'
  );
