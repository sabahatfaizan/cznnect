-- Cznnect: moderators. Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- Run it after 02_member_management.sql.
--
-- What it adds:
--   a third family role, "moderator", next to "owner" and "member"
--   set_member_role   the owner makes someone a moderator, or a regular member again
--   remove_member     now also usable by moderators, but only on regular members

alter table public.family_members drop constraint if exists family_members_role_check;
alter table public.family_members
  add constraint family_members_role_check check (role in ('owner', 'moderator', 'member'));

create or replace function public.is_family_staff(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid and user_id = auth.uid() and role in ('owner', 'moderator')
  );
$$;

create or replace function public.set_member_role(fid uuid, target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.is_family_owner(fid) then
    raise exception 'Only the owner can change roles';
  end if;
  if new_role not in ('moderator', 'member') then
    raise exception 'A role can only be moderator or member';
  end if;
  if exists (
    select 1 from public.family_members
    where family_id = fid and user_id = target and role = 'owner'
  ) then
    raise exception 'The owner''s role cannot be changed';
  end if;

  update public.family_members set role = new_role
  where family_id = fid and user_id = target;
  if not found then
    raise exception 'That person is not in this family';
  end if;
end;
$$;

-- The owner can remove anyone except themselves; a moderator can remove regular members only.
create or replace function public.remove_member(fid uuid, target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.is_family_staff(fid) then
    raise exception 'Only the owner or a moderator can remove people';
  end if;

  select role into target_role from public.family_members where family_id = fid and user_id = target;
  if target_role is null then
    raise exception 'That person is not in this family';
  end if;
  if target_role = 'owner' then
    raise exception 'The owner cannot be removed';
  end if;
  if target_role = 'moderator' and not public.is_family_owner(fid) then
    raise exception 'Only the owner can remove a moderator';
  end if;

  delete from public.family_members where family_id = fid and user_id = target;
end;
$$;

revoke execute on function public.is_family_staff(uuid) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.is_family_staff(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
