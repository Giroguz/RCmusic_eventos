-- RC music_eventos · secure Supabase schema
-- Run this file in Supabase SQL Editor. DJ codes are hashed and never stored in
-- plaintext. Online payments are intentionally NOT implemented: plans are activated
-- manually by the initial administrator until a payment provider is integrated.
create extension if not exists pgcrypto;

do $$ begin create type public.request_status as enum ('pending', 'played', 'not-found'); exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.events drop constraint if exists events_owner_id_fkey;
exception when undefined_table then null; end $$;

create table if not exists public.dj_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email))),
  display_name text not null default 'DJ',
  role text not null default 'dj' check (role in ('dj', 'admin')),
  access_code_hash text,
  approved boolean not null default false,
  blocked boolean not null default false,
  plan_type text not null default 'none' check (plan_type in ('none', 'monthly', 'annual', 'admin')),
  plan_started_at timestamptz,
  plan_expires_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- Initial administrator. Replace/regenerate this bootstrap code immediately after first login.
insert into public.dj_accounts (email, display_name, role, access_code_hash, approved, plan_type)
values ('djgianfrancoromerodechosica@gmail.com', 'DJ Gianfranco', 'admin', encode(digest('RC26ADMIN', 'sha256'), 'hex'), true, 'admin')
on conflict (email) do update set role = 'admin', approved = true, plan_type = 'admin';

create table if not exists public.dj_sessions (
  token_hash text primary key,
  dj_id uuid not null references public.dj_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);
create index if not exists dj_sessions_expiry_idx on public.dj_sessions(expires_at);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  code text not null unique check (code = upper(code)),
  name text not null,
  dj_name text not null default 'DJ',
  contact text,
  yape_number text,
  thank_you text,
  created_at timestamptz not null default now()
);
create table if not exists public.song_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  video_id text not null,
  title text not null,
  artist text not null,
  thumbnail text not null,
  requester text not null check (char_length(requester) between 1 and 60),
  dedication text check (dedication is null or char_length(dedication) <= 150),
  likes integer not null default 0 check (likes >= 0),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now()
);
create table if not exists public.request_likes (
  request_id uuid not null references public.song_requests(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, voter_id)
);
create index if not exists song_requests_event_likes_idx on public.song_requests(event_id, likes desc, created_at asc);

alter table public.dj_accounts enable row level security;
alter table public.dj_sessions enable row level security;
alter table public.events enable row level security;
alter table public.song_requests enable row level security;
alter table public.request_likes enable row level security;
-- No client role gets direct DJ account/session access. SECURITY DEFINER RPCs below
-- are the only route for DJ authentication and administration.
drop policy if exists "public can read events" on public.events;
drop policy if exists "owners can create events" on public.events;
drop policy if exists "owners can update events" on public.events;
drop policy if exists "owners can delete events" on public.events;
create policy "public can read events" on public.events for select using (true);
drop policy if exists "public can read requests" on public.song_requests;
create policy "public can read requests" on public.song_requests for select using (true);
drop policy if exists "signed in users can request" on public.song_requests;
drop policy if exists "owners can update requests" on public.song_requests;
create policy "signed in users can request" on public.song_requests for insert with check (auth.uid() is not null);
drop policy if exists "users can read their likes" on public.request_likes;
create policy "users can read their likes" on public.request_likes for select using (voter_id = auth.uid());

create or replace function public._dj_access(p_token text)
returns public.dj_accounts language sql stable security definer set search_path = public as $$
  select d from public.dj_accounts d join public.dj_sessions s on s.dj_id = d.id
  where s.token_hash = encode(digest(p_token, 'sha256'), 'hex') and s.expires_at > now()
    and d.approved and not d.blocked and (d.role = 'admin' or (d.plan_expires_at is not null and d.plan_expires_at > now()))
  limit 1
$$;
revoke all on function public._dj_access(text) from public, anon, authenticated;

