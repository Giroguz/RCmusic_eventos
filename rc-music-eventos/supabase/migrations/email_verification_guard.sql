-- Require a real, confirmed Supabase Auth identity before a DJ demo is created.
-- This closes the direct-RPC bypass: the email must match auth.uid() and be confirmed.
create or replace function public.dj_start_trial(p_email text,p_display_name text)
returns table(email text,display_name text,generated_code text,plan_expires_at timestamptz)
language plpgsql security definer set search_path=public,extensions as $$
declare
  raw_code text;
  normalized_email text;
  auth_email text;
  auth_confirmed_at timestamptz;
  existing public.dj_accounts%rowtype;
  new_id uuid;
begin
  normalized_email:=lower(trim(p_email));
  if normalized_email='' or position('@' in normalized_email)<2 then raise exception 'Valid email required'; end if;
  if auth.uid() is null then raise exception 'Email verification required'; end if;
  select lower(u.email),u.email_confirmed_at into auth_email,auth_confirmed_at
    from auth.users u where u.id=auth.uid();
  if auth_email is null or auth_email<>normalized_email or auth_confirmed_at is null then
    raise exception 'Email verification required';
  end if;
  select a.* into existing from public.dj_accounts as a where a.email=normalized_email limit 1;
  if existing.id is not null then
    if existing.role='admin' then raise exception 'Demo unavailable for admin'; end if;
    if existing.plan_type='trial' and existing.demo_code is not null and existing.plan_expires_at>now() then
      return query select existing.email,existing.display_name,existing.demo_code,existing.plan_expires_at; return;
    end if;
    if existing.demo_used_at is not null then raise exception 'Demo already used'; end if;
    if existing.plan_type in ('monthly','annual') and existing.plan_expires_at>now() then raise exception 'Active plan already exists'; end if;
    raw_code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
    update public.dj_accounts as a set display_name=coalesce(nullif(trim(p_display_name),''),a.display_name,'DJ Demo'), access_code_hash=encode(digest(raw_code,'sha256'::text),'hex'), demo_code=raw_code, demo_used_at=now(), approved=true, blocked=false, plan_type='trial', plan_started_at=now(), plan_expires_at=now()+interval '1 day' where a.id=existing.id returning a.* into existing;
    return query select existing.email,existing.display_name,existing.demo_code,existing.plan_expires_at; return;
  end if;
  raw_code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
  insert into public.dj_accounts(email,display_name,access_code_hash,demo_code,demo_used_at,approved,blocked,plan_type,plan_started_at,plan_expires_at) values(normalized_email,coalesce(nullif(trim(p_display_name),''),'DJ Demo'),encode(digest(raw_code,'sha256'::text),'hex'),raw_code,now(),true,false,'trial',now(),now()+interval '1 day') returning id into new_id;
  return query select a.email,a.display_name,a.demo_code,a.plan_expires_at from public.dj_accounts as a where a.id=new_id;
end $$;
grant execute on function public.dj_start_trial(text,text) to anon,authenticated;
