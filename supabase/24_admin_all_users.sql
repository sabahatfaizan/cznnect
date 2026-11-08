-- Admin > Users: every account in the app, not only the family. Owner only (checked against the owner's email).
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again. Needs 08_profile.sql to have been run.
create or replace function public.admin_all_users()
returns table (
  user_id uuid,
  display_name text,
  nickname text,
  avatar text,
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
    select
      p.id,
      p.display_name,
      p.nickname,
      p.avatar,
      u.email::text,
      u.created_at,
      u.last_sign_in_at,
      (select string_agg(f.name, ', ' order by f.name)
         from public.family_members m
         join public.families f on f.id = m.family_id
        where m.user_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at;
end;
$$;

revoke execute on function public.admin_all_users() from public, anon;
grant execute on function public.admin_all_users() to authenticated;