create or replace function public.dj_login(p_email text, p_code text)
returns table(session_token text, dj_id uuid, email text, display_name text, role text, plan_type text, plan_started_at timestamptz, plan_expires_at timestamptz, days_used integer, days_remaining integer, is_active boolean)
language plpgsql security definer set search_path = public as $$
declare d public.dj_accounts; raw_token text; used integer := 0; remaining integer := 0;
begin
  select * into d from public.dj_accounts where email = lower(trim(p_email)) limit 1;
  if d.id is null or d.access_code_hash is null or d.access_code_hash <> encode(digest(trim(p_code), 'sha256'), 'hex') or not d.approved or d.blocked then raise exception 'Invalid DJ credentials'; end if;
  if d.role <> 'admin' and (d.plan_expires_at is null or d.plan_expires_at <= now()) then raise exception 'DJ plan expired'; end if;
  raw_token := encode(gen_random_bytes(32), 'hex');
  insert into public.dj_sessions(token_hash, dj_id) values (encode(digest(raw_token, 'sha256'), 'hex'), d.id);
  update public.dj_accounts set last_login_at = now() where id = d.id;
  if d.role <> 'admin' then used := greatest(0, floor(extract(epoch from least(now(), d.plan_expires_at) - d.plan_started_at) / 86400)::integer); remaining := greatest(0, floor(extract(epoch from d.plan_expires_at - now()) / 86400)::integer); end if;
  return query select raw_token, d.id, d.email, d.display_name, d.role, d.plan_type, d.plan_started_at, d.plan_expires_at, used, remaining, true;
end $$;
grant execute on function public.dj_login(text,text) to anon, authenticated;

create or replace function public.dj_check_access(p_token text)
returns table(dj_id uuid, email text, display_name text, role text, plan_type text, plan_started_at timestamptz, plan_expires_at timestamptz, days_used integer, days_remaining integer, is_active boolean)
language sql security definer set search_path = public as $$
  select d.id, d.email, d.display_name, d.role, d.plan_type, d.plan_started_at, d.plan_expires_at,
    case when d.plan_started_at is null then 0 else greatest(0, floor(extract(epoch from least(now(), d.plan_expires_at) - d.plan_started_at) / 86400)::integer) end,
    case when d.plan_expires_at is null then 0 else greatest(0, floor(extract(epoch from d.plan_expires_at - now()) / 86400)::integer) end,
    true from public._dj_access(p_token) d
$$;
grant execute on function public.dj_check_access(text) to anon, authenticated;

create or replace function public.dj_logout(p_token text) returns void language sql security definer set search_path = public as $$ delete from public.dj_sessions where token_hash = encode(digest(p_token, 'sha256'), 'hex') $$;
grant execute on function public.dj_logout(text) to anon, authenticated;

create or replace function public.dj_get_events(p_token text)
returns table(id uuid, code text, name text, dj_name text, contact text, yape_number text, thank_you text, created_at timestamptz, requests jsonb)
language sql security definer set search_path = public as $$
  select e.id, e.code, e.name, e.dj_name, e.contact, e.yape_number, e.thank_you, e.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'video_id', r.video_id, 'title', r.title, 'artist', r.artist, 'thumbnail', r.thumbnail, 'requester', r.requester, 'dedication', r.dedication, 'likes', r.likes, 'status', r.status, 'created_at', r.created_at) order by r.likes desc, r.created_at asc) from public.song_requests r where r.event_id = e.id), '[]'::jsonb)
  from public.events e join public._dj_access(p_token) d on d.id = e.owner_id order by e.created_at desc
$$;
grant execute on function public.dj_get_events(text) to anon, authenticated;

create or replace function public.dj_create_event(p_token text, p_code text, p_name text, p_dj_name text, p_contact text, p_yape_number text, p_thank_you text)
returns setof public.events language plpgsql security definer set search_path = public as $$ declare d public.dj_accounts; begin select * into d from public._dj_access(p_token); if d.id is null then raise exception 'DJ access denied'; end if; return query insert into public.events(owner_id, code, name, dj_name, contact, yape_number, thank_you) values (d.id, upper(trim(p_code)), trim(p_name), trim(p_dj_name), trim(p_contact), trim(p_yape_number), trim(p_thank_you)) returning *; end $$;
grant execute on function public.dj_create_event(text,text,text,text,text,text,text) to anon, authenticated;

