-- Refresh button for the Convoy code: makes a brand new code right now. The old code stops working at once.
-- (The code still also changes by itself every 5 minutes.) Run this once in the Supabase SQL Editor.
create or replace function public.irl_refresh_code(fid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  s record;
  w bigint := floor(extract(epoch from now()) / 300)::bigint;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.is_family_member(fid) then
    raise exception 'You are not in that family';
  end if;
  -- Make sure this person has a code at all, then give it a new secret.
  perform public.irl_my_code(fid);
  update public.irl_secrets
    set secret = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    where user_id = auth.uid()
    returning * into s;
  return jsonb_build_object(
    'handle', s.handle,
    'code', public.irl_code_for(s.secret, w),
    'seconds_left', 300 - (floor(extract(epoch from now()))::bigint % 300)
  );
end;
$fn$;

revoke execute on function public.irl_refresh_code(uuid) from public, anon;
grant  execute on function public.irl_refresh_code(uuid) to authenticated;
