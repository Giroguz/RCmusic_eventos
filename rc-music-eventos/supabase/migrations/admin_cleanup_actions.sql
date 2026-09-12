-- Developer center cleanup actions. Apply after subscription_payment_proofs.sql.

create or replace function public.admin_delete_subscription_proof(p_token text, p_proof_id uuid)
returns boolean
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; affected integer;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  delete from public.subscription_payment_proofs where id=p_proof_id;
  get diagnostics affected = row_count;
  return affected > 0;
end $$;
grant execute on function public.admin_delete_subscription_proof(text,uuid) to anon,authenticated;

create or replace function public.admin_delete_dj(p_token text, p_dj_id uuid)
returns boolean
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; affected integer;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  delete from public.dj_accounts where id=p_dj_id and role='dj';
  get diagnostics affected = row_count;
  return affected > 0;
end $$;
grant execute on function public.admin_delete_dj(text,uuid) to anon,authenticated;
