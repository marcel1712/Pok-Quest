-- Encounters by route and rarity (T-030).
--
-- Until now a wild battle's species was rolled from the WHOLE catalog when the battle
-- was won. From here on:
--   * each wild campaign node has its own table of species, level ranges and weights;
--   * the next encounter is generated and stored BEFORE the player commits to it
--     (`encounters`), so it can be shown upfront and never rerolls on a page refresh;
--   * an encounter stays open until a battle against it is WON — abandoning a session
--     does not buy a new roll.

create table public.campaign_node_wild_encounters (
  node_id text not null references public.campaign_nodes (id) on delete cascade,
  pokedex_number integer not null references public.species_catalog (pokedex_number),
  min_level smallint not null check (min_level between 1 and 100),
  max_level smallint not null check (max_level between 1 and 100),
  weight integer not null check (weight > 0),
  primary key (node_id, pokedex_number),
  check (min_level <= max_level)
);

alter table public.campaign_node_wild_encounters enable row level security;

create policy "campaign_node_wild_encounters_select_all"
  on public.campaign_node_wild_encounters for select to authenticated using (true);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  campaign_node_id text not null references public.campaign_nodes (id),
  encounter_kind text not null check (encounter_kind in ('wild', 'trainer', 'rival', 'gymLeader', 'milestone')),
  encounter_difficulty smallint not null check (encounter_difficulty between 1 and 5),
  wild_species_pokedex_number integer references public.species_catalog (pokedex_number),
  wild_level smallint check (wild_level between 1 and 100),
  created_at timestamptz not null default now(),
  -- Set when a battle against it is won (with that battle's id), or when the campaign
  -- moved on and it no longer applies (battle id stays null).
  consumed_at timestamptz,
  consumed_by_battle_id uuid references public.battles (id) on delete set null,
  check ((encounter_kind = 'wild') = (wild_species_pokedex_number is not null)),
  check ((wild_species_pokedex_number is null) = (wild_level is null))
);

-- At most one open encounter per player: this is what "does not reroll" rests on.
create unique index encounters_one_open_per_owner
  on public.encounters (owner_id) where consumed_at is null;

alter table public.encounters enable row level security;

create policy "encounters_select_own"
  on public.encounters for select to authenticated using (owner_id = auth.uid());

revoke all on public.campaign_node_wild_encounters, public.encounters
  from public, anon, authenticated;
grant select on public.campaign_node_wild_encounters, public.encounters to authenticated;

alter table public.battles
  add column encounter_id uuid references public.encounters (id),
  add column wild_level smallint check (wild_level between 1 and 100);

create index battles_encounter_id_idx on public.battles (encounter_id);

-- Weighted pick from a node's table, then a uniform level within the row's range.
-- Returns nulls for a node with no table.
create or replace function public.roll_wild_encounter(
  p_node_id text,
  out pokedex_number integer,
  out level smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_roll double precision := random();
  v_min_level smallint;
  v_max_level smallint;
begin
  select w.pokedex_number, w.min_level, w.max_level
    into pokedex_number, v_min_level, v_max_level
    from (
      select e.pokedex_number, e.min_level, e.max_level,
             sum(e.weight) over (order by e.pokedex_number) as cumulative_weight,
             sum(e.weight) over () as total_weight
        from public.campaign_node_wild_encounters e
        where e.node_id = p_node_id
    ) w
    where v_roll * w.total_weight < w.cumulative_weight
    order by w.cumulative_weight
    limit 1;

  if pokedex_number is not null then
    level := v_min_level + floor(random() * (v_max_level - v_min_level + 1))::integer;
  end if;
end;
$$;

-- Same rule as pickObjective in src/features/journey/domain.ts: the earliest unlocked
-- node not yet completed, else the latest completed repeatable node.
create or replace function public.current_campaign_objective(p_owner_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select n.id
        from public.campaign_nodes n
        join public.campaign_regions r on r.id = n.region_id
        left join public.campaign_node_progress g
          on g.node_id = n.id and g.owner_id = p_owner_id
        where g.completed_at is null
          and not exists (
            select 1
              from public.campaign_node_prerequisites p
              left join public.campaign_node_progress pg
                on pg.node_id = p.requires_node_id and pg.owner_id = p_owner_id
              where p.node_id = n.id and pg.completed_at is null
          )
        order by r.sort_order, n.sort_order
        limit 1
    ),
    (
      select n.id
        from public.campaign_nodes n
        join public.campaign_regions r on r.id = n.region_id
        join public.campaign_node_progress g
          on g.node_id = n.id and g.owner_id = p_owner_id
        where g.completed_at is not null and n.repeatable
        order by r.sort_order desc, n.sort_order desc
        limit 1
    )
  );
$$;

