-- Cznnect, stages 4 and 5: polls, and bucket lists with to-dos.
-- Run this after 01 to 05. Paste it into Supabase > SQL Editor > New query, then Run.
-- Safe to run again.
--
-- Who can do what:
--   every member of the family   see everything, start a poll, vote, add and edit bucket-list items, say "I'm in"
--   the person who made a poll or item   remove it
--   the family owner   remove anything
--   a poll can be closed or reopened by the person who made it, or the owner
--   each member has one vote per poll, which they can change until the poll is closed

-- 1. Polls ----------------------------------------------------------------------

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  question text not null check (length(trim(question)) between 1 and 120),
  closed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);
create index if not exists polls_by_family on public.polls (family_id);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null,
  family_id uuid not null,
  label text not null check (length(trim(label)) between 1 and 80),
  position int not null default 0,
  foreign key (poll_id, family_id) references public.polls (id, family_id) on delete cascade,
  unique (id, poll_id)
);
create index if not exists poll_options_by_poll on public.poll_options (poll_id);

create table if not exists public.poll_votes (
  poll_id uuid not null,
  family_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  option_id uuid not null,
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  foreign key (poll_id, family_id) references public.polls (id, family_id) on delete cascade,
  foreign key (option_id, poll_id) references public.poll_options (id, poll_id) on delete cascade
);

-- 2. Bucket lists ---------------------------------------------------------------

create table if not exists public.bucket_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  notes text check (notes is null or length(notes) <= 1000),
  horizon text not null default 'life' check (horizon in ('month', 'year', 'life')),
  due_date date,
  assigned_to uuid references public.profiles (id) on delete set null,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);
-- The same idea cannot be added twice to the same list.
create unique index if not exists bucket_items_no_duplicates
  on public.bucket_items (family_id, horizon, lower(trim(title)));
create index if not exists bucket_items_by_family on public.bucket_items (family_id);

create table if not exists public.bucket_votes (
  item_id uuid not null,
  family_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id),
  foreign key (item_id, family_id) references public.bucket_items (id, family_id) on delete cascade
);

-- Only a member of the family can be given a task, and "done" records who and when.
create or replace function public.bucket_item_guard()
returns trigger
language plpgsql
as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from public.family_members m where m.family_id = new.family_id and m.user_id = new.assigned_to
  ) then
    raise exception 'You can only give a task to someone in the family';
  end if;
  if new.done then
    if tg_op = 'INSERT' or not old.done then
      new.done_at := now();
      new.done_by := auth.uid();
    else
      new.done_at := old.done_at;
      new.done_by := old.done_by;
    end if;
  else
    new.done_at := null;
    new.done_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bucket_items_guard on public.bucket_items;
create trigger bucket_items_guard
  before insert or update on public.bucket_items
  for each row execute function public.bucket_item_guard();

-- 3. Privacy rules --------------------------------------------------------------

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.bucket_items enable row level security;
alter table public.bucket_votes enable row level security;

drop policy if exists "members see polls" on public.polls;
create policy "members see polls" on public.polls
  for select to authenticated using (public.is_family_member(family_id));

drop policy if exists "creator or owner removes polls" on public.polls;
create policy "creator or owner removes polls" on public.polls
  for delete to authenticated
  using (public.is_family_member(family_id) and (created_by = auth.uid() or public.is_family_owner(family_id)));

drop policy if exists "members see poll options" on public.poll_options;
create policy "members see poll options" on public.poll_options
  for select to authenticated using (public.is_family_member(family_id));

drop policy if exists "members see votes" on public.poll_votes;
create policy "members see votes" on public.poll_votes
  for select to authenticated using (public.is_family_member(family_id));

drop policy if exists "members remove own vote" on public.poll_votes;
create policy "members remove own vote" on public.poll_votes
  for delete to authenticated
  using (user_id = auth.uid() and public.is_family_member(family_id)
         and not exists (select 1 from public.polls p where p.id = poll_id and p.closed));

drop policy if exists "members see items" on public.bucket_items;
create policy "members see items" on public.bucket_items
  for select to authenticated using (public.is_family_member(family_id));

drop policy if exists "members add items" on public.bucket_items;
create policy "members add items" on public.bucket_items
  for insert to authenticated with check (public.is_family_member(family_id));

drop policy if exists "members edit items" on public.bucket_items;
create policy "members edit items" on public.bucket_items
  for update to authenticated
  using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

drop policy if exists "creator or owner removes items" on public.bucket_items;
create policy "creator or owner removes items" on public.bucket_items
  for delete to authenticated
  using (public.is_family_member(family_id) and (created_by = auth.uid() or public.is_family_owner(family_id)));

