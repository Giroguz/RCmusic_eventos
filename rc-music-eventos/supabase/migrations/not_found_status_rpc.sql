-- Separate status RPC for the unavailable-song toggle.
-- This keeps the boolean action independent from text enum casting at the client boundary.
create or replace function public.dj_set_request_not_found(p_token text, p_request_id uuid, p_not_found boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a public.dj_accounts;
begin
  select * into a from public._dj_access(p_token);
  if a.id is null then raise exception 'Invalid DJ session'; end if;
  update public.song_requests r
  set status = case when p_not_found then 'not-found'::public.request_status else 'pending'::public.request_status end
  where r.id = p_request_id
    and exists (select 1 from public.events e where e.id = r.event_id and e.owner_id = a.id);
end;
$$;
grant execute on function public.dj_set_request_not_found(text, uuid, boolean) to anon, authenticated;
