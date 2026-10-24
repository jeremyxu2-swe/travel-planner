-- Travel Planner database schema.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.

-- Every row belongs to one signed-in user (user_id). Row-level security (below)
-- makes sure people can only read and change their own rows.

create table if not exists public.trips (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id          text not null,
  name        text not null,
  destination text not null default '',
  start_date  date,
  end_date    date,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.activities (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  trip_id    text not null,
  date       date,
  start_time text,          -- "HH:MM", 24-hour
  end_time   text,
  title      text not null,
  category   text not null default 'other',
  location   text not null default '',
  notes      text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, trip_id) references public.trips (user_id, id) on delete cascade
);

create table if not exists public.todos (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  trip_id    text not null,
  text       text not null,
  done       boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, trip_id) references public.trips (user_id, id) on delete cascade
);

-- Hotels / places you stay, spanning several days (added in v0.5).
create table if not exists public.stays (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id             text not null,
  trip_id        text not null,
  name           text not null,
  location       text not null default '',
  check_in       date not null,
  check_in_time  text,          -- "HH:MM", 24-hour
  check_out      date not null,
  check_out_time text,
  notes          text not null default '',
  updated_at     timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, trip_id) references public.trips (user_id, id) on delete cascade
);

-- Which city/country you're in on which days (added in v0.6).
create table if not exists public.places (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id           text not null,
  trip_id      text not null,
  city         text not null,
  country      text not null default '',
  country_code text not null default '',   -- e.g. JP
  code         text not null default '',   -- short label, e.g. TYO
  start_date   date not null,
  end_date     date not null,
  updated_at   timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, trip_id) references public.trips (user_id, id) on delete cascade
);
create index if not exists places_trip_idx on public.places (user_id, trip_id);

-- Your own activity types: name, symbol and color (added in v0.11).
-- Until you change one, the app uses its seven defaults and saves nothing here.
create table if not exists public.categories (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  label      text not null,
  icon       text not null default 'pin',
  color      text not null default 'gray',
  position   integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Map position of a place picked from search (added in v0.5).
-- v0.21: notes for each trip.
alter table public.trips add column if not exists notes text not null default '';
alter table public.activities add column if not exists lat double precision;
alter table public.activities add column if not exists lng double precision;

create index if not exists stays_trip_idx on public.stays (user_id, trip_id);
create index if not exists activities_trip_idx on public.activities (user_id, trip_id);
create index if not exists todos_trip_idx on public.todos (user_id, trip_id);

-- Keep updated_at current on every change.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trips_touch on public.trips;
create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();
drop trigger if exists activities_touch on public.activities;
create trigger activities_touch before update on public.activities
  for each row execute function public.touch_updated_at();
drop trigger if exists stays_touch on public.stays;
create trigger stays_touch before update on public.stays
  for each row execute function public.touch_updated_at();
drop trigger if exists places_touch on public.places;
create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();
drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
drop trigger if exists todos_touch on public.todos;
create trigger todos_touch before update on public.todos
  for each row execute function public.touch_updated_at();

-- Sharing (added in v0.15): the owner of a trip can invite people by email to
-- view it ("viewer") or change it ("editor"). Invites work before the person has
-- an account: they see the trip once they sign in with that (confirmed) email.
create table if not exists public.trip_members (
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id     text not null,
  email       text not null check (email = lower(email)),
  role        text not null check (role in ('viewer', 'editor')),
  owner_email text not null default '',
  created_at  timestamptz not null default now(),
  primary key (owner_id, trip_id, email),
  foreign key (owner_id, trip_id) references public.trips (user_id, id) on delete cascade
);
create index if not exists trip_members_email_idx on public.trip_members (email);
-- The owner's display name, shown to the people a trip is shared with (added in v0.17).
alter table public.trip_members add column if not exists owner_name text not null default '';

-- Your access to someone's trip: 'owner', 'editor', 'viewer' or null.
create or replace function public.trip_role(p_owner uuid, p_trip text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_owner = auth.uid() then 'owner'
    else (select m.role from public.trip_members m
          where m.owner_id = p_owner and m.trip_id = p_trip
            and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
          limit 1)
  end
$$;

-- Row-level security: you see and change your own rows, plus the trips shared
-- with you (read-only for viewers; editors can change everything but can't
-- delete the trip itself or manage who it's shared with).
alter table public.trips enable row level security;
alter table public.activities enable row level security;
alter table public.todos enable row level security;
alter table public.stays enable row level security;
alter table public.places enable row level security;
alter table public.categories enable row level security;
alter table public.trip_members enable row level security;

-- Older versions had one "own ..." policy per table; replaced by the ones below.
drop policy if exists "own trips" on public.trips;
drop policy if exists "own activities" on public.activities;
drop policy if exists "own todos" on public.todos;
drop policy if exists "own stays" on public.stays;
drop policy if exists "own places" on public.places;
drop policy if exists "own categories" on public.categories;

-- trips
drop policy if exists "trips read" on public.trips;
create policy "trips read" on public.trips for select to authenticated
  using (user_id = auth.uid() or public.trip_role(user_id, id) is not null);
drop policy if exists "trips add" on public.trips;
create policy "trips add" on public.trips for insert to authenticated
  with check (user_id = auth.uid() or public.trip_role(user_id, id) = 'editor');
drop policy if exists "trips change" on public.trips;
create policy "trips change" on public.trips for update to authenticated
  using (user_id = auth.uid() or public.trip_role(user_id, id) = 'editor')
  with check (user_id = auth.uid() or public.trip_role(user_id, id) = 'editor');
drop policy if exists "trips delete" on public.trips;
create policy "trips delete" on public.trips for delete to authenticated
  using (user_id = auth.uid());

-- activities, todos, stays, places: anything in a trip you can see / edit
do $$
declare t text;
begin
  foreach t in array array['activities', 'todos', 'stays', 'places'] loop
    execute format('drop policy if exists "%1$s read" on public.%1$I', t);
    execute format('create policy "%1$s read" on public.%1$I for select to authenticated
      using (user_id = auth.uid() or public.trip_role(user_id, trip_id) is not null)', t);
    execute format('drop policy if exists "%1$s write" on public.%1$I', t);
    execute format('create policy "%1$s write" on public.%1$I for all to authenticated
      using (user_id = auth.uid() or public.trip_role(user_id, trip_id) = ''editor'')
      with check (user_id = auth.uid() or public.trip_role(user_id, trip_id) = ''editor'')', t);
  end loop;
end $$;

-- activity types: yours; and read-only, the types of people who shared a trip with you
drop policy if exists "categories read" on public.categories;
create policy "categories read" on public.categories for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.trip_members m
    where m.owner_id = categories.user_id and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))));
drop policy if exists "categories write" on public.categories;
create policy "categories write" on public.categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- who a trip is shared with: the owner manages it; people invited can see
-- their own invite and remove themselves (leave the trip)
drop policy if exists "members owner" on public.trip_members;
create policy "members owner" on public.trip_members for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "members self read" on public.trip_members;
create policy "members self read" on public.trip_members for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists "members self leave" on public.trip_members;
create policy "members self leave" on public.trip_members for delete to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Delete your own account (added in v0.17). Removes your login and, through the
-- "on delete cascade" links above, all your trips, activities, to-dos, hotels,
-- cities, activity types and the people your trips were shared with. Trips other
-- people shared with you are only unlinked from you, never deleted.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  delete from public.trip_members where email = my_email;
  delete from auth.users where id = me;
end
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
