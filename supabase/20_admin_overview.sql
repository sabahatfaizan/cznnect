-- Cznnect admin control panel: live counts for the Overview and a "clear all messages" control, owner only.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- Run it after 15_push_broadcasts.sql and 14_push_tokens.sql.
create or replace function public.admin_overview(fid uuid)
returns table (members_count int, devices_count int, messages_total int, messages_today int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_family_owner(fid) then
    raise exception 'Only the family owner can see this';
  end if;
  return query select
    (select count(*)::int from public.family_members m where m.family_id = fid),
    (select count(distinct t.token)::int from public.push_tokens t join public.family_members m on m.user_id = t.user_id where m.family_id = fid),
    (select count(*)::int from public.push_broadcasts b where b.family_id = fid),
    (select count(*)::int from public.push_broadcasts b where b.family_id = fid and b.created_at > now() - interval '24 hours');
end;
$$;

create or replace function public.clear_family_messages(fid uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null or not public.is_family_owner(fid) then
    raise exception 'Only the family owner can clear messages';
  end if;
  delete from public.push_broadcasts where family_id = fid;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.admin_overview(uuid) from public, anon;
revoke execute on function public.clear_family_messages(uuid) from public, anon;
grant execute on function public.admin_overview(uuid) to authenticated;
grant execute on function public.clear_family_messages(uuid) to authenticated;
