-- Declarative campaign (T-028). Content is authored in src/features/journey/content/
-- and reaches these tables only through generated seed migrations
-- (`npm run campaign:seed`) — never written by the running app. The battle engine
-- knows nothing about any of this: a campaign node merely *names* which encounter
-- (kind + difficulty) a battle is fought against.
create table public.campaign_regions (
  id text primary key,
  name text not null,
  sort_order integer not null,
  content_version integer not null default 1
);

create table public.campaign_nodes (
  id text primary key,
  region_id text not null references public.campaign_regions (id),
  sort_order integer not null,
  kind text not null check (kind in ('story', 'route', 'rival', 'gym')),
  title text not null,
  summary text not null,
  npc_name text,
  encounter_kind text not null check (encounter_kind in ('wild', 'trainer', 'rival', 'gymLeader', 'milestone')),
  encounter_difficulty smallint not null check (encounter_difficulty between 1 and 5),
  required_victories smallint not null check (required_victories >= 1),
  repeatable boolean not null default false,
  -- Deferred so a later seed can reorder nodes within one statement.
  unique (region_id, sort_order) deferrable initially deferred
);

create table public.campaign_node_prerequisites (
  node_id text not null references public.campaign_nodes (id) on delete cascade,
  requires_node_id text not null references public.campaign_nodes (id),
  primary key (node_id, requires_node_id),
  check (node_id != requires_node_id)
);

-- Per-user progress. A node is *unlocked* when every prerequisite has `completed_at`
-- set — that is derived on demand, never stored, so there is no pointer to drift.
create table public.campaign_node_progress (
  owner_id uuid not null references auth.users (id) on delete cascade,
  node_id text not null references public.campaign_nodes (id),
  victories integer not null default 0 check (victories >= 0),
  completed_at timestamptz,
  primary key (owner_id, node_id)
);

alter table public.campaign_regions enable row level security;
alter table public.campaign_nodes enable row level security;
alter table public.campaign_node_prerequisites enable row level security;
alter table public.campaign_node_progress enable row level security;

create policy "campaign_regions_select_all" on public.campaign_regions
  for select to authenticated using (true);
create policy "campaign_nodes_select_all" on public.campaign_nodes
  for select to authenticated using (true);
create policy "campaign_node_prerequisites_select_all" on public.campaign_node_prerequisites
  for select to authenticated using (true);
create policy "campaign_node_progress_select_own" on public.campaign_node_progress
  for select to authenticated using (owner_id = auth.uid());

-- Read-only for clients at the grant level too, not only by the absence of RLS write
-- policies (see the grants lessons in docs/DECISIONS.md). Progress is written
-- exclusively by the SECURITY DEFINER trigger below.
revoke all on public.campaign_regions, public.campaign_nodes,
  public.campaign_node_prerequisites, public.campaign_node_progress
  from public, anon, authenticated;
grant select on public.campaign_regions, public.campaign_nodes,
  public.campaign_node_prerequisites, public.campaign_node_progress
  to authenticated;

-- Nullable: battles created before the campaign existed have no node, and a battle
-- without one is still legal — it earns XP as before but moves no campaign progress.
alter table public.battles
  add column campaign_node_id text references public.campaign_nodes (id);

-- Trusted unlock rules. For a battle that claims a campaign node:
--   1. every prerequisite of the node must be completed by this owner;
--   2. a completed node can only be fought again if it is repeatable;
--   3. the encounter kind/difficulty are taken from the node, not from the client;
--   4. the declared commitment cannot be easier than the node's effective difficulty
--      (same team reduction as computeEffectiveDifficulty in battles/engine.ts:
--      1 point per 10 average party levels, never below 1; 1 focus minute per point).
create or replace function public.enforce_campaign_node_on_battle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node public.campaign_nodes;
  v_completed boolean;
  v_average_level numeric;
  v_effective_difficulty integer;
begin
  if new.campaign_node_id is null then
    return new;
  end if;

  select * into v_node from public.campaign_nodes where id = new.campaign_node_id;
  if not found then
    raise exception 'campaign node % does not exist', new.campaign_node_id
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
      from public.campaign_node_prerequisites p
      left join public.campaign_node_progress g
        on g.node_id = p.requires_node_id and g.owner_id = new.owner_id
      where p.node_id = v_node.id and g.completed_at is null
  ) then
    raise exception 'campaign node % is still locked', v_node.id
      using errcode = 'check_violation';
  end if;

  select completed_at is not null into v_completed
    from public.campaign_node_progress
    where owner_id = new.owner_id and node_id = v_node.id;
  if coalesce(v_completed, false) and not v_node.repeatable then
    raise exception 'campaign node % is already completed', v_node.id
      using errcode = 'check_violation';
  end if;

  new.encounter_kind := v_node.encounter_kind;
  new.encounter_difficulty := v_node.encounter_difficulty;

  select coalesce(avg(level), 0) into v_average_level
    from public.owned_pokemon
    where owner_id = new.owner_id and party_position is not null;
  v_effective_difficulty := v_node.encounter_difficulty
    - least(v_node.encounter_difficulty - 1, floor(v_average_level / 10)::integer);

  if (new.commitment_type = 'task' and new.commitment_min_difficulty < v_effective_difficulty)
    or (new.commitment_type = 'focusSession'
        and new.commitment_min_duration_minutes < v_effective_difficulty)
  then
    raise exception 'commitment is below the minimum for campaign node %', v_node.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger enforce_campaign_node_on_battle
  before insert on public.battles
  for each row
  execute function public.enforce_campaign_node_on_battle();

-- Runs inside the same statement that resolves the battle, so "battle won" and
-- "node progress recorded" commit or roll back together. A battle only ever moves
-- pending -> resolved once (clients have no UPDATE policy on battles), which is what
-- makes the increment idempotent.
create or replace function public.record_campaign_progress_on_battle_resolved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.campaign_node_id is not null
    and new.status = 'resolved'
    and old.status is distinct from new.status
    and new.result = 'victory'
  then
    insert into public.campaign_node_progress as g (owner_id, node_id, victories)
      values (new.owner_id, new.campaign_node_id, 1)
      on conflict (owner_id, node_id) do update set victories = g.victories + 1;

    update public.campaign_node_progress g
      set completed_at = now()
      from public.campaign_nodes n
      where n.id = g.node_id
        and g.owner_id = new.owner_id
        and g.node_id = new.campaign_node_id
        and g.completed_at is null
        and g.victories >= n.required_victories;
  end if;
  return new;
end;
$$;

create trigger record_campaign_progress_on_battle_resolved
  after update on public.battles
  for each row
  execute function public.record_campaign_progress_on_battle_resolved();
