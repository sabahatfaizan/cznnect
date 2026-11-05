-- Phone push tokens, so the server can send a notification to a signed-in person's phone(s).
-- Run in the Supabase SQL Editor (new query, paste, Run). Safe to run again.
-- The app calls register_push_token after sign-in. A token belongs to one person at a time: if someone else signs in
-- on the same phone, the token moves to them. Only the server (service role) reads this table to send pushes.

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create or replace function public.register_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then
    raise exception 'Invalid token';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
    values (p_token, auth.uid(), coalesce(nullif(p_platform, ''), 'android'), now())
    on conflict (token) do update
      set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
end;
$$;

-- Called on sign-out so a signed-out phone stops receiving that person's notifications.
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
