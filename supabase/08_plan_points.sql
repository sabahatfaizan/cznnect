-- Cznnect plan difficulty rewards.
-- Run this once in Supabase > SQL Editor after 06_plans.sql.
-- Safe to run again.

alter table public.bucket_items
  add column if not exists difficulty text not null default 'medium';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bucket_items'::regclass
      and conname = 'bucket_items_difficulty_check'
  ) then
    alter table public.bucket_items
      add constraint bucket_items_difficulty_check
      check (difficulty in ('easy', 'medium', 'hard', 'epic'));
  end if;
end;
$$;

create table if not exists public.plan_points (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null unique,
  points integer not null check (points > 0),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'epic')),
  created_at timestamptz not null default now(),
  foreign key (item_id, family_id)
    references public.bucket_items(id, family_id) on delete cascade
);

alter table public.plan_points enable row level security;
drop policy if exists "family members read plan points" on public.plan_points;
create policy "family members read plan points" on public.plan_points
  for select to authenticated using (public.is_family_member(family_id));

revoke all on public.plan_points from anon, authenticated;
grant select on public.plan_points to authenticated;

create or replace function public.award_plan_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reward integer;
  should_award boolean := false;
begin
  if new.done and new.done_by is not null then
    if tg_op = 'INSERT' then
      should_award := true;
    elsif old.done is distinct from true then
      should_award := true;
    end if;
  end if;

  if should_award then
    reward := case new.difficulty
      when 'easy' then 5
      when 'medium' then 10
      when 'hard' then 20
      when 'epic' then 50
      else 10
    end;

    -- Unique item_id means reopening/re-completing a plan cannot award it twice.
    insert into public.plan_points (family_id, user_id, item_id, points, difficulty)
    values (new.family_id, new.done_by, new.id, reward, new.difficulty)
    on conflict (item_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists bucket_items_award_plan_points on public.bucket_items;
create trigger bucket_items_award_plan_points
  after insert or update on public.bucket_items
  for each row execute function public.award_plan_points();

-- Keep the difficulty field available to the app's allowed item writes.
revoke insert, update on public.bucket_items from authenticated;
grant insert (family_id, title, notes, horizon, due_date, assigned_to, done, difficulty)
  on public.bucket_items to authenticated;
grant update (title, notes, horizon, due_date, assigned_to, done, difficulty)
  on public.bucket_items to authenticated;
