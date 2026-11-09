-- Cznnect: one account can be in up to three families.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run. It is safe to run again.
-- The app already stops a fourth family on its own; this makes the server refuse it too.

create or replace function public.create_family(family_name text)
returns uuid
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
  if trim(coalesce(family_name, '')) = '' then
    raise exception 'Give your family a name';
  end if;
  if (select count(*) from public.family_members where user_id = auth.uid()) >= 3 then
    raise exception 'You can be in up to 3 families. Leave one first.';
  end if;

  insert into public.families (name, created_by)
  values (trim(family_name), auth.uid())
  returning id into fid;

  insert into public.family_members (family_id, user_id, role)
  values (fid, auth.uid(), 'owner');

  return fid;
end;
$$;

create or replace function public.join_family(code text)
returns uuid
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

  select id into fid from public.families
  where invite_code = lower(trim(code));

  if fid is null then
    raise exception 'That invite code does not match any family';
  end if;

  -- Already in it: nothing to add. Otherwise the limit applies.
  if not exists (select 1 from public.family_members where family_id = fid and user_id = auth.uid())
     and (select count(*) from public.family_members where user_id = auth.uid()) >= 3 then
    raise exception 'You can be in up to 3 families. Leave one first.';
  end if;

  insert into public.family_members (family_id, user_id)
  values (fid, auth.uid())
  on conflict do nothing;

  return fid;
end;
$$;

revoke execute on function public.create_family(text) from public, anon;
revoke execute on function public.join_family(text) from public, anon;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
