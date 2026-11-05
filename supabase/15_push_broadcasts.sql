-- Log of family-wide messages. The send-push Edge Function uses it to stop spam (one message per 30 seconds per person).
create table if not exists public.push_broadcasts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  family_id  uuid not null references public.families (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_broadcasts_user_idx on public.push_broadcasts (user_id, created_at desc);

alter table public.push_broadcasts enable row level security;
revoke all on public.push_broadcasts from anon, authenticated;
