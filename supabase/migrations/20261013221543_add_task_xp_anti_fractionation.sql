-- T-027: anti-fractionation for task-sourced XP (5.1.6 do Plan.md: "evitar exploração
-- por tarefas artificiais ou microtarefas repetidas"). Mirrors
-- applyDailyTaskDiminishingReturns in src/features/battles/engine.ts — same constants
-- (5 full-reward tasks/day, then 50%), same reasoning: focus-session XP is already
-- linear in real minutes spent (nothing to exploit by splitting), so only tasks need
-- this.
--
-- The count is UTC-day granularity (`created_at::date`), not the user's configured
-- profile timezone — a deliberate simplification for this anti-abuse check (unlike
-- RNF-013's stricter requirement for user-facing date grouping, e.g. task
-- Hoje/Pendentes/Futuras). Being off by a few hours around midnight doesn't weaken the
-- mechanism's purpose.
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
  v_wild_species integer;
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
