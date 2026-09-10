-- Developer-controlled duration for new demo accounts.
-- Apply after developer_controls.sql and email_verification_guard.sql.

alter table public.subscription_settings
  add column if not exists demo_days integer not null default 1;

create or replace function public.get_demo_days()
returns integer
language sql stable security definer set search_path=public as $$
  select coalesce((select demo_days from public.subscription_settings where id=true), 1);
$$;
grant execute on function public.get_demo_days() to anon, authenticated;

create or replace function public.admin_get_demo_days(p_token text)
returns integer
language plpgsql security definer set search_path=public as $$
declare a public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  return public.get_demo_days();
end;
$$;
grant execute on function public.admin_get_demo_days(text) to anon, authenticated;

create or replace function public.admin_set_demo_days(p_token text, p_demo_days integer)
returns integer
language plpgsql security definer set search_path=public as $$
declare a public.dj_accounts; next_days integer;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  if p_demo_days not between 1 and 3650 then raise exception 'Invalid demo duration'; end if;
  next_days := p_demo_days;
  update public.subscription_settings set demo_days=next_days, updated_at=now() where id=true;
  return next_days;
end;
$$;
grant execute on function public.admin_set_demo_days(text,integer) to anon, authenticated;

-- Definitive verified-demo function: new demos use the configured duration.
create or replace function public.dj_start_trial(p_email text, p_display_name text)
returns table(email text, display_name text, generated_code text, plan_expires_at timestamptz)
language plpgsql security definer set search_path=public,extensions as $$
declare
  raw_code text; normalized_email text; auth_email text; auth_confirmed_at timestamptz;
  existing public.dj_accounts%rowtype; new_id uuid; demo_duration integer;
begin
  normalized_email := lower(trim(p_email));
  if normalized_email='' or position('@' in normalized_email)<2 then raise exception 'Valid email required'; end if;
  if auth.uid() is null then raise exception 'Email verification required'; end if;
  select lower(u.email),u.email_confirmed_at into auth_email,auth_confirmed_at from auth.users u where u.id=auth.uid();
  if auth_email is null or auth_email<>normalized_email or auth_confirmed_at is null then raise exception 'Email verification required'; end if;
  demo_duration := public.get_demo_days();
  select a.* into existing from public.dj_accounts a where a.email=normalized_email limit 1;
  if existing.id is not null then
    if existing.role='admin' then raise exception 'Demo unavailable for admin'; end if;
    if existing.plan_type='trial' and existing.demo_code is not null and existing.plan_expires_at>now() then
      return query select existing.email,existing.display_name,existing.demo_code,existing.plan_expires_at; return;
    end if;
    if existing.demo_used_at is not null then raise exception 'Demo already used'; end if;
    if existing.plan_type in ('fifteen','monthly','annual') and existing.plan_expires_at>now() then raise exception 'Active plan already exists'; end if;
    raw_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
    update public.dj_accounts a set display_name=coalesce(nullif(trim(p_display_name),''),a.display_name,'DJ Demo'), access_code_hash=encode(digest(raw_code,'sha256'),'hex'), demo_code=raw_code, demo_used_at=now(), approved=true, blocked=false, plan_type='trial', plan_started_at=now(), plan_expires_at=now()+make_interval(days=>demo_duration) where a.id=existing.id returning a.* into existing;
    return query select existing.email,existing.display_name,existing.demo_code,existing.plan_expires_at; return;
  end if;
  raw_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
  insert into public.dj_accounts(email,display_name,access_code_hash,demo_code,demo_used_at,approved,blocked,plan_type,plan_started_at,plan_expires_at)
    values(normalized_email,coalesce(nullif(trim(p_display_name),''),'DJ Demo'),encode(digest(raw_code,'sha256'),'hex'),raw_code,now(),true,false,'trial',now(),now()+make_interval(days=>demo_duration)) returning id into new_id;
  return query select a.email,a.display_name,a.demo_code,a.plan_expires_at from public.dj_accounts a where a.id=new_id;
end;
$$;
grant execute on function public.dj_start_trial(text,text) to anon, authenticated;
