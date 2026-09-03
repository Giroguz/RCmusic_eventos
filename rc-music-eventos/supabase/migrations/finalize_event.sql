-- Finalize an event: keep the song history visible, close new activity,
-- and remove uploaded QR/payment-proof data.

alter table public.events add column if not exists finalized_at timestamptz;

create or replace function public.enforce_event_tip_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare required boolean; finished timestamptz;
begin
  select e.tips_required, e.finalized_at into required, finished from public.events e where e.id = new.event_id;
  if finished is not null then raise exception 'Event finalized'; end if;
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
  if event_row.finalized_at is not null then raise exception 'Event finalized'; end if;
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

-- Replace the DJ event reader to expose the finalization timestamp.
drop function if exists public.dj_get_events(text);
create or replace function public.dj_get_events(p_token text)
returns table(id uuid, code text, name text, dj_name text, contact text, yape_number text, thank_you text, qr_image_url text, tips_required boolean, finalized_at timestamptz, created_at timestamptz, requests jsonb)
language sql security definer set search_path = public as $$
  select e.id, e.code, e.name, e.dj_name, e.contact, e.yape_number, e.thank_you, e.qr_image_url, e.tips_required, e.finalized_at, e.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'video_id', r.video_id, 'title', r.title, 'artist', r.artist, 'thumbnail', r.thumbnail, 'requester', r.requester, 'dedication', r.dedication, 'payment_proof', r.payment_proof, 'likes', r.likes, 'status', r.status, 'created_at', r.created_at) order by r.likes desc, r.created_at asc) from public.song_requests r where r.event_id = e.id), '[]'::jsonb)
  from public.events e join public._dj_access(p_token) d on d.id = e.owner_id order by e.created_at desc
$$;
grant execute on function public.dj_get_events(text) to anon, authenticated;

create or replace function public.dj_finalize_event(p_token text, p_event_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare d public.dj_accounts; finished timestamptz;
begin
  select * into d from public._dj_access(p_token);
  if d.id is null then raise exception 'DJ access denied'; end if;
  update public.events
    set finalized_at = coalesce(finalized_at, now()), qr_image_url = null
    where id = p_event_id and owner_id = d.id
    returning finalized_at into finished;
  if not found then raise exception 'Event not found'; end if;
  update public.song_requests set payment_proof = null where event_id = p_event_id;
  return finished;
end;
$$;
grant execute on function public.dj_finalize_event(text,uuid) to anon, authenticated;
