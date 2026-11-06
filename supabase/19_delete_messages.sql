-- Cznnect: the family owner can delete chat messages. Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- Run it after 15_push_broadcasts.sql.
create or replace function public.delete_family_message(mid bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select family_id into fid from public.push_broadcasts where id = mid;
  if fid is null then
    raise exception 'That message no longer exists';
  end if;
  if not public.is_family_owner(fid) then
    raise exception 'Only the family owner can delete messages';
  end if;
  delete from public.push_broadcasts where id = mid;
end;
$$;

revoke execute on function public.delete_family_message(bigint) from public, anon;
grant execute on function public.delete_family_message(bigint) to authenticated;
