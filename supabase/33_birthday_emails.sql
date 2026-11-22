-- Birthday emails: remembers who was already sent a birthday email this year, so nobody gets two.
-- Only the server (the send-birthday-emails function) reads and writes it; no policies means no one else can.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
create table if not exists public.birthday_email_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  year    int  not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, year)
);
alter table public.birthday_email_log enable row level security;
