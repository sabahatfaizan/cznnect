-- Owner-only reset for Convoy / IRL meetup data.
-- Run in Supabase SQL Editor after supabase/07_irl.sql.
-- The owner account check is the real access control; the PIN is an extra confirmation gate.

create or replace function public.admin_clear_meetup_data(fid uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  meetups_n int;
  ledger_n int;
  cooldown_n int;
begin
  if auth.uid() is null or not public.is_family_owner(fid) then
    raise exception 'Only the family owner can clear meetup data';
  end if;

  if encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex')
     <> 'c5f9eb390a108b4859979e6b4356f30d03f48d8d836596fc8b09ab8307ef03f0' then
    raise exception 'Incorrect confirmation code';
  end if;

  select count(*)::int into meetups_n
  from public.meetups where family_id = fid;

  select count(*)::int into ledger_n
  from public.point_ledger where family_id = fid;

  select count(*)::int into cooldown_n
  from public.pair_log where family_id = fid;

  -- meetup_people and point_ledger are deleted by the meetups foreign-key cascade.
  delete from public.meetups where family_id = fid;
  delete from public.pair_log where family_id = fid;

  return jsonb_build_object(
    'meetups_deleted', meetups_n,
    'point_records_deleted', ledger_n,
    'pair_cooldowns_deleted', cooldown_n
  );
end;
$$;

revoke all on function public.admin_clear_meetup_data(uuid, text) from public, anon;
grant execute on function public.admin_clear_meetup_data(uuid, text) to authenticated;
