-- Show the current DJ access code to the authenticated administrator.
-- Apply after plans_15_days.sql and developer_controls.sql.
-- The value is exposed only through admin-only RPCs.

alter table public.dj_accounts add column if not exists access_code_display text;

-- Existing accounts created before this migration have no recoverable plaintext code.
-- They will show "No disponible" until the code is regenerated through a controlled admin action.

drop function if exists public.admin_list_djs(text);
create function public.admin_list_djs(p_token text)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,
    case when d.plan_started_at is null then 0 else greatest(0,floor(extract(epoch from least(now(),d.plan_expires_at)-d.plan_started_at)/86400)::integer) end,
    case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,
    (d.approved and not d.blocked and (d.role='admin' or d.plan_expires_at>now())),d.access_code_display
  from public.dj_accounts d order by d.created_at desc;
end $$;
grant execute on function public.admin_list_djs(text) to anon,authenticated;

-- Re-create the DJ creator so every newly generated code is available to the admin.
drop function if exists public.admin_create_dj(text,text,text,text);
create function public.admin_create_dj(p_token text,p_email text,p_display_name text,p_plan_type text)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; d public.dj_accounts; raw_code text; p_days integer;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  if p_plan_type not in ('none','fifteen','monthly','annual') then raise exception 'Invalid plan'; end if;
  raw_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
  select case p_plan_type when 'fifteen' then fifteen_days when 'monthly' then monthly_days when 'annual' then annual_days else null end into p_days from public.subscription_settings where id=true;
  insert into public.dj_accounts(email,display_name,access_code_hash,access_code_display,approved,plan_type,plan_started_at,plan_expires_at)
    values(lower(trim(p_email)),coalesce(nullif(trim(p_display_name),''),'DJ'),encode(digest(raw_code,'sha256'),'hex'),raw_code,false,p_plan_type,case when p_days is null then null else now() end,case when p_days is null then null else now()+make_interval(days => p_days) end)
    returning * into d;
  return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,
    case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,
    (d.approved and not d.blocked and d.plan_expires_at>now()),raw_code;
end $$;
grant execute on function public.admin_create_dj(text,text,text,text) to anon,authenticated;

create or replace function public.admin_regenerate_code(p_token text,p_dj_id uuid)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; d public.dj_accounts; raw_code text;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  raw_code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
  update public.dj_accounts set access_code_hash=encode(digest(raw_code,'sha256'),'hex'), access_code_display=raw_code where id=p_dj_id and (role='dj' or email='djgianfrancoromerodechosica@gmail.com') returning * into d;
  return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,
    case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,
    (d.approved and not d.blocked and d.plan_expires_at>now()),raw_code;
end $$;
grant execute on function public.admin_regenerate_code(text,uuid) to anon,authenticated;

-- Keep a user-selected recovery key visible to the administrator as well.
create or replace function public.dj_set_admin_code(p_new_code text)
returns boolean
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; normalized text;
begin
  normalized := trim(coalesce(p_new_code, ''));
  if length(normalized) < 8 or length(normalized) > 128 then raise exception 'Invalid admin code'; end if;
  if auth.uid() is null then raise exception 'Verified admin email required'; end if;
  select * into a from public.dj_accounts where role='admin' and email=lower(coalesce(auth.jwt()->>'email','')) limit 1;
  if a.id is null or not exists (select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=a.email) then raise exception 'Verified admin email required'; end if;
  update public.dj_accounts set access_code_hash=encode(digest(normalized,'sha256'),'hex'), access_code_display=normalized, approved=true, blocked=false where id=a.id;
  return true;
end $$;
grant execute on function public.dj_set_admin_code(text) to anon,authenticated;
