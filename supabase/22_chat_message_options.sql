-- Chat message options on long press: edit (your own, for 15 minutes), delete for me, delete for everyone
-- (the sender or the family owner). Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
-- Run it after 15_push_broadcasts.sql, 17_family_chat.sql and 19_delete_messages.sql.
alter table public.push_broadcasts add column if not exists edited_at timestamptz;

-- "Delete for me" hides a message for one person only; everyone else still sees it.
create table if not exists public.message_hides (
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id bigint not null references public.push_broadcasts (id) on delete cascade,
  primary key (user_id, message_id)
);
alter table public.message_hides enable row level security;
revoke all on public.message_hides from anon, authenticated;

drop function if exists public.family_messages(uuid, int);
create function public.family_messages(fid uuid, lim int default 100)
returns table (id bigint, user_id uuid, sender text, avatar text, body text, created_at timestamptz, edited_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select b.id, b.user_id,
           coalesce(nullif(btrim(p.nickname), ''), p.display_name, 'Someone') as sender,
           p.avatar, b.body, b.created_at, b.edited_at
    from public.push_broadcasts b
    left join public.profiles p on p.id = b.user_id
    where b.family_id = fid and public.is_family_member(fid)
      and not exists (select 1 from public.message_hides h where h.message_id = b.id and h.user_id = auth.uid())
    order by b.created_at desc, b.id desc
    limit greatest(1, least(coalesce(lim, 100), 200))
  ) latest
  order by created_at asc, id asc;
$$;
revoke execute on function public.family_messages(uuid, int) from public, anon;
grant execute on function public.family_messages(uuid, int) to authenticated;

create or replace function public.edit_family_message(mid bigint, new_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.push_broadcasts%rowtype;
  clean text := btrim(coalesce(new_body, ''));
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if clean = '' or length(clean) > 200 then
    raise exception 'A message must be 1 to 200 characters';
  end if;
  select * into r from public.push_broadcasts where id = mid;
  if not found then
    raise exception 'That message no longer exists';
  end if;
  if r.user_id <> auth.uid() then
    raise exception 'You can only edit your own messages';
  end if;
  if r.created_at < now() - interval '15 minutes' then
    raise exception 'Messages can only be edited for 15 minutes';
  end if;
  update public.push_broadcasts set body = clean, edited_at = now() where id = mid;
end;
$$;

create or replace function public.hide_family_message(mid bigint)
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
    return;
  end if;
  if not public.is_family_member(fid) then
    raise exception 'You are not in this family';
  end if;
  insert into public.message_hides (user_id, message_id) values (auth.uid(), mid) on conflict do nothing;
end;
$$;

-- Delete for everyone: the sender can remove their own message, and the family owner can remove any.
create or replace function public.delete_family_message(mid bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  author uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select family_id, user_id into fid, author from public.push_broadcasts where id = mid;
  if fid is null then
    raise exception 'That message no longer exists';
  end if;
  if author <> auth.uid() and not public.is_family_owner(fid) then
    raise exception 'Only the sender or the family owner can delete this message';
  end if;
  delete from public.push_broadcasts where id = mid;
end;
$$;

revoke execute on function public.edit_family_message(bigint, text) from public, anon;
revoke execute on function public.hide_family_message(bigint) from public, anon;
revoke execute on function public.delete_family_message(bigint) from public, anon;
grant execute on function public.edit_family_message(bigint, text) to authenticated;
grant execute on function public.hide_family_message(bigint) to authenticated;
grant execute on function public.delete_family_message(bigint) to authenticated;
