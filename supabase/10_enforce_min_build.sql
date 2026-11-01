-- Enforce the owner's minimum app build in the database, so an old Android app is refused data and not only
-- shown an "Update required" screen. Run after 09_admin.sql in the Supabase SQL Editor. Safe to run again.
--
-- How it works: newer Android apps send their build number in an "x-app-build" header. While the owner has set a
-- minimum build, requests from an app below it are refused on every table. Requests with no header (the website,
-- older apps) and the owner's account are always allowed, and any problem reading the header allows the request.
--
-- Run this file again after adding a new table, so the new table gets the same rule.

create or replace function public.app_build_ok()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hdr text;
  minimum integer;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) = 'faizanplayz11@gmail.com' then
    return true;
  end if;
  hdr := (current_setting('request.headers', true)::json) ->> 'x-app-build';
  if hdr is null or hdr !~ '^[0-9]{1,9}$' then
    return true;
  end if;
  select min_build into minimum from public.app_settings where id = 1;
  return coalesce(minimum, 0) = 0 or hdr::integer >= minimum;
exception when others then
  return true;
end;
$$;

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and rowsecurity and tablename <> 'app_settings'
  loop
    execute format('drop policy if exists "Require current app build" on public.%I', t.tablename);
    execute format(
      'create policy "Require current app build" on public.%I as restrictive for all to authenticated using ((select public.app_build_ok()))',
      t.tablename
    );
  end loop;
end $$;
