-- Allow the verified administrator to choose a new developer access key.
-- Apply after the base schema / email verification setup.

create or replace function public.dj_set_admin_code(p_new_code text)
returns boolean
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; normalized text;
begin
  normalized := trim(coalesce(p_new_code, ''));
  if length(normalized) < 8 or length(normalized) > 128 then raise exception 'Invalid admin code'; end if;
  if auth.uid() is null then raise exception 'Verified admin email required'; end if;
  select * into a from public.dj_accounts where role='admin' and email=lower(coalesce(auth.jwt()->>'email','')) limit 1;
  if a.id is null or not exists (select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=a.email) then
    raise exception 'Verified admin email required';
  end if;
  update public.dj_accounts set access_code_hash=encode(digest(normalized,'sha256'),'hex'), approved=true, blocked=false where id=a.id;
  return true;
end $$;
grant execute on function public.dj_set_admin_code(text) to anon,authenticated;
