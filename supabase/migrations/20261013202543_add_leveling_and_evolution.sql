-- T-026: XP curve is "medium fast" (level³), versioned in docs/DECISIONS.md and
-- mirrored in src/features/pokemon/xp.ts (same cross-language duplication tradeoff as
-- the battle engine — no Edge Function to share one implementation yet).
create or replace function public.total_xp_for_level(p_level integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  -- Exact bigint arithmetic (not `^`, which promotes to double precision in Postgres).
  select p_level::bigint * p_level::bigint * p_level::bigint;
$$;

-- `pending_evolution_to_pokedex_number` is set by the trigger below once a level-up
-- crosses a species' evolution threshold, and cleared only by `confirm_evolution`
-- (RPC) — never by the client directly. A visual evolution prompt reads this column
-- and can be skipped: the flag just stays set, so it's resumed next visit (T-026:
-- "fluxo de evolução... que possa ser pulado e retomado").
alter table public.owned_pokemon
  add column pending_evolution_to_pokedex_number integer references public.species_catalog (pokedex_number);

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
  v_team_multiplier numeric(4, 2) := 1; -- no party-strength bonus modeled yet (T-027)
  v_base_xp numeric;
  v_xp_awarded integer;
  v_wild_species integer;
  v_party_count integer;
  v_xp_share integer;
  v_pokemon public.owned_pokemon;
  v_new_xp integer;
  v_new_level smallint;
  v_evolved_to integer;
  v_next_pokedex integer;
  v_next_min_level smallint;
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

    if v_battle.encounter_kind = 'wild' then
      select pokedex_number into v_wild_species
        from public.species_catalog order by random() limit 1;
    end if;
  else
    v_result := 'withdrawal';
    v_xp_awarded := 0;
  end if;

  update public.battles
    set status = 'resolved', result = v_result, team_multiplier_applied = v_team_multiplier,
        resolved_at = now(), wild_species_pokedex_number = v_wild_species
    where id = v_battle.id;

  if v_xp_awarded > 0 then
    insert into public.reward_events (owner_id, source_type, source_id, reward_type, amount)
    values (v_battle.owner_id, 'battle', v_battle.id, 'xp', v_xp_awarded)
    on conflict (source_type, source_id, reward_type) do nothing;

    -- Distribute evenly across the active party (RF/T-026: "distribuição entre
    -- Pokémon ativos"). An empty party just means the XP sits in reward_events with
    -- nowhere to go yet — not an error.
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

          -- Batch level-up: a single big grant can cross several thresholds at once.
          while v_new_level < 100 and v_new_xp >= public.total_xp_for_level(v_new_level + 1) loop
            v_new_level := v_new_level + 1;
          end loop;

          -- Chain through every evolution stage the new level now qualifies for,
          -- collapsing multi-stage jumps (e.g. Turtwig -> Torterra) into a single
          -- pending target rather than stopping at the first intermediate stage.
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

-- Applies an already-decided pending evolution (set only by the trigger above) —
-- the client can never choose or forge the target species, only confirm or leave it
-- pending ("pulado e retomado": skipping just means not calling this yet).
create or replace function public.confirm_evolution(p_owned_pokemon_id uuid)
returns public.owned_pokemon
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pokemon public.owned_pokemon;
begin
  select * into v_pokemon from public.owned_pokemon
    where id = p_owned_pokemon_id and owner_id = auth.uid();

  if v_pokemon is null then
    raise exception 'Pokémon não encontrado.';
  end if;

  if v_pokemon.pending_evolution_to_pokedex_number is null then
    raise exception 'Esse Pokémon não tem nenhuma evolução pendente.';
  end if;

  update public.owned_pokemon
    set pokedex_number = pending_evolution_to_pokedex_number, pending_evolution_to_pokedex_number = null
    where id = p_owned_pokemon_id
    returning * into v_pokemon;

  return v_pokemon;
end;
$$;

-- Lessons from T-022/T-025: revoke from every role that isn't meant to call this,
-- checking both the per-role grants AND the PUBLIC blanket grant explicitly.
revoke all on function public.confirm_evolution(uuid) from public;
revoke all on function public.confirm_evolution(uuid) from anon;
