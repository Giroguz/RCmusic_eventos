-- When the administrator saves a paid plan, activate the DJ immediately.
-- Apply after developer_controls.sql and admin_visible_access_code_fix.sql.

create or replace function public.admin_set_dj_plan(p_token text, p_dj_id uuid, p_plan_type text)
returns table(
  id uuid, email text, display_name text, role text, approved boolean, blocked boolean,
  plan_type text, plan_started_at timestamptz, plan_expires_at timestamptz,
  days_used integer, days_remaining integer, is_active boolean, generated_code text
)
language plpgsql security definer set search_path=public,extensions as $$
declare
  a public.dj_accounts;
  d public.dj_accounts;
  p_days integer;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then
    raise exception 'Admin only';
  end if;
  if p_plan_type not in ('none','fifteen','monthly','annual') then
    raise exception 'Invalid plan';
  end if;

  select case p_plan_type
    when 'fifteen' then fifteen_days
    when 'monthly' then monthly_days
    when 'annual' then annual_days
    else null
  end into p_days
  from public.subscription_settings where id=true;

  update public.dj_accounts
  set plan_type = p_plan_type,
      plan_started_at = case when p_days is null then null else now() end,
      plan_expires_at = case when p_days is null then null else now() + make_interval(days => p_days) end,
      approved = case when p_days is null then false else true end,
      blocked = false
  where id=p_dj_id and role='dj'
  returning * into d;

  if d.id is null then raise exception 'DJ not found'; end if;

  return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,
    d.plan_started_at,d.plan_expires_at,0,
    case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,
    (d.approved and not d.blocked and d.plan_expires_at>now()),
    coalesce(nullif(d.access_code_display,''),nullif(d.demo_code,''));
end;
$$;
grant execute on function public.admin_set_dj_plan(text,uuid,text) to anon, authenticated;
