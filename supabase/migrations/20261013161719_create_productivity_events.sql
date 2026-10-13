-- Append-only ledger of productivity events (RF-009, RNF-006). Nothing other than the
-- trigger below may insert into this table: no INSERT/UPDATE/DELETE policy exists for
-- `authenticated`, so RLS denies those by default even though SELECT is allowed.
create table public.productivity_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- 'task' only for now; extend this check when focus sessions (T-019) land.
  source_type text not null check (source_type in ('task')),
  source_id uuid not null,
  event_type text not null default 'completed' check (event_type in ('completed')),
  -- The source row's own transition timestamp (e.g. tasks.completed_at), not now().
  -- Paired with source_type/source_id this is the stable identifier for "one act of
  -- completion" — see docs/DECISIONS.md.
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, occurred_at)
);

create index productivity_events_owner_id_idx on public.productivity_events (owner_id);
create index productivity_events_source_idx on public.productivity_events (source_type, source_id);

alter table public.productivity_events enable row level security;

create policy "productivity_events_select_own"
  on public.productivity_events for select
  to authenticated
  using (owner_id = auth.uid());

-- Fires only on a real pending/archived -> completed transition (OLD.status IS DISTINCT
-- FROM NEW.status), so retries/duplicate clicks that don't change the row produce no
-- second trigger invocation at all; the unique constraint + ON CONFLICT DO NOTHING is a
-- second, belt-and-suspenders guarantee against the same (source, occurred_at) pair.
-- SECURITY DEFINER: runs as the function owner (not the authenticated caller), which is
-- how it's allowed to insert despite `authenticated` having no INSERT policy.
create or replace function public.record_task_completion_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    insert into public.productivity_events (owner_id, source_type, source_id, event_type, occurred_at)
    values (new.owner_id, 'task', new.id, 'completed', new.completed_at)
    on conflict (source_type, source_id, occurred_at) do nothing;
  end if;
  return new;
end;
$$;

create trigger record_task_completion_event
  after update on public.tasks
  for each row
  execute function public.record_task_completion_event();
