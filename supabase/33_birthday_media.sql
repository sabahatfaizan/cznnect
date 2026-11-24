-- Shared photo and video used by Cznnect birthday emails. Run once in Supabase SQL Editor.
create table if not exists public.birthday_media (
  id int primary key default 1 check (id = 1),
  image_url text not null default '',
  video_url text not null default '',
  poster_url text not null default '',
  caption text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.birthday_media enable row level security;

drop policy if exists "Owner manages birthday media" on public.birthday_media;
create policy "Owner manages birthday media" on public.birthday_media
  for all to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com');
grant select, insert, update, delete on public.birthday_media to authenticated;

-- Public read is needed for email clients; only the app owner can upload, update or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('birthday-media', 'birthday-media', true, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = true, file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'];

drop policy if exists "Public can view birthday media" on storage.objects;
create policy "Public can view birthday media" on storage.objects
  for select using (bucket_id = 'birthday-media');

drop policy if exists "Owner uploads birthday media" on storage.objects;
create policy "Owner uploads birthday media" on storage.objects
  for insert to authenticated with check (bucket_id = 'birthday-media' and lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com');

drop policy if exists "Owner updates birthday media" on storage.objects;
create policy "Owner updates birthday media" on storage.objects
  for update to authenticated using (bucket_id = 'birthday-media' and lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com')
  with check (bucket_id = 'birthday-media' and lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com');

drop policy if exists "Owner deletes birthday media" on storage.objects;
create policy "Owner deletes birthday media" on storage.objects
  for delete to authenticated using (bucket_id = 'birthday-media' and lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com');