create or replace function public.dj_set_request_status(p_token text, p_request_id uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$ begin if not exists (select 1 from public.events e join public._dj_access(p_token) d on d.id = e.owner_id join public.song_requests r on r.event_id=e.id where r.id=p_request_id) then raise exception 'DJ access denied'; end if; update public.song_requests set status = p_status::public.request_status where id = p_request_id; end $$;
grant execute on function public.dj_set_request_status(text,uuid,text) to anon, authenticated;

create or replace function public.like_request(request_uuid uuid) returns void language plpgsql security definer set search_path = public as $$ declare current_user_id uuid := auth.uid(); begin if current_user_id is null then raise exception 'Authentication required'; end if; insert into public.request_likes(request_id,voter_id) values(request_uuid,current_user_id) on conflict do nothing; if found then update public.song_requests set likes=likes+1 where id=request_uuid; end if; end $$;
grant execute on function public.like_request(uuid) to anon, authenticated;

-- Admin RPCs: all verify the initial admin account by role and active token.
create or replace function public.admin_list_djs(p_token text)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path = public as $$ declare a public.dj_accounts; begin select * into a from public._dj_access(p_token); if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if; return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,case when d.plan_started_at is null then 0 else greatest(0,floor(extract(epoch from least(now(),d.plan_expires_at)-d.plan_started_at)/86400)::integer) end,case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,(d.approved and not d.blocked and (d.role='admin' or d.plan_expires_at>now())),null::text from public.dj_accounts d order by d.created_at desc; end $$;
grant execute on function public.admin_list_djs(text) to anon, authenticated;

create or replace function public.admin_create_dj(p_token text,p_email text,p_display_name text,p_plan_type text)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path = public as $$ declare a public.dj_accounts; d public.dj_accounts; raw_code text; begin select * into a from public._dj_access(p_token); if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if; raw_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10)); insert into public.dj_accounts(email,display_name,access_code_hash,approved,plan_type,plan_started_at,plan_expires_at) values(lower(trim(p_email)),coalesce(nullif(trim(p_display_name),''),'DJ'),encode(digest(raw_code,'sha256'),'hex'),false,case when p_plan_type in ('monthly','annual') then p_plan_type else 'none' end,case when p_plan_type in ('monthly','annual') then now() end,case when p_plan_type='monthly' then now()+interval '30 days' when p_plan_type='annual' then now()+interval '365 days' end) returning * into d; return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,case when d.plan_expires_at is null then 0 else floor(extract(epoch from d.plan_expires_at-now())/86400)::integer end,(d.approved and not d.blocked and d.plan_expires_at>now()),raw_code; end $$;
grant execute on function public.admin_create_dj(text,text,text,text) to anon, authenticated;

drop function if exists public.admin_set_dj_state(text,uuid,boolean,boolean);
create or replace function public.admin_set_dj_state(p_token text,p_dj_id uuid,p_approved boolean,p_blocked boolean) returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text) language plpgsql security definer set search_path = public as $$ declare a public.dj_accounts; d public.dj_accounts; begin select * into a from public._dj_access(p_token); if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if; update public.dj_accounts set approved=p_approved,blocked=p_blocked where id=p_dj_id and role='dj' returning * into d; return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,(d.approved and not d.blocked and d.plan_expires_at>now()),null::text; end $$;
grant execute on function public.admin_set_dj_state(text,uuid,boolean,boolean) to anon, authenticated;

drop function if exists public.admin_set_dj_plan(text,uuid,text);
create or replace function public.admin_set_dj_plan(p_token text,p_dj_id uuid,p_plan_type text) returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text) language plpgsql security definer set search_path = public as $$ declare a public.dj_accounts; d public.dj_accounts; begin select * into a from public._dj_access(p_token); if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' or p_plan_type not in ('none','monthly','annual') then raise exception 'Admin only or invalid plan'; end if; update public.dj_accounts set plan_type=p_plan_type,plan_started_at=case when p_plan_type='none' then null else now() end,plan_expires_at=case when p_plan_type='monthly' then now()+interval '30 days' when p_plan_type='annual' then now()+interval '365 days' else null end where id=p_dj_id and role='dj' returning * into d; return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,(d.approved and not d.blocked and d.plan_expires_at>now()),null::text; end $$;
grant execute on function public.admin_set_dj_plan(text,uuid,text) to anon, authenticated;

