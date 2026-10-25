-- Cznnect global maintenance controls. Run in Supabase SQL Editor.
create table if not exists public.app_settings (
  id integer primary key check (id = 1),
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'We’re improving Cznnect. Please check back soon.',
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
drop policy if exists "Anyone can read app maintenance status" on public.app_settings;
create policy "Anyone can read app maintenance status" on public.app_settings
  for select to anon, authenticated using (true);
drop policy if exists "Only Cznnect owner can update maintenance" on public.app_settings;
create policy "Only Cznnect owner can update maintenance" on public.app_settings
  for update to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com');
revoke insert, delete on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;
grant update (maintenance_enabled, maintenance_message, updated_at) on public.app_settings to authenticated;
