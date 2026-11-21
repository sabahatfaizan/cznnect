-- Custom emails: the owner sends category-based emails to chosen people (Admin > Custom emails).
-- People can switch a category off for themselves (Settings > Emails); "important" cannot be switched off.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.

-- A row here means "this person does NOT want this category".
create table if not exists public.email_optouts (
  user_id  uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('updates', 'events', 'birthdays', 'plus')),
  primary key (user_id, category)
);
alter table public.email_optouts enable row level security;
drop policy if exists "email_optouts own" on public.email_optouts;
create policy "email_optouts own" on public.email_optouts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- What was sent, so the owner can see recent sends. Only the server (the send-custom-email function) writes here.
create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  sent_by     uuid not null references auth.users (id) on delete cascade,
  category    text not null,
  subject     text not null,
  sent        int not null default 0,
  skipped     int not null default 0,
  failed      int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.email_log enable row level security;
drop policy if exists "email_log owner reads" on public.email_log;
create policy "email_log owner reads" on public.email_log for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com');

-- Owner only: who has switched this category off, so the panel can show who would be skipped.
create or replace function public.admin_email_optouts(p_category text) returns setof uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'faizanplayz11@gmail.com' then raise exception 'Only the app owner can do this'; end if;
  return query select user_id from public.email_optouts where category = p_category;
end $$;
revoke execute on function public.admin_email_optouts(text) from public, anon;
grant execute on function public.admin_email_optouts(text) to authenticated;