create or replace function public.admin_regenerate_code(p_token text,p_dj_id uuid)
returns table(id uuid,email text,display_name text,role text,approved boolean,blocked boolean,plan_type text,plan_started_at timestamptz,plan_expires_at timestamptz,days_used integer,days_remaining integer,is_active boolean,generated_code text)
language plpgsql security definer set search_path = public as $$ declare a public.dj_accounts; d public.dj_accounts; raw_code text; begin select * into a from public._dj_access(p_token); if coalesce(a.role,'') <> 'admin' or a.email <> 'djgianfrancoromerodechosica@gmail.com' then raise exception 'Admin only'; end if; raw_code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10)); update public.dj_accounts set access_code_hash=encode(digest(raw_code,'sha256'),'hex') where id=p_dj_id and (role='dj' or email='djgianfrancoromerodechosica@gmail.com') returning * into d; return query select d.id,d.email,d.display_name,d.role,d.approved,d.blocked,d.plan_type,d.plan_started_at,d.plan_expires_at,0,case when d.plan_expires_at is null then 0 else greatest(0,floor(extract(epoch from d.plan_expires_at-now())/86400)::integer) end,(d.approved and not d.blocked and d.plan_expires_at>now()),raw_code; end $$;
grant execute on function public.admin_regenerate_code(text,uuid) to anon, authenticated;

alter table public.song_requests replica identity full;
do $$ begin alter publication supabase_realtime add table public.song_requests; exception when duplicate_object then null; end $$;

-- One-day demo: one trial per email, recover active code, clear expired codes.
alter table public.dj_accounts add column if not exists demo_code text;
alter table public.dj_accounts add column if not exists demo_used_at timestamptz;
create or replace function public.cleanup_expired_demo_codes() returns integer language plpgsql security definer set search_path=public as $$ declare removed integer; begin update public.dj_accounts set demo_code=null, access_code_hash=null where plan_type='trial' and plan_expires_at is not null and plan_expires_at<=now() and (demo_code is not null or access_code_hash is not null); get diagnostics removed=row_count; return removed; end $$;
revoke all on function public.cleanup_expired_demo_codes() from public,anon,authenticated;
create or replace function public.dj_start_trial(p_email text,p_display_name text) returns table(email text,display_name text,generated_code text,plan_expires_at timestamptz) language plpgsql security definer set search_path=public as $$ declare raw_code text; normalized_email text; existing public.dj_accounts%rowtype; new_id uuid; begin normalized_email:=lower(trim(p_email)); if normalized_email='' or position('@' in normalized_email)<2 then raise exception 'Valid email required'; end if; select a.* into existing from public.dj_accounts a where a.email=normalized_email limit 1; if existing.id is not null then if existing.plan_type='trial' and existing.demo_code is not null and existing.plan_expires_at>now() then return query select existing.email,existing.display_name,existing.demo_code,existing.plan_expires_at; return; end if; raise exception 'Demo already used or email already registered'; end if; raw_code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10)); insert into public.dj_accounts(email,display_name,access_code_hash,demo_code,demo_used_at,approved,blocked,plan_type,plan_started_at,plan_expires_at) values(normalized_email,coalesce(nullif(trim(p_display_name),''),'DJ Demo'),encode(digest(raw_code,'sha256'),'hex'),raw_code,now(),true,false,'trial',now(),now()+interval '1 day') returning id into new_id; return query select a.email,a.display_name,a.demo_code,a.plan_expires_at from public.dj_accounts a where a.id=new_id; end $$;
grant execute on function public.dj_start_trial(text,text) to anon,authenticated;
