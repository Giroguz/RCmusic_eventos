-- Store the developer's Yape QR for subscription payments.
create table if not exists public.subscription_settings (
  id boolean primary key default true check (id = true),
  yape_qr text,
  updated_at timestamptz not null default now()
);
insert into public.subscription_settings(id) values (true) on conflict (id) do nothing;

create or replace function public.admin_get_subscription_qr(p_token text)
returns text language plpgsql security definer set search_path=public as $$
declare a public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  return (select yape_qr from public.subscription_settings where id=true);
end $$;
grant execute on function public.admin_get_subscription_qr(text) to anon,authenticated;

create or replace function public.admin_set_subscription_qr(p_token text,p_qr_image text)
returns text language plpgsql security definer set search_path=public as $$
declare a public.dj_accounts; result text;
begin
  select * into a from public._dj_access(p_token);
  if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if;
  if p_qr_image is not null and length(p_qr_image) > 1200000 then raise exception 'QR image too large'; end if;
  insert into public.subscription_settings(id,yape_qr,updated_at) values(true,nullif(p_qr_image,''),now())
    on conflict (id) do update set yape_qr=excluded.yape_qr,updated_at=now()
    returning yape_qr into result;
  return result;
end $$;
grant execute on function public.admin_set_subscription_qr(text,text) to anon,authenticated;

create or replace function public.get_subscription_qr()
returns text language sql security definer set search_path=public as $$
  select yape_qr from public.subscription_settings where id=true limit 1;
$$;
grant execute on function public.get_subscription_qr() to anon,authenticated;
