-- Battle engine persistence (T-022). The commitment (what's required to win) is
-- recorded on the `battles` row itself at creation time, BEFORE the activity starts —
-- matching RF-022 ("compromisso visível antes do início"). No separate
-- `battle_commitments` table: there's only ever one commitment per battle, so a join
-- table would add nothing.
--
-- Mirrors the formulas in docs/GAME_RULES.md / src/features/battles/engine.ts. This is
-- a real limitation worth flagging: the math is duplicated here in SQL rather than
-- calling the TS engine from an Edge Function, because this project has no Edge
-- Function deployed yet. See docs/DECISIONS.md.
create table public.battles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  encounter_kind text not null check (encounter_kind in ('wild', 'trainer', 'rival', 'gymLeader', 'milestone')),
  encounter_difficulty smallint not null check (encounter_difficulty between 1 and 5),
  commitment_type text not null check (commitment_type in ('task', 'focusSession')),
  commitment_min_difficulty smallint check (commitment_min_difficulty between 1 and 5),
  commitment_min_duration_minutes smallint check (commitment_min_duration_minutes between 1 and 120),
  task_id uuid references public.tasks (id) on delete set null,
  focus_session_id uuid references public.focus_sessions (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  result text check (result in ('victory', 'withdrawal')),
  team_multiplier_applied numeric(4, 2),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((commitment_type = 'task') = (commitment_min_difficulty is not null)),
  check ((commitment_type = 'focusSession') = (commitment_min_duration_minutes is not null)),
  check ((commitment_type = 'task') = (task_id is not null)),
  check ((commitment_type = 'focusSession') = (focus_session_id is not null)),
  check ((status = 'resolved') = (result is not null and resolved_at is not null))
);

create index battles_owner_id_idx on public.battles (owner_id);

-- One battle per task/session (RF-022: "protegidos contra criação duplicada") — a
-- second attempt to commit to the same activity fails here, not just in the UI.
create unique index battles_task_id_unique on public.battles (task_id) where task_id is not null;
create unique index battles_focus_session_id_unique on public.battles (focus_session_id)
  where focus_session_id is not null;

alter table public.battles enable row level security;

create policy "battles_select_own"
  on public.battles for select
  to authenticated
  using (owner_id = auth.uid());

-- Creating a *pending* battle (declaring the commitment before starting) is an
-- ordinary user action — it grants nothing by itself. There is deliberately no UPDATE
-- policy: only the triggers below (SECURITY DEFINER) may move a battle to `resolved`,
-- which is what actually credits XP. The frontend cannot create XP arbitrary (CA).
create policy "battles_insert_own"
  on public.battles for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Append-only reward ledger. No INSERT/UPDATE/DELETE policy for `authenticated`: only
-- the SECURITY DEFINER trigger functions below may write here, same pattern as
-- `productivity_events` (T-013).
create table public.reward_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('battle')),
  source_id uuid not null,
  reward_type text not null default 'xp' check (reward_type in ('xp')),
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (source_type, source_id, reward_type)
);

create index reward_events_owner_id_idx on public.reward_events (owner_id);

alter table public.reward_events enable row level security;

create policy "reward_events_select_own"
  on public.reward_events for select
  to authenticated
  using (owner_id = auth.uid());

-- Resolves any pending battle attached to `p_task_id`/`p_focus_session_id` once that
-- activity actually completed. Deliberately swallows every exception: a bug here must
-- NEVER roll back the task/focus-session completion that triggered it (RF-021: "a
-- produtividade nunca depende de vencer uma batalha"). Idempotent the same way as
-- T-013/T-016: the early status check plus the reward_events unique constraint both
-- guard against double-crediting if this ever somehow ran twice for the same battle.
create or replace function public.resolve_pending_battle(
  p_owner_id uuid,
  p_task_id uuid,
  p_focus_session_id uuid,
  p_fulfillment_difficulty smallint,
  p_fulfillment_minutes numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle public.battles;
  v_fulfilled boolean;
  v_result text;
  v_team_multiplier numeric(4, 2) := 1; -- no party system yet (T-024/T-025): always neutral
  v_base_xp numeric;
  v_xp_awarded integer;
begin
  if p_task_id is not null then
    select * into v_battle from public.battles
      where task_id = p_task_id and owner_id = p_owner_id and status = 'pending';
  else
    select * into v_battle from public.battles
      where focus_session_id = p_focus_session_id and owner_id = p_owner_id and status = 'pending';
  end if;

  if v_battle is null then
    return; -- no pending commitment for this activity — nothing to resolve
  end if;

  v_fulfilled := case
    when v_battle.commitment_type = 'task' then
      p_fulfillment_difficulty >= v_battle.commitment_min_difficulty
    else
      p_fulfillment_minutes >= v_battle.commitment_min_duration_minutes
  end;

  if v_fulfilled then
    v_result := 'victory';
    v_base_xp := case
      when v_battle.commitment_type = 'task' then p_fulfillment_difficulty * 20
      else p_fulfillment_minutes * 1.5
    end;
    v_xp_awarded := round(v_base_xp * v_team_multiplier);
  else
    v_result := 'withdrawal';
    v_xp_awarded := 0;
  end if;

  update public.battles
    set status = 'resolved', result = v_result, team_multiplier_applied = v_team_multiplier, resolved_at = now()
    where id = v_battle.id;

  if v_xp_awarded > 0 then
    insert into public.reward_events (owner_id, source_type, source_id, reward_type, amount)
    values (v_battle.owner_id, 'battle', v_battle.id, 'xp', v_xp_awarded)
    on conflict (source_type, source_id, reward_type) do nothing;
  end if;
end;
$$;

-- CRITICAL: this function takes the fulfillment values (difficulty/minutes) as plain
-- arguments instead of re-reading them from the row itself — if a client could call it
-- directly via PostgREST's RPC endpoint, they could pass any `p_fulfillment_difficulty`
-- they want and forge XP, regardless of their task's real difficulty. Functions are
-- PUBLIC-executable by default in Postgres, so this revoke is not optional. Only the
-- two SECURITY DEFINER trigger functions below may call it — once inside a SECURITY
-- DEFINER function, the active role for subsequent calls is the definer, not the
-- original client, so revoking from `authenticated`/`public` does not break them.
revoke all on function public.resolve_pending_battle(uuid, uuid, uuid, smallint, numeric) from public;
revoke all on function public.resolve_pending_battle(uuid, uuid, uuid, smallint, numeric) from authenticated;

create or replace function public.resolve_battle_on_task_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    begin
      perform public.resolve_pending_battle(new.owner_id, new.id, null, new.difficulty, null);
    exception when others then
      -- Never let a battle-resolution bug block the task completion itself.
      raise warning 'resolve_pending_battle (task %) failed: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

create trigger resolve_battle_on_task_completed
  after update on public.tasks
  for each row
  execute function public.resolve_battle_on_task_completed();

create or replace function public.resolve_battle_on_focus_session_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    begin
      perform public.resolve_pending_battle(
        new.owner_id, null, new.id, null, new.planned_duration_seconds / 60.0
      );
    exception when others then
      raise warning 'resolve_pending_battle (focus session %) failed: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

create trigger resolve_battle_on_focus_session_completed
  after update on public.focus_sessions
  for each row
  execute function public.resolve_battle_on_focus_session_completed();