-- The player's current encounter: the open one if it still matches the campaign
-- objective, otherwise a freshly generated one. Takes no arguments — where the
-- encounter happens and what appears are decided here, never by the client. Returns
-- null when there is no campaign content at all.
create or replace function public.get_or_create_encounter()
returns public.encounters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_node public.campaign_nodes;
  v_encounter public.encounters;
  v_species integer;
  v_level smallint;
begin
  if v_owner_id is null then
    raise exception 'Usuário não autenticado.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_node from public.campaign_nodes
    where id = public.current_campaign_objective(v_owner_id);
  if not found then
    return null;
  end if;

  select * into v_encounter from public.encounters
    where owner_id = v_owner_id and consumed_at is null
    for update;

  if found then
    if v_encounter.campaign_node_id = v_node.id then
      return v_encounter;
    end if;
    -- The campaign moved on (content update, or progress made through a battle that
    -- was not tied to this encounter): retire it instead of leaving the player stuck.
    update public.encounters set consumed_at = now() where id = v_encounter.id;
  end if;

  if v_node.encounter_kind = 'wild' then
    select r.pokedex_number, r.level into v_species, v_level
      from public.roll_wild_encounter(v_node.id) r;
    if v_species is null then
      raise exception 'campaign node % has no wild encounter table', v_node.id;
    end if;
  end if;

  insert into public.encounters (
    owner_id, campaign_node_id, encounter_kind, encounter_difficulty,
    wild_species_pokedex_number, wild_level
  )
  values (
    v_owner_id, v_node.id, v_node.encounter_kind, v_node.encounter_difficulty,
    v_species, v_level
  )
  returning * into v_encounter;

  return v_encounter;
exception
  when unique_violation then
    -- Two simultaneous first calls (two tabs): return the one that won.
    select * into v_encounter from public.encounters
      where owner_id = v_owner_id and consumed_at is null;
    return v_encounter;
end;
$$;

revoke all on function public.roll_wild_encounter(text) from public, anon, authenticated;
revoke all on function public.current_campaign_objective(uuid) from public, anon, authenticated;
revoke all on function public.get_or_create_encounter() from public, anon;
grant execute on function public.get_or_create_encounter() to authenticated;

-- Replaces the T-028 version. New: a battle may name an open encounter, which then
-- dictates the node, and the wild species/level are ALWAYS decided here — from the
-- encounter, or rolled from the node's table for a battle that names only a node.
-- Whatever the client sends in wild_species_pokedex_number / wild_level is discarded;
-- since resolve_pending_battle no longer rolls a species itself, that discard is what
-- stops a client from naming the species it would like to capture.
create or replace function public.enforce_campaign_node_on_battle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encounter public.encounters;
  v_node public.campaign_nodes;
  v_completed boolean;
  v_average_level numeric;
  v_effective_difficulty integer;
begin
  new.wild_species_pokedex_number := null;
  new.wild_level := null;

  if new.encounter_id is not null then
    select * into v_encounter from public.encounters
      where id = new.encounter_id and owner_id = new.owner_id and consumed_at is null;
    if not found then
      raise exception 'encounter % is not open for this player', new.encounter_id
        using errcode = 'check_violation';
    end if;
    new.campaign_node_id := v_encounter.campaign_node_id;
  end if;

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

  if v_node.encounter_kind = 'wild' then
    if new.encounter_id is not null then
      new.wild_species_pokedex_number := v_encounter.wild_species_pokedex_number;
      new.wild_level := v_encounter.wild_level;
    else
      select r.pokedex_number, r.level
        into new.wild_species_pokedex_number, new.wild_level
        from public.roll_wild_encounter(v_node.id) r;
    end if;
  end if;

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

-- Replaces the T-028 version: a victory now also consumes the encounter it was fought
-- against, in the same transaction as the progress it records.
create or replace function public.record_campaign_progress_on_battle_resolved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'resolved'
    and old.status is distinct from new.status
    and new.result = 'victory'
  then
    if new.campaign_node_id is not null then
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

    if new.encounter_id is not null then
      update public.encounters
        set consumed_at = now(), consumed_by_battle_id = new.id
        where id = new.encounter_id and consumed_at is null;
    end if;
  end if;
  return new;
end;
$$;

