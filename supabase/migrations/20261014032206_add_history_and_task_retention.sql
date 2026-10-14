-- History, achievements and task retention (T-035).

-- 1. The completion ledger keeps what the history needs to show once the task itself is
--    gone: its title and difficulty at the moment it was completed.
alter table public.productivity_events
  add column title text,
  add column difficulty smallint;

update public.productivity_events pe
  set title = t.title, difficulty = t.difficulty
  from public.tasks t
  where pe.source_type = 'task' and pe.source_id = t.id;

create or replace function public.record_task_completion_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    insert into public.productivity_events
      (owner_id, source_type, source_id, event_type, occurred_at, title, difficulty)
    values
      (new.owner_id, 'task', new.id, 'completed', new.completed_at, new.title, new.difficulty)
    on conflict (source_type, source_id, occurred_at) do nothing;
  end if;
  return new;
end;
$$;

-- 2. Evolutions were not recorded anywhere (confirm_evolution only rewrote the row), so
--    they could not appear in the history. From now on each one leaves an entry.
create table public.evolution_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  owned_pokemon_id uuid references public.owned_pokemon (id) on delete set null,
  from_pokedex_number integer not null references public.species_catalog (pokedex_number),
  to_pokedex_number integer not null references public.species_catalog (pokedex_number),
  occurred_at timestamptz not null default now()
);

create index evolution_events_owner_id_idx on public.evolution_events (owner_id);

alter table public.evolution_events enable row level security;

create policy "evolution_events_select_own"
  on public.evolution_events for select to authenticated using (owner_id = auth.uid());

revoke all on public.evolution_events from public, anon, authenticated;
grant select on public.evolution_events to authenticated;

-- Same as the T-026 version, plus the evolution_events row.
create or replace function public.confirm_evolution(p_owned_pokemon_id uuid)
returns public.owned_pokemon
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pokemon public.owned_pokemon;
  v_from integer;
begin
  select * into v_pokemon from public.owned_pokemon
    where id = p_owned_pokemon_id and owner_id = auth.uid();

  if v_pokemon is null then
    raise exception 'Pokémon não encontrado.';
  end if;

  if v_pokemon.pending_evolution_to_pokedex_number is null then
    raise exception 'Esse Pokémon não tem nenhuma evolução pendente.';
  end if;

  v_from := v_pokemon.pokedex_number;

  update public.owned_pokemon
    set pokedex_number = pending_evolution_to_pokedex_number, pending_evolution_to_pokedex_number = null
    where id = p_owned_pokemon_id
    returning * into v_pokemon;

  insert into public.evolution_events (owner_id, owned_pokemon_id, from_pokedex_number, to_pokedex_number)
    values (v_pokemon.owner_id, v_pokemon.id, v_from, v_pokemon.pokedex_number);

  return v_pokemon;
end;
$$;

-- 3. One timeline over every kind of activity. `security_invoker` makes the view run
--    with the caller's privileges, so each underlying table's RLS still applies: a
--    user only ever sees their own rows.
--      title  – what it was (task title, place, species, badge)
--      detail – a qualifier (encounter kind, where, evolved from)
--      amount – difficulty (task), minutes (focus), XP (battle), level (capture)
create view public.history_entries
with (security_invoker = true)
as
  select pe.owner_id, 'task'::text as kind, pe.occurred_at, pe.id::text as entry_id,
         coalesce(pe.title, 'Tarefa') as title, null::text as detail,
         pe.difficulty::integer as amount
    from public.productivity_events pe
    where pe.source_type = 'task' and pe.event_type = 'completed'
  union all
  select fs.owner_id, 'focus', fs.ended_at, fs.id::text,
         'Sessão de foco', null,
         round(fs.planned_duration_seconds / 60.0)::integer
    from public.focus_sessions fs
    where fs.status = 'completed'
  union all
  select b.owner_id, 'battle', b.resolved_at, b.id::text,
         coalesce(s.name, n.npc_name, n.title, 'Encontro'),
         b.encounter_kind || coalesce(' · ' || n.title, ''),
         coalesce((select sum(re.amount) from public.reward_events re
                     where re.source_type = 'battle' and re.source_id = b.id), 0)::integer
    from public.battles b
    left join public.campaign_nodes n on n.id = b.campaign_node_id
    left join public.species_catalog s on s.pokedex_number = b.wild_species_pokedex_number
    where b.status = 'resolved' and b.result = 'victory'
  union all
  select c.owner_id, 'capture', c.created_at, c.id::text,
         s.name, n.title, b.wild_level::integer
    from public.captures c
    join public.species_catalog s on s.pokedex_number = c.pokedex_number
    left join public.battles b on b.id = c.battle_id
    left join public.campaign_nodes n on n.id = b.campaign_node_id
  union all
  select g.owner_id, 'badge', g.earned_at, g.node_id,
         n.badge_name, n.title, null::integer
    from public.badges g
    join public.campaign_nodes n on n.id = g.node_id
  union all
  select e.owner_id, 'evolution', e.occurred_at, e.id::text,
         to_species.name, from_species.name, null::integer
    from public.evolution_events e
    join public.species_catalog to_species on to_species.pokedex_number = e.to_pokedex_number
    join public.species_catalog from_species on from_species.pokedex_number = e.from_pokedex_number
  union all
  select gp.owner_id, 'starter', gp.starter_chosen_at, gp.owner_id::text,
         s.name, null, null::integer
    from public.game_progress gp
    join public.species_catalog s on s.pokedex_number = gp.starter_pokedex_number;

