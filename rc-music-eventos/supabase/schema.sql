-- RC music_eventos · Supabase schema
-- Ejecutar una vez desde Supabase > SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.request_status as enum ('pending', 'played', 'not-found');
exception when duplicate_object then null;
end $$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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

alter table public.events enable row level security;
alter table public.song_requests enable row level security;
alter table public.request_likes enable row level security;

drop policy if exists "public can read events" on public.events;
create policy "public can read events" on public.events for select using (true);

drop policy if exists "owners can create events" on public.events;
create policy "owners can create events" on public.events for insert with check (owner_id = auth.uid());

drop policy if exists "owners can update events" on public.events;
create policy "owners can update events" on public.events for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "owners can delete events" on public.events;
create policy "owners can delete events" on public.events for delete using (owner_id = auth.uid());

drop policy if exists "public can read requests" on public.song_requests;
create policy "public can read requests" on public.song_requests for select using (true);

drop policy if exists "signed in users can request" on public.song_requests;
create policy "signed in users can request" on public.song_requests for insert with check (auth.uid() is not null);

drop policy if exists "owners can update requests" on public.song_requests;
create policy "owners can update requests" on public.song_requests for update using (
  exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid())
);

drop policy if exists "users can read their likes" on public.request_likes;
create policy "users can read their likes" on public.request_likes for select using (voter_id = auth.uid());

create or replace function public.like_request(request_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  insert into public.request_likes(request_id, voter_id)
  values (request_uuid, current_user_id)
  on conflict (request_id, voter_id) do nothing;
  if found then
    update public.song_requests set likes = likes + 1 where id = request_uuid;
  end if;
end;
$$;

grant execute on function public.like_request(uuid) to anon, authenticated;

-- Habilitar Realtime para la cola.
alter table public.song_requests replica identity full;
-- Si el publication ya contiene la tabla, esta línea puede omitirse.
do $$ begin
  alter publication supabase_realtime add table public.song_requests;
exception when duplicate_object then null;
end $$;
