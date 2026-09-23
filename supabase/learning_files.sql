-- Additive migration for branch-specific Markdown notebooks. Existing studies data is untouched.
create table if not exists public.myre_learning_files (
  branch text not null check (length(branch) between 1 and 255),
  path text not null check (length(path) between 1 and 500),
  author text not null check (author in ('rajin', 'samiyeel', 'saumik')),
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 100000),
  commit_sha text not null check (commit_sha ~ '^[a-f0-9]{40}$'),
  updated_at timestamptz not null default now(),
  primary key (branch, path)
);

alter table public.myre_learning_files enable row level security;
revoke all on table public.myre_learning_files from public, anon, authenticated;
grant select, insert, update, delete on table public.myre_learning_files to service_role;

create or replace function public.myre_sync_learning_files(p_branch text, p_files jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  file_count integer;
begin
  if p_branch is null or length(p_branch) not between 1 and 255
    or jsonb_typeof(p_files) is distinct from 'array'
    or jsonb_array_length(p_files) > 200 then
    raise exception 'Invalid notebook snapshot';
  end if;

  select count(*) into file_count from jsonb_array_elements(p_files);
  if file_count <> (
    select count(distinct entry ->> 'path') from jsonb_array_elements(p_files) as entry
  ) then
    raise exception 'Duplicate notebook path';
  end if;

  insert into public.myre_learning_files (branch, path, author, title, body, commit_sha, updated_at)
  select p_branch, item.path, item.author, item.title, item.body, item.commit_sha, now()
  from jsonb_to_recordset(p_files) as item(
    path text, author text, title text, body text, commit_sha text
  )
  on conflict (branch, path) do update set
    author = excluded.author,
    title = excluded.title,
    body = excluded.body,
    commit_sha = excluded.commit_sha,
    updated_at = now();

  delete from public.myre_learning_files as stored
  where stored.branch = p_branch
    and not exists (
      select 1 from jsonb_array_elements(p_files) as entry
      where entry ->> 'path' = stored.path
    );

  return file_count;
end;
$$;

revoke all on function public.myre_sync_learning_files(text, jsonb) from public, anon, authenticated;
grant execute on function public.myre_sync_learning_files(text, jsonb) to service_role;
