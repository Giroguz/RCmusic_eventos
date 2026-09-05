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
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'dj' or a.blocked then raise exception 'DJ access denied'; end if;
  if p_plan_type not in ('fifteen','monthly','annual') then raise exception 'Invalid plan'; end if;
  if p_proof_image is null or length(p_proof_image) < 100 then raise exception 'Proof image required'; end if;
  if length(p_proof_image) > 1500000 then raise exception 'Proof image too large'; end if;

  update public.subscription_payment_proofs
    set plan_type=p_plan_type, proof_image=p_proof_image, submitted_at=now(), reviewer_notes=null
    where dj_id=a.id and status='pending'
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

create or replace function public.admin_review_subscription_proof(p_token text,p_proof_id uuid,p_status text,p_notes text default null)
returns table(id uuid,dj_id uuid,plan_type text,proof_image text,status text,submitted_at timestamptz,reviewed_at timestamptz,reviewer_notes text)
language plpgsql security definer set search_path=public,extensions as $func$
declare a public.dj_accounts; p public.subscription_payment_proofs; d public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
  select * into p from public.subscription_payment_proofs where id=p_proof_id for update;
  if not found then raise exception 'Proof not found'; end if;
  if p.status <> 'pending' then raise exception 'Proof already reviewed'; end if;

  update public.subscription_payment_proofs
    set status=p_status, reviewed_at=now(), reviewed_by=a.id, reviewer_notes=nullif(trim(p_notes),'')
    where id=p_proof_id returning * into p;

  if p_status='approved' then
    update public.dj_accounts set approved=true,
      plan_type=p.plan_type, plan_started_at=now(),
      plan_expires_at=case when p.plan_type='fifteen' then now()+interval '15 days' when p.plan_type='monthly' then now()+interval '30 days' when p.plan_type='annual' then now()+interval '365 days' end
      where id=p.dj_id and role='dj' returning * into d;
  end if;
  return query select p.id,p.dj_id,p.plan_type,p.proof_image,p.status,p.submitted_at,p.reviewed_at,p.reviewer_notes;
end $func$;
grant execute on function public.admin_review_subscription_proof(text,uuid,text,text) to anon,authenticated;
