-- RC music_eventos: add the 15-day paid plan.
-- This migration keeps authorization separate from plan selection.

create or replace function public.admin_create_dj(p_token text,p_email text,p_display_name text,p_plan_type text)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; d public.dj_accounts; raw_code text;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  if p_plan_type not in ('none','fifteen','monthly','annual') then raise exception 'Invalid plan'; end if;
  raw_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
  insert into public.dj_accounts(email,display_name,access_code_hash,approved,plan_type,plan_started_at,plan_expires_at)
    values(lower(trim(p_email)),coalesce(nullif(trim(p_display_name),''),'DJ'),encode(digest(raw_code,'sha256'),'hex'),false,p_plan_type,
      case when p_plan_type='none' then null else now() end,
      case when p_plan_type='fifteen' then now()+interval '15 days' when p_plan_type='monthly' then now()+interval '30 days' when p_plan_type='annual' then now()+interval '365 days' else null end)
    returning * into d;
  return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,
    case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,
    (d.approved and not d.blocked and d.plan_expires_at>now()),raw_code;
end $$;
grant execute on function public.admin_create_dj(text,text,text,text) to anon,authenticated;

create or replace function public.admin_set_dj_plan(p_token text,p_dj_id uuid,p_plan_type text)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; d public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or p_plan_type not in ('none','fifteen','monthly','annual') then raise exception 'Admin only or invalid plan'; end if;
  update public.dj_accounts set plan_type=p_plan_type,
    plan_started_at=case when p_plan_type='none' then null else now() end,
    plan_expires_at=case when p_plan_type='fifteen' then now()+interval '15 days' when p_plan_type='monthly' then now()+interval '30 days' when p_plan_type='annual' then now()+interval '365 days' else null end
    where id=p_dj_id and role='dj' returning * into d;
  return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,
    case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,
    (d.approved and not d.blocked and d.plan_expires_at>now()),null::text;
end $$;
grant execute on function public.admin_set_dj_plan(text,uuid,text) to anon,authenticated;