drop policy if exists "members see item votes" on public.bucket_votes;
create policy "members see item votes" on public.bucket_votes
  for select to authenticated using (public.is_family_member(family_id));

drop policy if exists "members say they are in" on public.bucket_votes;
create policy "members say they are in" on public.bucket_votes
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_family_member(family_id));

drop policy if exists "members take back their vote" on public.bucket_votes;
create policy "members take back their vote" on public.bucket_votes
  for delete to authenticated
  using (user_id = auth.uid() and public.is_family_member(family_id));

-- Which columns the app may write directly. Polls and votes only change through the functions below.
revoke all on public.polls, public.poll_options, public.poll_votes,
              public.bucket_items, public.bucket_votes from anon;
revoke insert, update on public.polls, public.poll_options, public.poll_votes from authenticated;
revoke insert, update on public.bucket_items, public.bucket_votes from authenticated;
revoke delete on public.poll_options from authenticated;
grant select, delete on public.polls to authenticated;
grant select on public.poll_options to authenticated;
grant select, delete on public.poll_votes to authenticated;
grant select, delete on public.bucket_items to authenticated;
grant select, delete on public.bucket_votes to authenticated;
grant insert (family_id, title, notes, horizon, due_date, assigned_to, done)
  on public.bucket_items to authenticated;
grant update (title, notes, horizon, due_date, assigned_to, done)
  on public.bucket_items to authenticated;
grant insert (item_id, family_id) on public.bucket_votes to authenticated;

-- 4. Poll functions -------------------------------------------------------------

drop function if exists public.create_poll(uuid, text, text[]);
create function public.create_poll(fid uuid, question_in text, options_in text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  cleaned text[];
  opt text;
  i int := 0;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.is_family_member(fid) then
    raise exception 'You are not in that family';
  end if;
  if length(trim(coalesce(question_in, ''))) = 0 or length(trim(question_in)) > 120 then
    raise exception 'Write a question of 1 to 120 characters';
  end if;
  select coalesce(array_agg(trim(o)), '{}') into cleaned
    from unnest(coalesce(options_in, '{}')) as o
    where length(trim(o)) > 0;
  if array_length(cleaned, 1) is null or array_length(cleaned, 1) < 2 or array_length(cleaned, 1) > 8 then
    raise exception 'A poll needs 2 to 8 choices';
  end if;
  if (select count(distinct lower(c)) from unnest(cleaned) c) <> array_length(cleaned, 1) then
    raise exception 'Each choice must be different';
  end if;

  insert into public.polls (family_id, question) values (fid, trim(question_in)) returning id into pid;
  foreach opt in array cleaned loop
    if length(opt) > 80 then
      raise exception 'A choice can be 80 characters at most';
    end if;
    insert into public.poll_options (poll_id, family_id, label, position) values (pid, fid, opt, i);
    i := i + 1;
  end loop;
  return pid;
end;
$$;

drop function if exists public.cast_vote(uuid, uuid);
create function public.cast_vote(pid uuid, oid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  is_closed boolean;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select family_id, closed into fid, is_closed from public.polls where id = pid;
  if fid is null or not public.is_family_member(fid) then
    raise exception 'That poll was not found';
  end if;
  if is_closed then
    raise exception 'This poll is closed';
  end if;
  if not exists (select 1 from public.poll_options where id = oid and poll_id = pid) then
    raise exception 'That choice is not part of this poll';
  end if;
  insert into public.poll_votes (poll_id, family_id, user_id, option_id)
  values (pid, fid, auth.uid(), oid)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, voted_at = now();
end;
$$;

drop function if exists public.set_poll_closed(uuid, boolean);
create function public.set_poll_closed(pid uuid, closed_in boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  maker uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  select family_id, created_by into fid, maker from public.polls where id = pid;
  if fid is null or not public.is_family_member(fid) then
    raise exception 'That poll was not found';
  end if;
  if maker is distinct from auth.uid() and not public.is_family_owner(fid) then
    raise exception 'Only the person who started the poll or the owner can close it';
  end if;
  update public.polls set closed = coalesce(closed_in, true) where id = pid;
end;
$$;

revoke execute on function public.create_poll(uuid, text, text[]) from public, anon;
revoke execute on function public.cast_vote(uuid, uuid) from public, anon;
revoke execute on function public.set_poll_closed(uuid, boolean) from public, anon;
grant execute on function public.create_poll(uuid, text, text[]) to authenticated;
grant execute on function public.cast_vote(uuid, uuid) to authenticated;
grant execute on function public.set_poll_closed(uuid, boolean) to authenticated;
