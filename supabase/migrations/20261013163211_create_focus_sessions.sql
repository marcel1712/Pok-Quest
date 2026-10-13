-- `status` only persists the states that need a server round-trip. `awaiting_confirmation`
-- is a DERIVED state (status = 'running' and elapsed >= planned_duration_seconds),
-- computed client-side from these timestamps — see src/features/focus/domain.ts. This
-- keeps RF-015/RF-016 honest: no extra state transition is needed just to notice time
-- is up, and completion still requires an explicit confirm.
--
-- `paused_at` / `accumulated_pause_seconds` track mid-session pause/resume (RF-014), not
-- the between-cycles rest break (RF-018, T-020) — those are unrelated concepts that
-- share the word "pausa" in Portuguese.
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  planned_duration_seconds integer not null check (planned_duration_seconds between 60 and 7200),
  status text not null default 'running'
    check (status in ('running', 'paused', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  accumulated_pause_seconds integer not null default 0 check (accumulated_pause_seconds >= 0),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- paused_at is set if and only if currently paused; ended_at is set if and only if the
  -- session reached a terminal state.
  check ((status = 'paused') = (paused_at is not null)),
  check ((status in ('completed', 'cancelled')) = (ended_at is not null))
);

create index focus_sessions_owner_id_idx on public.focus_sessions (owner_id);

-- RF-019: at most one non-terminal session per user, enforced by the database itself —
-- a second concurrent "start" from another tab/device fails here, not just in the UI.
create unique index one_active_focus_session_per_owner
  on public.focus_sessions (owner_id)
  where status in ('running', 'paused');

create trigger set_focus_sessions_updated_at
  before update on public.focus_sessions
  for each row
  execute function public.set_updated_at();

alter table public.focus_sessions enable row level security;

create policy "focus_sessions_select_own"
  on public.focus_sessions for select
  to authenticated
  using (owner_id = auth.uid());

create policy "focus_sessions_insert_own"
  on public.focus_sessions for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "focus_sessions_update_own"
  on public.focus_sessions for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Extend the productivity ledger (T-013) to also accept focus-session completions.
alter table public.productivity_events drop constraint productivity_events_source_type_check;
alter table public.productivity_events
  add constraint productivity_events_source_type_check
  check (source_type in ('task', 'focus_session'));

-- Mirrors record_task_completion_event: fires only on a real transition into
-- 'completed', so retries/duplicate confirms across tabs can't double-credit.
create or replace function public.record_focus_session_completion_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    insert into public.productivity_events (owner_id, source_type, source_id, event_type, occurred_at)
    values (new.owner_id, 'focus_session', new.id, 'completed', new.ended_at)
    on conflict (source_type, source_id, occurred_at) do nothing;
  end if;
  return new;
end;
$$;

create trigger record_focus_session_completion_event
  after update on public.focus_sessions
  for each row
  execute function public.record_focus_session_completion_event();
