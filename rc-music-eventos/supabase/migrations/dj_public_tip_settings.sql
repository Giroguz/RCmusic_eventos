-- Allow DJs to edit the public tip message from Panel DJ > Ajustes.
-- The message is shown to attendees together with the payment QR.

create or replace function public.dj_update_event_info(
  p_token text,
  p_event_id uuid,
  p_dj_name text,
  p_yape_number text,
  p_contact text,
  p_thank_you text
)
returns setof public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.dj_accounts;
begin
  select * into d from public._dj_access(p_token);
  if d.id is null then raise exception 'DJ access denied'; end if;

  return query
    update public.events
       set dj_name = coalesce(nullif(trim(p_dj_name), ''), 'DJ'),
           yape_number = left(trim(coalesce(p_yape_number, '')), 120),
           contact = left(trim(coalesce(p_contact, '')), 120),
           thank_you = left(trim(coalesce(p_thank_you, '')), 150)
     where id = p_event_id and owner_id = d.id
     returning *;

  if not found then raise exception 'Event not found'; end if;
end;
$$;

grant execute on function public.dj_update_event_info(text, uuid, text, text, text, text) to anon, authenticated;
