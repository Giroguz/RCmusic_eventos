-- Extend the free DJ demo from 1 day to 5 days.

create or replace function public.dj_start_trial(p_email text,p_display_name text)
returns table(email text,display_name text,generated_code text,plan_expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare raw_code text; normalized_email text; existing public.dj_accounts%rowtype; new_id uuid;
begin
  normalized_email:=lower(trim(p_email));
  if normalized_email='' or position('@' in normalized_email)<2 then raise exception 'Valid email required'; end if;
  select a.* into existing from public.dj_accounts a where a.email=normalized_email limit 1;
  if existing.id is not null then
    if existing.plan_type='trial' and existing.demo_code is not null and existing.plan_expires_at>now() then
      return query select existing.email,existing.display_name,existing.demo_code,existing.plan_expires_at;
      return;
    end if;
    raise exception 'Demo already used or email already registered';
  end if;
  raw_code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
  insert into public.dj_accounts(email,display_name,access_code_hash,demo_code,demo_used_at,approved,blocked,plan_type,plan_started_at,plan_expires_at)
    values(normalized_email,coalesce(nullif(trim(p_display_name),''),'DJ Demo'),encode(digest(raw_code,'sha256'),'hex'),raw_code,now(),true,false,'trial',now(),now()+interval '5 days') returning id into new_id;
  return query select a.email,a.display_name,a.demo_code,a.plan_expires_at from public.dj_accounts a where a.id=new_id;
end $$;
grant execute on function public.dj_start_trial(text,text) to anon,authenticated;

-- Give currently active one-day demos the same five-day window, without
-- restoring demos that have already expired.
update public.dj_accounts
set plan_expires_at = plan_started_at + interval '5 days'
where plan_type='trial'
  and plan_started_at is not null
  and plan_expires_at > now()
  and plan_expires_at < plan_started_at + interval '5 days';
