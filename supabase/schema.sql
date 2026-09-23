-- myre studies. Apply once to a new Supabase project in the SQL editor.
-- Keep studies private until the three crew emails are added to myre_editors.

create table public.myre_editors (
  email text primary key check (email = lower(email) and length(email) <= 320)
);

create table public.myre_videos (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (length(trim(title)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.myre_notes (
  id uuid primary key default gen_random_uuid(),
  folder text not null check (folder in ('learn', 'test', 'make')),
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null check (length(trim(body)) between 1 and 20000),
  created_at timestamptz not null default now()
);

create table public.myre_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  assignee text not null check (assignee in ('rajin', 'samiyeel', 'saumik')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  created_at timestamptz not null default now()
);

create table public.myre_checks (
  item_key text not null check (length(item_key) between 1 and 100),
  person_id text not null check (person_id in ('rajin', 'samiyeel', 'saumik')),
  checked boolean not null default false,
  primary key (item_key, person_id)
);

-- The only table the daily server-side heartbeat touches. Never expose it to browsers.
create table public.myre_heartbeat (
  id integer primary key check (id = 1),
  last_ping_at timestamptz not null default now()
);
insert into public.myre_heartbeat (id) values (1);

alter table public.myre_editors enable row level security;
alter table public.myre_videos enable row level security;
alter table public.myre_notes enable row level security;
alter table public.myre_tasks enable row level security;
alter table public.myre_checks enable row level security;
alter table public.myre_heartbeat enable row level security;

revoke all on table public.myre_editors from anon, authenticated;
revoke all on table public.myre_videos, public.myre_notes,
  public.myre_tasks, public.myre_checks from anon, authenticated;
revoke all on table public.myre_heartbeat from anon, authenticated;

-- This function reads the private editor list without exposing the list itself.
create function public.myre_can_edit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.myre_editors
      where email = lower((select auth.jwt()) ->> 'email')
    );
$$;

revoke all on function public.myre_can_edit() from public, anon, authenticated;
grant execute on function public.myre_can_edit() to authenticated;

grant select on table public.myre_videos, public.myre_notes,
  public.myre_tasks, public.myre_checks to authenticated;
grant insert, update, delete on table public.myre_videos, public.myre_notes,
  public.myre_tasks, public.myre_checks to authenticated;

create policy myre_videos_read on public.myre_videos
  for select to authenticated using ((select public.myre_can_edit()));
create policy myre_videos_add on public.myre_videos
  for insert to authenticated with check ((select public.myre_can_edit()));
create policy myre_videos_change on public.myre_videos
  for update to authenticated using ((select public.myre_can_edit()))
  with check ((select public.myre_can_edit()));
create policy myre_videos_remove on public.myre_videos
  for delete to authenticated using ((select public.myre_can_edit()));

create policy myre_notes_read on public.myre_notes
  for select to authenticated using ((select public.myre_can_edit()));
create policy myre_notes_add on public.myre_notes
  for insert to authenticated with check ((select public.myre_can_edit()));
create policy myre_notes_change on public.myre_notes
  for update to authenticated using ((select public.myre_can_edit()))
  with check ((select public.myre_can_edit()));
create policy myre_notes_remove on public.myre_notes
  for delete to authenticated using ((select public.myre_can_edit()));

create policy myre_tasks_read on public.myre_tasks
  for select to authenticated using ((select public.myre_can_edit()));
create policy myre_tasks_add on public.myre_tasks
  for insert to authenticated with check ((select public.myre_can_edit()));
create policy myre_tasks_change on public.myre_tasks
  for update to authenticated using ((select public.myre_can_edit()))
  with check ((select public.myre_can_edit()));
create policy myre_tasks_remove on public.myre_tasks
  for delete to authenticated using ((select public.myre_can_edit()));

create policy myre_checks_read on public.myre_checks
  for select to authenticated using ((select public.myre_can_edit()));
create policy myre_checks_add on public.myre_checks
  for insert to authenticated with check ((select public.myre_can_edit()));
create policy myre_checks_change on public.myre_checks
  for update to authenticated using ((select public.myre_can_edit()))
  with check ((select public.myre_can_edit()));
create policy myre_checks_remove on public.myre_checks
  for delete to authenticated using ((select public.myre_can_edit()));
