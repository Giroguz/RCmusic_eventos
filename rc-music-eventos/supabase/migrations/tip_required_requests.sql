-- Optional tip gate for song requests. The DJ enables this per event.
-- Guests see the existing payment QR, upload a proof, and requests stay
-- awaiting-payment until the DJ approves them.

alter table public.events add column if not exists tips_required boolean not null default false;
alter table public.song_requests add column if not exists payment_proof text;

alter type public.request_status add value if not exists 'awaiting-payment';
alter type public.request_status add value if not exists 'payment-rejected';

alter table public.song_requests drop constraint if exists song_requests_status_check;
alter table public.song_requests add constraint song_requests_status_check check (status::text in ('pending', 'played', 'not-found', 'awaiting-payment', 'payment-rejected'));
alter table public.song_requests drop constraint if exists song_requests_payment_proof_check;
alter table public.song_requests add constraint song_requests_payment_proof_check check (payment_proof is null or char_length(payment_proof) <= 900000);

-- Enforce the gate even if somebody bypasses the frontend and inserts directly.
create or replace function public.enforce_event_tip_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare required boolean;
begin
  select e.tips_required into required from public.events e where e.id = new.event_id;
  if coalesce(required, false) then
    if nullif(trim(coalesce(new.payment_proof, '')), '') is null then
      raise exception 'Payment proof required';
    end if;
    new.status := 'awaiting-payment'::public.request_status;
  else
    new.status := 'pending'::public.request_status;
  end if;
  return new;
end;
$$;
drop trigger if exists song_requests_tip_gate on public.song_requests;
create trigger song_requests_tip_gate before insert on public.song_requests for each row execute function public.enforce_event_tip_gate();

create or replace function public.submit_song_request(
  p_event_id uuid,
  p_video_id text,
  p_title text,
  p_artist text,
  p_thumbnail text,
  p_requester text,
  p_dedication text,
  p_payment_proof text
)
returns setof public.song_requests
language plpgsql security definer set search_path = public as $$
declare event_row public.events;
begin
  select * into event_row from public.events where id = p_event_id;
  if event_row.id is null then raise exception 'Event not found'; end if;
  if coalesce(event_row.tips_required, false) and nullif(trim(coalesce(p_payment_proof, '')), '') is null then
    raise exception 'Payment proof required';
  end if;
  if char_length(coalesce(p_title, '')) = 0 or char_length(coalesce(p_title, '')) > 200 then raise exception 'Invalid song title'; end if;
  if char_length(coalesce(p_artist, '')) = 0 or char_length(coalesce(p_artist, '')) > 200 then raise exception 'Invalid artist'; end if;
  return query
    insert into public.song_requests(event_id, video_id, title, artist, thumbnail, requester, dedication, payment_proof)
    values (p_event_id, trim(p_video_id), trim(p_title), trim(p_artist), trim(p_thumbnail), coalesce(nullif(trim(p_requester), ''), 'Anónimo'), nullif(trim(p_dedication), ''), nullif(trim(p_payment_proof), ''))
    returning *;
end;
$$;
grant execute on function public.submit_song_request(uuid,text,text,text,text,text,text,text) to anon, authenticated;

-- Replace the RPC because its return type now includes the event-level setting.
drop function if exists public.dj_get_events(text);
create or replace function public.dj_get_events(p_token text)
returns table(id uuid, code text, name text, dj_name text, contact text, yape_number text, thank_you text, qr_image_url text, tips_required boolean, created_at timestamptz, requests jsonb)
language sql security definer set search_path = public as $$
  select e.id, e.code, e.name, e.dj_name, e.contact, e.yape_number, e.thank_you, e.qr_image_url, e.tips_required, e.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'video_id', r.video_id, 'title', r.title, 'artist', r.artist, 'thumbnail', r.thumbnail, 'requester', r.requester, 'dedication', r.dedication, 'payment_proof', r.payment_proof, 'likes', r.likes, 'status', r.status, 'created_at', r.created_at) order by r.likes desc, r.created_at asc) from public.song_requests r where r.event_id = e.id), '[]'::jsonb)
  from public.events e join public._dj_access(p_token) d on d.id = e.owner_id order by e.created_at desc
$$;
grant execute on function public.dj_get_events(text) to anon, authenticated;

create or replace function public.dj_update_event_tip_settings(p_token text, p_event_id uuid, p_tips_required boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare d public.dj_accounts;
begin
  select * into d from public._dj_access(p_token);
  if d.id is null then raise exception 'DJ access denied'; end if;
  update public.events set tips_required = coalesce(p_tips_required, false) where id = p_event_id and owner_id = d.id;
  if not found then raise exception 'Event not found'; end if;
  return coalesce(p_tips_required, false);
end;
$$;
grant execute on function public.dj_update_event_tip_settings(text,uuid,boolean) to anon, authenticated;

-- Keep the prior RPC usable for status actions while accepting the new states.
create or replace function public.dj_set_request_status(p_token text, p_request_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('pending', 'played', 'not-found', 'awaiting-payment', 'payment-rejected') then raise exception 'Invalid request status'; end if;
  if not exists (select 1 from public.events e join public._dj_access(p_token) d on d.id = e.owner_id join public.song_requests r on r.event_id=e.id where r.id=p_request_id) then raise exception 'DJ access denied'; end if;
  update public.song_requests set status = p_status::public.request_status where id = p_request_id;
end;
$$;
grant execute on function public.dj_set_request_status(text,uuid,text) to anon, authenticated;
