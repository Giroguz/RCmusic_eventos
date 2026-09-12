-- Security hardening for developer-code recovery.
-- Anonymous callers must not be able to invoke the recovery RPC.
-- A verified Supabase user is still required, and only the initial admin email may recover.

create or replace function public.dj_set_admin_code(p_new_code text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_email text;
begin
  select lower(trim(u.email))
    into actor_email
  from auth.users u
  where u.id = auth.uid()
    and u.email_confirmed_at is not null;

  if auth.uid() is null or coalesce(actor_email, '') <> 'djgianfrancoromerodechosica@gmail.com' then
    raise exception 'Admin recovery requires verified admin email';
  end if;

  if p_new_code is null or length(trim(p_new_code)) < 8 or length(trim(p_new_code)) > 64 then
    raise exception 'Code must be 8-64 characters';
  end if;

  update public.dj_accounts
     set access_code_hash = encode(extensions.digest(trim(p_new_code), 'sha256'), 'hex')
   where lower(email) = 'djgianfrancoromerodechosica@gmail.com'
     and role = 'admin';

  if not found then
    raise exception 'Admin account not found';
  end if;

  delete from public.dj_sessions
   where dj_id = (
     select id
       from public.dj_accounts
      where lower(email) = 'djgianfrancoromerodechosica@gmail.com'
        and role = 'admin'
   );

  return true;
end;
$$;

revoke all on function public.dj_set_admin_code(text) from public, anon;
grant execute on function public.dj_set_admin_code(text) to authenticated;