-- Same as the T-027 version except that it no longer rolls a wild species from the
-- whole catalog on victory: the species (and level) were fixed when the battle was
-- created, by enforce_campaign_node_on_battle. A wild battle with no campaign node
-- therefore has nothing to capture — there is no encounter outside the region tables.
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
  v_team_multiplier numeric(4, 2) := 1; -- no party-strength bonus modeled yet
  v_base_xp numeric;
  v_xp_awarded integer;
  v_party_count integer;
  v_xp_share integer;
  v_pokemon public.owned_pokemon;
  v_new_xp integer;
  v_new_level smallint;
  v_evolved_to integer;
  v_next_pokedex integer;
  v_next_min_level smallint;
  v_today_task_rewards integer;
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

    if v_battle.commitment_type = 'task' then
      select count(*) into v_today_task_rewards
        from public.reward_events re
        join public.battles b on b.id = re.source_id
        where re.owner_id = v_battle.owner_id
          and b.commitment_type = 'task'
          and re.created_at::date = now()::date;

      v_base_xp := p_fulfillment_difficulty * 20;
      if v_today_task_rewards >= 5 then
        v_base_xp := v_base_xp * 0.5;
      end if;
    else
      v_base_xp := p_fulfillment_minutes * 1.5;
    end if;

    v_xp_awarded := round(v_base_xp * v_team_multiplier);
  else
    v_result := 'withdrawal';
    v_xp_awarded := 0;
  end if;

  update public.battles
    set status = 'resolved', result = v_result, team_multiplier_applied = v_team_multiplier,
        resolved_at = now()
    where id = v_battle.id;

  if v_xp_awarded > 0 then
    insert into public.reward_events (owner_id, source_type, source_id, reward_type, amount)
    values (v_battle.owner_id, 'battle', v_battle.id, 'xp', v_xp_awarded)
    on conflict (source_type, source_id, reward_type) do nothing;

    -- Distribute evenly across the active party. An empty party just means the XP
    -- sits in reward_events with nowhere to go yet — not an error.
    select count(*) into v_party_count from public.owned_pokemon
      where owner_id = v_battle.owner_id and party_position is not null;

    if v_party_count > 0 then
      v_xp_share := v_xp_awarded / v_party_count;

      if v_xp_share > 0 then
        for v_pokemon in
          select * from public.owned_pokemon
            where owner_id = v_battle.owner_id and party_position is not null
        loop
          v_new_xp := v_pokemon.xp + v_xp_share;
          v_new_level := v_pokemon.level;

          while v_new_level < 100 and v_new_xp >= public.total_xp_for_level(v_new_level + 1) loop
            v_new_level := v_new_level + 1;
          end loop;

          v_evolved_to := v_pokemon.pokedex_number;
          loop
            select evolves_to_pokedex_number, evolution_min_level
              into v_next_pokedex, v_next_min_level
              from public.species_catalog where pokedex_number = v_evolved_to;
            if v_next_pokedex is null or v_next_min_level is null or v_new_level < v_next_min_level then
              exit;
            end if;
            v_evolved_to := v_next_pokedex;
          end loop;

          update public.owned_pokemon
            set xp = v_new_xp, level = v_new_level,
                pending_evolution_to_pokedex_number = case
                  when v_evolved_to != v_pokemon.pokedex_number then v_evolved_to
                  else pending_evolution_to_pokedex_number
                end
            where id = v_pokemon.id;
        end loop;
      end if;
    end if;
  end if;
end;
$$;

-- Same as the T-025 version except that the captured Pokémon now arrives at the level
-- it was encountered at, with the XP that level corresponds to (it used to be a fixed
-- level 5 with 0 XP).
create or replace function public.capture_from_battle(p_battle_id uuid)
returns public.owned_pokemon
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle public.battles;
  v_pokemon public.owned_pokemon;
  v_level smallint;
begin
  select * into v_battle from public.battles where id = p_battle_id and owner_id = auth.uid();
  if v_battle is null then
    raise exception 'Batalha não encontrada.';
  end if;

  if v_battle.status != 'resolved' or v_battle.result != 'victory' then
    raise exception 'Só é possível capturar depois de uma vitória confirmada.';
  end if;

  if v_battle.encounter_kind != 'wild' or v_battle.wild_species_pokedex_number is null then
    raise exception 'Esse encontro não tem um Pokémon selvagem para capturar.';
  end if;

  v_level := coalesce(v_battle.wild_level, 5);

  insert into public.owned_pokemon (owner_id, pokedex_number, level, xp)
  values (
    v_battle.owner_id, v_battle.wild_species_pokedex_number, v_level,
    public.total_xp_for_level(v_level)
  )
  returning * into v_pokemon;

  insert into public.captures (owner_id, battle_id, pokedex_number, owned_pokemon_id)
  values (v_battle.owner_id, p_battle_id, v_battle.wild_species_pokedex_number, v_pokemon.id);

  return v_pokemon;
exception
  when unique_violation then
    -- Retry/duplicate request race on the same battle: return what the winning
    -- request already created instead of erroring or creating a second Pokémon.
    select op.* into v_pokemon
      from public.captures c
      join public.owned_pokemon op on op.id = c.owned_pokemon_id
      where c.battle_id = p_battle_id;
    return v_pokemon;
end;
$$;
