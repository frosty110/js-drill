-- 001_user_progress.sql
--
-- One row per authenticated user, holding the entire jsdrill.progress.v1 blob
-- as a single JSONB column. Sync = pull row → merge per-field → upsert row.
--
-- Run via Supabase Dashboard → SQL Editor → New Query → paste → Run.
-- Safe to re-run: every statement is idempotent.

create table if not exists public.user_progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Touch updated_at on every UPDATE so clients can detect changes pushed by
-- other devices via a cheap timestamp comparison.
create or replace function public.touch_user_progress()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists user_progress_touch on public.user_progress;
create trigger user_progress_touch
  before update on public.user_progress
  for each row execute function public.touch_user_progress();

-- Row-Level Security: each auth.uid() can only touch their own row.
-- The anon key shipped to the browser is harmless because of these policies.
alter table public.user_progress enable row level security;

drop policy if exists "own row select" on public.user_progress;
create policy "own row select"
  on public.user_progress for select
  using (auth.uid() = user_id);

drop policy if exists "own row insert" on public.user_progress;
create policy "own row insert"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "own row update" on public.user_progress;
create policy "own row update"
  on public.user_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own row delete" on public.user_progress;
create policy "own row delete"
  on public.user_progress for delete
  using (auth.uid() = user_id);
