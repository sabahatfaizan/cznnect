-- Family chat: the thread behind the Chat tab. Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- Run it after 15_push_broadcasts.sql. Replaces the small "recent messages" function from 16_push_history.sql.
drop function if exists public.recent_broadcasts(uuid);

create or replace function public.family_messages(fid uuid, lim int default 100)
returns table (id bigint, user_id uuid, sender text, avatar text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select b.id, b.user_id,
           coalesce(nullif(btrim(p.nickname), ''), p.display_name, 'Someone') as sender,
           p.avatar, b.body, b.created_at
    from public.push_broadcasts b
    left join public.profiles p on p.id = b.user_id
    where b.family_id = fid and public.is_family_member(fid)
    order by b.created_at desc, b.id desc
    limit greatest(1, least(coalesce(lim, 100), 200))
  ) latest
  order by created_at asc, id asc;
$$;

revoke execute on function public.family_messages(uuid, int) from public, anon;
grant execute on function public.family_messages(uuid, int) to authenticated;
