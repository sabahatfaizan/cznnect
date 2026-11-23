-- Birthday is asked when someone signs up. The app sends it with the sign-up, and this saves it on the new profile.
-- A missing or impossible date is simply left empty; the app then asks for it on first sign-in.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run again.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b date;
begin
  begin
    b := nullif(trim(new.raw_user_meta_data ->> 'birthday'), '')::date;
  exception when others then
    b := null;
  end;
  if b is not null and (b > current_date or b < date '1900-01-01') then
    b := null;
  end if;

  insert into public.profiles (id, display_name, birthday)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    b
  );
  return new;
end;
$$;
