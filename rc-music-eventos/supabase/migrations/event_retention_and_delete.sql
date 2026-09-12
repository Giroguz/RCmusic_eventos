-- Manual deletion and seven-day event retention for DJ-owned events.
drop function if exists public.dj_delete_event(text,uuid);
create or replace function public.dj_delete_event(p_token text, p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.dj_accounts;
begin
  select * into d from public._dj_access(p_token);
  if d.id is null then raise exception 'DJ access denied'; end if;
  delete from public.events where id = p_event_id and owner_id = d.id;
  if not found then raise exception 'Event not found'; end if;
end;
$$;
grant execute on function public.dj_delete_event(text,uuid) to anon, authenticated;

-- Cleanup is performed whenever the DJ event list is opened/refreshed.
drop function if exists public.dj_get_events(text);
create or replace function public.dj_get_events(p_token text)
returns table(id uuid, code text, name text, dj_name text, contact text, yape_number text, thank_you text, qr_image_url text, tips_required boolean, finalized_at timestamptz, created_at timestamptz, requests jsonb)
language plpgsql security definer set search_path = public as $$
declare d public.dj_accounts;
begin
  select * into d from public._dj_access(p_token);
  if d.id is null then raise exception 'DJ access denied'; end if;
  delete from public.events where owner_id = d.id and created_at <= now() - interval '7 days';
  return query
    select e.id, e.code, e.name, e.dj_name, e.contact, e.yape_number, e.thank_you, e.qr_image_url, e.tips_required, e.finalized_at, e.created_at,
      coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'video_id', r.video_id, 'title', r.title, 'artist', r.artist, 'thumbnail', r.thumbnail, 'requester', r.requester, 'dedication', r.dedication, 'likes', r.likes, 'status', r.status, 'created_at', r.created_at) order by r.likes desc, r.created_at asc) from public.song_requests r where r.event_id = e.id), '[]'::jsonb)
    from public.events e where e.owner_id = d.id order by e.created_at desc;
end;
$$;
grant execute on function public.dj_get_events(text) to anon, authenticated;
