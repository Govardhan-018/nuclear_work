-- Maya backend foundation
-- Version 1: per-user tables, RLS, server timestamps, and an ordered sync ledger.
--
-- The client may keep working offline. The sync layer will use sync_events as
-- its durable change cursor rather than trusting device clocks.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.tasks (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text not null default '',
  category text not null default 'Personal',
  priority text not null default 'Medium',
  due_at timestamptz,
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.habits (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'habits',
  cadence text not null default 'Daily',
  target_per_week smallint not null default 7,
  tone text not null default 'teal',
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.habit_logs (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id text not null,
  date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.books (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'book',
  title text not null,
  subtitle text not null default '',
  author text not null,
  pages integer not null default 0,
  current_page integer not null default 0,
  status text not null default 'Want to read',
  cover text not null default '',
  accent text not null default 'sage',
  started_at timestamptz,
  finished_at timestamptz,
  rating smallint,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.reading_sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text,
  date date not null,
  started_at timestamptz not null,
  minutes integer not null default 0,
  pages_read integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.subjects (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null,
  tone text not null default 'teal',
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.focus_sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id text,
  book_id text,
  subject text not null,
  type text not null default 'Academic',
  mode text not null default 'Timer',
  date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  seconds integer not null default 0,
  completed boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.nutrition_logs (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  protein text,
  carbs text,
  junk text,
  vegetables boolean,
  fruit boolean,
  water smallint not null default 0,
  energy text,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.meals (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null default 'Snack',
  name text not null,
  portion text not null default '',
  time text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.activities (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual',
  strava_id bigint,
  name text not null,
  type text not null,
  date date not null,
  started_at timestamptz not null,
  distance_m double precision not null default 0,
  moving_time_s integer not null default 0,
  elapsed_time_s integer not null default 0,
  elevation_m double precision not null default 0,
  average_speed double precision not null default 0,
  average_heartrate double precision,
  max_heartrate double precision,
  calories double precision,
  polyline text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.events (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  start_time text not null default '09:00',
  end_time text not null default '10:00',
  category text not null default 'Personal',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz,
  remote_id text,
  primary key (user_id, id)
);

create table public.ai_messages (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text not null,
  role text not null,
  text text not null,
  model text,
  created_at timestamptz not null default now(),
  failed boolean not null default false,
  primary key (user_id, id)
);

create table public.settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- One ordered cursor across all entity types. Payload is a server snapshot,
-- which lets a device catch up without relying on client clock precision.
create table public.sync_events (
  seq bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  record_id text not null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  payload jsonb,
  occurred_at timestamptz not null default now()
);

create index sync_events_user_seq_idx on public.sync_events (user_id, seq);
create index sync_events_user_table_idx on public.sync_events (user_id, table_name, record_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tasks', 'habits', 'habit_logs', 'books', 'reading_sessions', 'subjects',
    'focus_sessions', 'nutrition_logs', 'meals', 'activities', 'events'
  ] loop
    execute format('create index %I on public.%I (user_id, updated_at)', table_name || '_user_updated_idx', table_name);
    execute format('create index %I on public.%I (user_id, deleted)', table_name || '_user_deleted_idx', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;

  foreach table_name in array array['ai_messages'] loop
    execute format('create index %I on public.%I (user_id, conversation_id, created_at)', table_name || '_conversation_idx', table_name);
  end loop;

  execute 'create trigger settings_set_updated_at before update on public.settings for each row execute function public.set_updated_at()';
end $$;

create or replace function public.record_sync_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $
declare
  record_id text;
begin
  if tg_op = 'DELETE' then
    record_id := case when tg_table_name = 'settings' then old.key else old.id end;
    insert into public.sync_events (user_id, table_name, record_id, operation, payload)
    values (old.user_id, tg_table_name, record_id, 'delete', to_jsonb(old));
    return old;
  end if;

  record_id := case when tg_table_name = 'settings' then new.key else new.id end;
  insert into public.sync_events (user_id, table_name, record_id, operation, payload)
  values (
    new.user_id,
    tg_table_name,
    record_id,
    case when tg_op = 'INSERT' then 'insert' else 'update' end,
    to_jsonb(new)
  );
  return new;
end;
$;

do $
declare
  table_name text;
begin
  foreach table_name in array array[
    'tasks', 'habits', 'habit_logs', 'books', 'reading_sessions', 'subjects',
    'focus_sessions', 'nutrition_logs', 'meals', 'activities', 'events',
    'ai_messages', 'settings'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.record_sync_event()',
      table_name || '_record_sync_event',
      table_name
    );
  end loop;
end $$;

-- All application tables are private to the authenticated owner. Grants are
-- intentionally limited; sync_events is read-only to clients.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tasks', 'habits', 'habit_logs', 'books', 'reading_sessions', 'subjects',
    'focus_sessions', 'nutrition_logs', 'meals', 'activities', 'events',
    'ai_messages', 'settings'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_owner_policy',
      table_name
    );
  end loop;
end $$;

alter table public.sync_events enable row level security;
create policy sync_events_owner_read on public.sync_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.sync_events from anon, authenticated;
grant select on public.sync_events to authenticated;
