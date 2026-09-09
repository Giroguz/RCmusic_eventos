-- Developer controls: editable plan prices/durations and manual time extensions.
-- Apply after subscription_qr.sql and plans_15_days.sql.

alter table public.subscription_settings
  add column if not exists fifteen_days integer not null default 15,
  add column if not exists monthly_days integer not null default 30,
  add column if not exists annual_days integer not null default 365,
  add column if not exists fifteen_price numeric(10,2) not null default 16,
  add column if not exists monthly_price numeric(10,2) not null default 30,
  add column if not exists annual_price numeric(10,2) not null default 330;

insert into public.subscription_settings(id) values (true) on conflict (id) do nothing;

do $$ begin
  alter table public.dj_accounts drop constraint if exists dj_accounts_plan_type_check;
  alter table public.dj_accounts add constraint dj_accounts_plan_type_check check (plan_type in ('none','fifteen','monthly','annual','admin','trial'));
exception when undefined_table then null; end $$;

create or replace function public.get_subscription_plan_prices()
returns table(plan_type text, days integer, price_pen numeric)
language sql stable security definer set search_path=public as $$
  select * from (values
    ('fifteen', (select fifteen_days from public.subscription_settings where id=true), (select fifteen_price from public.subscription_settings where id=true)),
    ('monthly', (select monthly_days from public.subscription_settings where id=true), (select monthly_price from public.subscription_settings where id=true)),
    ('annual', (select annual_days from public.subscription_settings where id=true), (select annual_price from public.subscription_settings where id=true))
  ) as plans(plan_type, days, price_pen)
$$;
grant execute on function public.get_subscription_plan_prices() to anon, authenticated;

create or replace function public.admin_get_subscription_plan_prices(p_token text)
returns table(plan_type text, days integer, price_pen numeric)
language plpgsql security definer set search_path=public as $$
declare a public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  return query select * from public.get_subscription_plan_prices();
end $$;
grant execute on function public.admin_get_subscription_plan_prices(text) to anon, authenticated;

create or replace function public.admin_set_subscription_plan_prices(
  p_token text,
  p_fifteen_days integer, p_fifteen_price numeric,
  p_monthly_days integer, p_monthly_price numeric,
  p_annual_days integer, p_annual_price numeric
)
returns table(plan_type text, days integer, price_pen numeric)
language plpgsql security definer set search_path=public as $$
declare a public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  if p_fifteen_days not between 1 and 3650 or p_monthly_days not between 1 and 3650 or p_annual_days not between 1 and 3650 then raise exception 'Invalid plan duration'; end if;
  if p_fifteen_price < 0 or p_monthly_price < 0 or p_annual_price < 0 then raise exception 'Invalid plan price'; end if;
  update public.subscription_settings set
    fifteen_days=p_fifteen_days, fifteen_price=round(p_fifteen_price,2),
    monthly_days=p_monthly_days, monthly_price=round(p_monthly_price,2),
    annual_days=p_annual_days, annual_price=round(p_annual_price,2), updated_at=now()
    where id=true;
  return query select * from public.get_subscription_plan_prices();
end $$;
grant execute on function public.admin_set_subscription_plan_prices(text,integer,numeric,integer,numeric,integer,numeric) to anon, authenticated;

create or replace function public.admin_set_dj_plan(p_token text,p_dj_id uuid,p_plan_type text)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; d public.dj_accounts; p_days integer;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or p_plan_type not in ('none','fifteen','monthly','annual') then raise exception 'Admin only or invalid plan'; end if;
  select case p_plan_type when 'fifteen' then fifteen_days when 'monthly' then monthly_days when 'annual' then annual_days else null end into p_days from public.subscription_settings where id=true;
  update public.dj_accounts set plan_type=p_plan_type,
    plan_started_at=case when p_plan_type='none' then null else now() end,
    plan_expires_at=case when p_days is null then null else now()+make_interval(days => p_days) end
    where id=p_dj_id and role='dj' returning * into d;
  return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,
    case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,
    (d.approved and not d.blocked and d.plan_expires_at>now()),null::text;
end $$;
grant execute on function public.admin_set_dj_plan(text,uuid,text) to anon,authenticated;

create or replace function public.admin_extend_dj_plan(p_token text, p_dj_id uuid, p_days integer)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; d public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  if p_days not between 1 and 3650 then raise exception 'Invalid extension'; end if;
  update public.dj_accounts
    set approved=true, blocked=false,
        plan_type=case when plan_type in ('monthly','annual','fifteen') then plan_type else 'monthly' end,
        plan_started_at=coalesce(plan_started_at, now()),
        plan_expires_at=greatest(coalesce(plan_expires_at, now()), now()) + make_interval(days => p_days)
    where id=p_dj_id and role='dj'
    returning * into d;
  if d.id is null then raise exception 'DJ not found'; end if;
  return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,
    greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer),
    (d.approved and not d.blocked and d.plan_expires_at>now()),null::text;
end $$;
grant execute on function public.admin_extend_dj_plan(text,uuid,integer) to anon, authenticated;

create or replace function public.admin_review_subscription_proof(p_token text,p_proof_id uuid,p_status text,p_notes text default null)
returns table(id uuid,dj_id uuid,plan_type text,proof_image text,status text,submitted_at timestamptz,reviewed_at timestamptz,reviewer_notes text)
language plpgsql security definer set search_path=public,extensions as $$
declare a public.dj_accounts; p public.subscription_payment_proofs; d public.dj_accounts; p_days integer;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
  select * into p from public.subscription_payment_proofs where id=p_proof_id for update;
  if not found then raise exception 'Proof not found'; end if;
  if p.status <> 'pending' then raise exception 'Proof already reviewed'; end if;
  update public.subscription_payment_proofs set status=p_status, reviewed_at=now(), reviewed_by=a.id, reviewer_notes=nullif(trim(p_notes),'') where id=p_proof_id returning * into p;
  if p_status='approved' then
    select case p.plan_type when 'fifteen' then fifteen_days when 'monthly' then monthly_days when 'annual' then annual_days else null end into p_days from public.subscription_settings where id=true;
    update public.dj_accounts set approved=true, plan_type=p.plan_type, plan_started_at=now(), plan_expires_at=now()+make_interval(days => p_days) where id=p.dj_id and role='dj' returning * into d;
  end if;
  return query select p.id,p.dj_id,p.plan_type,p.proof_image,p.status,p.submitted_at,p.reviewed_at,p.reviewer_notes;
end $$;
grant execute on function public.admin_review_subscription_proof(text,uuid,text,text) to anon,authenticated;
