-- The last few family-wide messages, for the "Recent" list in Message everyone. Paste into Supabase > SQL Editor, then Run.
-- Run it after 15_push_broadcasts.sql. Safe to run again.
create or replace function public.recent_broadcasts(fid uuid)
returns table (sender text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim(p.nickname), ''), p.display_name, 'Someone') as sender, b.body, b.created_at
  from public.push_broadcasts b
  left join public.profiles p on p.id = b.user_id
  where b.family_id = fid and public.is_family_member(fid)
  order by b.created_at desc
  limit 10;
$$;

revoke execute on function public.recent_broadcasts(uuid) from public, anon;
grant execute on function public.recent_broadcasts(uuid) to authenticated;
