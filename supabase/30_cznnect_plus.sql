-- Cznnect+: the paid tier. For now it unlocks the coloured app icons. Who has it is kept here, and only the owner can change it
-- (from Admin > All users). Nothing in the app lets a person give themselves Cznnect+.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
create table if not exists public.plus_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  since timestamptz not null default now()
);
alter table public.plus_members enable row level security;
drop policy if exists "plus_members read own" on public.plus_members;
create policy "plus_members read own" on public.plus_members for select to authenticated using (user_id = auth.uid());
-- No insert, update or delete policy: only the functions below change this table.

-- Does the signed-in person have Cznnect+? The owner always does.
create or replace function public.my_plus() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com'
      or exists (select 1 from public.plus_members where user_id = auth.uid())
$$;

-- Owner only: who has Cznnect+, and give or take it away.
create or replace function public.admin_plus_members() returns setof uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'faizanplayz11@gmail.com' then raise exception 'Only the app owner can do this'; end if;
  return query select user_id from public.plus_members;
end $$;

create or replace function public.admin_set_plus(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'faizanplayz11@gmail.com' then raise exception 'Only the app owner can do this'; end if;
  if p_on then insert into public.plus_members (user_id) values (p_user) on conflict do nothing;
  else delete from public.plus_members where user_id = p_user; end if;
end $$;

revoke execute on function public.my_plus() from public, anon;
revoke execute on function public.admin_plus_members() from public, anon;
revoke execute on function public.admin_set_plus(uuid, boolean) from public, anon;
grant execute on function public.my_plus() to authenticated;
grant execute on function public.admin_plus_members() to authenticated;
grant execute on function public.admin_set_plus(uuid, boolean) to authenticated;
