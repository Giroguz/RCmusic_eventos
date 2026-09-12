-- Manual Yape payment proofs for DJ plan renewals.
create table if not exists public.subscription_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references public.dj_accounts(id) on delete cascade,
  plan_type text not null check (plan_type in ('fifteen','monthly','annual')),
  proof_image text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.dj_accounts(id),
  reviewer_notes text
);
create index if not exists subscription_payment_proofs_status_idx on public.subscription_payment_proofs(status, submitted_at desc);
create index if not exists subscription_payment_proofs_dj_idx on public.subscription_payment_proofs(dj_id, submitted_at desc);

create or replace function public.submit_subscription_proof(p_token text, p_plan_type text, p_proof_image text)
returns table(id uuid, plan_type text, proof_image text, status text, submitted_at timestamptz)
language plpgsql security definer set search_path=public,extensions as $func$
declare a public.dj_accounts; p public.subscription_payment_proofs;
begin
  -- The custom DJ session is the authentication mechanism for this app.
  -- It must remain usable for a renewal even when the previous plan expired.
  select d.* into a
  from public.dj_accounts as d
  join public.dj_sessions as s on s.dj_id=d.id
  where s.token_hash=encode(digest(p_token,'sha256'),'hex')
    and s.expires_at>now()
    and d.role='dj' and d.approved and not d.blocked
  limit 1;
  if a.id is null then raise exception 'DJ access denied'; end if;
  if p_plan_type not in ('fifteen','monthly','annual') then raise exception 'Invalid plan'; end if;
  if p_proof_image is null or length(p_proof_image) < 100 then raise exception 'Proof image required'; end if;
  if length(p_proof_image) > 1500000 then raise exception 'Proof image too large'; end if;

  update public.subscription_payment_proofs
    set plan_type=p_plan_type, proof_image=p_proof_image, submitted_at=now(), reviewer_notes=null
    where dj_id=a.id and public.subscription_payment_proofs.status='pending'
    returning * into p;
  if not found then
    insert into public.subscription_payment_proofs(dj_id,plan_type,proof_image)
      values(a.id,p_plan_type,p_proof_image)
      returning * into p;
  end if;
  return query select p.id,p.plan_type,p.proof_image,p.status,p.submitted_at;
end $func$;
grant execute on function public.submit_subscription_proof(text,text,text) to anon,authenticated;

create or replace function public.admin_list_subscription_proofs(p_token text)
returns table(id uuid,dj_id uuid,email text,display_name text,plan_type text,proof_image text,status text,submitted_at timestamptz,reviewed_at timestamptz,reviewer_notes text)
language plpgsql security definer set search_path=public as $func$
declare a public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  return query
    select p.id,p.dj_id,d.email,d.display_name,p.plan_type,p.proof_image,p.status,p.submitted_at,p.reviewed_at,p.reviewer_notes
    from public.subscription_payment_proofs p
    join public.dj_accounts d on d.id=p.dj_id
    order by case when p.status='pending' then 0 else 1 end, p.submitted_at desc;
end $func$;
grant execute on function public.admin_list_subscription_proofs(text) to anon,authenticated;

drop function if exists public.admin_review_subscription_proof(text,uuid,text,text);
create or replace function public.admin_review_subscription_proof(p_token text,p_proof_id uuid,p_status text,p_notes text default null)
returns table(id uuid,dj_id uuid,plan_type text,proof_image text,status text,submitted_at timestamptz,reviewed_at timestamptz,reviewer_notes text,generated_code text)
language plpgsql security definer set search_path=public,extensions as $func$
declare a public.dj_accounts; p public.subscription_payment_proofs; d public.dj_accounts; raw_code text; p_days integer;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
  select x.* into p from public.subscription_payment_proofs as x where x.id=p_proof_id for update;
  if not found then raise exception 'Proof not found'; end if;
  if p.status <> 'pending' then raise exception 'Proof already reviewed'; end if;
  update public.subscription_payment_proofs as x
    set status=p_status, reviewed_at=now(), reviewed_by=a.id, reviewer_notes=nullif(trim(p_notes),'')
    where x.id=p_proof_id returning x.* into p;
  if p_status='approved' then
    raw_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
    select case p.plan_type when 'fifteen' then s.fifteen_days when 'monthly' then s.monthly_days when 'annual' then s.annual_days end into p_days from public.subscription_settings as s where s.id=true;
    p_days := coalesce(p_days, case p.plan_type when 'fifteen' then 15 when 'monthly' then 30 when 'annual' then 365 end);
    update public.dj_accounts as x set approved=true, blocked=false,
      access_code_hash=encode(digest(raw_code,'sha256'),'hex'), access_code_display=raw_code,
      plan_type=p.plan_type, plan_started_at=now(),
      plan_expires_at=now()+make_interval(days=>p_days)
      where x.id=p.dj_id and x.role='dj' returning x.* into d;
    if d.id is null then raise exception 'DJ account not found'; end if;
  end if;
  return query select p.id,p.dj_id,p.plan_type,p.proof_image,p.status,p.submitted_at,p.reviewed_at,p.reviewer_notes,case when p_status='approved' then raw_code else null end;
end $func$;
grant execute on function public.admin_review_subscription_proof(text,uuid,text,text) to anon,authenticated;