revoke all on public.history_entries from public, anon, authenticated;
grant select on public.history_entries to authenticated;

-- Totals for the four windows the history page shows, computed in one round trip from
-- the same view the timeline reads — so the numbers and the entries cannot disagree.
-- "Today" starts at midnight in the profile's timezone; 7 and 30 days are rolling
-- windows, like the focus summary. Runs as the caller (RLS applies).
create or replace function public.get_history_summary()
returns table (
  period text,
  tasks_completed integer,
  focus_sessions integer,
  focus_minutes integer,
  victories integer,
  xp_earned integer,
  captures integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with zone as (
    select coalesce((select p.timezone from public.profiles p where p.id = auth.uid()), 'UTC') as name
  ),
  periods as (
    select 'today'::text as period,
           (date_trunc('day', now() at time zone zone.name) at time zone zone.name) as since
      from zone
    union all select 'last7Days', now() - interval '7 days'
    union all select 'last30Days', now() - interval '30 days'
    union all select 'allTime', '-infinity'::timestamptz
  )
  select p.period,
         (count(*) filter (where h.kind = 'task'))::integer,
         (count(*) filter (where h.kind = 'focus'))::integer,
         coalesce(sum(h.amount) filter (where h.kind = 'focus'), 0)::integer,
         (count(*) filter (where h.kind = 'battle'))::integer,
         coalesce(sum(h.amount) filter (where h.kind = 'battle'), 0)::integer,
         (count(*) filter (where h.kind = 'capture'))::integer
    from periods p
    left join public.history_entries h
      on h.owner_id = auth.uid() and h.occurred_at >= p.since
    group by p.period;
$$;

revoke all on function public.get_history_summary() from public, anon;
grant execute on function public.get_history_summary() to authenticated;

-- 4. Task retention: completed and archived tasks are deleted 90 days after they were
--    completed / archived. Their ledger rows (productivity_events, reward_events,
--    resolved battles) stay, so the history and every total are unaffected.

-- A resolved battle must be able to outlive its task: `task_id` is ON DELETE SET NULL,
-- which the original check ("a task commitment always has a task") would reject.
alter table public.battles drop constraint battles_check2;
alter table public.battles add constraint battles_task_link_check check (
  case
    when commitment_type = 'task' then task_id is not null or status = 'resolved'
    else task_id is null
  end
);

create or replace function public.purge_old_tasks(p_retention interval default interval '90 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  create temporary table doomed_tasks on commit drop as
    select t.id
      from public.tasks t
      where (t.status = 'completed' and t.completed_at < now() - p_retention)
         or (t.status = 'archived' and t.updated_at < now() - p_retention);

  -- A battle still pending on a task that is about to disappear can never resolve.
  delete from public.battles b
    using doomed_tasks d
    where b.task_id = d.id and b.status = 'pending';

  delete from public.tasks t using doomed_tasks d where t.id = d.id;
  get diagnostics v_deleted = row_count;

  drop table doomed_tasks;
  return v_deleted;
end;
$$;

-- Never callable by clients: it deletes across every owner.
revoke all on function public.purge_old_tasks(interval) from public, anon, authenticated;

create extension if not exists pg_cron;

-- Daily at 03:17 UTC. Unscheduling first keeps this migration re-runnable.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-tasks';
select cron.schedule('purge-old-tasks', '17 3 * * *', $$select public.purge_old_tasks()$$);
