-- Host-only family deletion for Cznnect.
-- Run this once in Supabase SQL Editor after the existing family setup migrations.
-- The original creator is checked directly; membership roles never grant this permission.

create or replace function public.delete_family(fid uuid, confirmation_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  family_name text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;

  select name into family_name
  from public.families
  where id = fid
    and created_by = auth.uid()
  for update;

  if not found then
    raise exception 'Only the original family creator can delete this family';
  end if;

  if trim(coalesce(confirmation_name, '')) <> family_name then
    raise exception 'The family name confirmation does not match';
  end if;

  -- Family-owned records are removed through the existing ON DELETE CASCADE
  -- relationships. The signed-in profile/account is not deleted.
  delete from public.families
  where id = fid
    and created_by = auth.uid();
end;
$$;

revoke execute on function public.delete_family(uuid, text) from public, anon;
grant execute on function public.delete_family(uuid, text) to authenticated;
