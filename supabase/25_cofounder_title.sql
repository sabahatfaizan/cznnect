-- A title shown next to a person's name (for example "Co-founder"). Only the app owner can set one.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again. Needs 08_profile.sql and 24_admin_all_users.sql.
alter table public.profiles add column if not exists title text;
alter table public.profiles drop constraint if exists profiles_title_len;
alter table public.profiles add constraint profiles_title_len check (title is null or char_length(title) <= 24);

-- Nobody can give themselves a title: only the owner's account (or this SQL editor) can change it.
create or replace function public.guard_profile_title()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.title := null;
    if exists (select 1 from auth.users u where u.id = new.id and lower(u.email) = 'ahmednoorsahir133@gmail.com') then
      new.title := 'Co-founder';
    end if;
  elsif new.title is distinct from old.title
        and auth.uid() is not null
        and lower(coalesce(auth.jwt() ->> 'email', '')) <> 'faizanplayz11@gmail.com' then
    new.title := old.title;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_title on public.profiles;
create trigger guard_profile_title before insert or update on public.profiles
  for each row execute function public.guard_profile_title();

-- The co-founder title, for his account if it already exists (and automatically when it is created).
update public.profiles
  set title = 'Co-founder'
  where id in (select id from auth.users where lower(email) = 'ahmednoorsahir133@gmail.com');

-- Admin > Users now also shows the title.
drop function if exists public.admin_all_users();
create or replace function public.admin_all_users()
returns table (
  user_id uuid,
  display_name text,
  nickname text,
  avatar text,
  title text,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  families text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'faizanplayz11@gmail.com' then
    raise exception 'Only the app owner can see all users';
  end if;
  return query
    select p.id, p.display_name, p.nickname, p.avatar, p.title, u.email::text, u.created_at, u.last_sign_in_at,
      (select string_agg(f.name, ', ' order by f.name)
         from public.family_members m join public.families f on f.id = m.family_id
        where m.user_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at;
end;
$$;
revoke execute on function public.admin_all_users() from public, anon;
grant execute on function public.admin_all_users() to authenticated;
