-- Admin > All users > Download list: every account with its details, for the owner to save as a spreadsheet (CSV).
-- Owner only (checked against the owner's email). Includes private contact details, so it stays owner only.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- Needs 08_profile.sql, 25_cofounder_title.sql, 30_cznnect_plus.sql and 34_birthday_at_signup.sql to have been run.
create or replace function public.admin_users_export()
returns table (
  user_id uuid,
  display_name text,
  nickname text,
  title text,
  bio text,
  email text,
  phone text,
  contact_email text,
  shares_contact boolean,
  birthday date,
  plus boolean,
  families text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'faizanplayz11@gmail.com' then
    raise exception 'Only the app owner can download the user list';
  end if;
  return query
    select
      p.id,
      p.display_name,
      p.nickname,
      p.title,
      p.bio,
      u.email::text,
      c.phone,
      c.contact_email,
      coalesce(c.share_contact, false),
      p.birthday,
      exists (select 1 from public.plus_members pm where pm.user_id = p.id),
      -- Each family with the person's role in it, e.g. "Khan family (owner), Cousins (member)".
      (select string_agg(f.name || ' (' || m.role || ')', ', ' order by f.name)
         from public.family_members m
         join public.families f on f.id = m.family_id
        where m.user_id = p.id),
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at is not null
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.profile_contacts c on c.user_id = p.id
    order by u.created_at;
end;
$$;

revoke execute on function public.admin_users_export() from public, anon;
grant execute on function public.admin_users_export() to authenticated;
