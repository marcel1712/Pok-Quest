-- Manual verification of the awkward paths (T-036): reopening a task, abandoning a
-- session, changing the party mid-battle and retrying after a failure. None of them may
-- duplicate a reward or lose one. Not run automatically — see `npm run db:verify`.
--
--   npx supabase db query --linked -f supabase/verification/t036-robustness.sql
--
-- Runs inside one subtransaction that is ALWAYS rolled back (the T036_ROLLBACK exception
-- at the end), so nothing it creates or changes survives, pass or fail.
do $$
declare
  test_owner uuid;
  task_id uuid;
  session_id uuid;
  battle_id uuid;
  stale_battle uuid;
  encounter public.encounters;
  again public.encounters;
  pokemon_in uuid;
  pokemon_out uuid;
  rewards integer;
  xp_before integer;
  xp_after integer;
  victories integer;
  events integer;
  got_error boolean;
begin
  select id into test_owner from auth.users limit 1;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);
    update public.owned_pokemon set party_position = null where owner_id = test_owner;
    delete from public.reward_events where owner_id = test_owner;
    update public.focus_sessions set status = 'cancelled', ended_at = now()
      where owner_id = test_owner and status in ('running', 'paused');
    update public.encounters set consumed_at = now() where owner_id = test_owner and consumed_at is null;
    delete from public.campaign_node_progress where owner_id = test_owner;
    insert into public.campaign_node_progress (owner_id, node_id, victories, completed_at)
      values (test_owner, 'sinnoh.twinleaf-town', 1, now());

    -- ── A. Reopening a task ─────────────────────────────────────────────────────
    -- Complete -> reopen -> complete again: the battle was already won and paid, so
    -- the second completion earns nothing more and moves no campaign progress.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t036_reopen__', 2) returning id into task_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
      values (test_owner, 'wild', 1, 'task', 1, task_id, 'sinnoh.route-201') returning id into battle_id;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;
    update public.tasks set status = 'pending', completed_at = null where id = task_id;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;

    select count(*) into rewards from public.reward_events where source_id = battle_id;
    if rewards != 1 then raise exception 'FAIL: reopening and recompleting paid the battle % times', rewards; end if;
    select g.victories into victories from public.campaign_node_progress g
      where g.owner_id = test_owner and g.node_id = 'sinnoh.route-201';
    if victories != 1 then raise exception 'FAIL: reopening counted % route victories', victories; end if;

    -- A task can only ever carry one battle, so recompleting cannot be turned into a
    -- farm by attaching a fresh battle to it.
    got_error := false;
    begin
      insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
        values (test_owner, 'wild', 1, 'task', 1, task_id, 'sinnoh.route-201');
    exception when unique_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: a second battle was attached to the same task'; end if;

    -- ── D (first half). Retrying the same completion ────────────────────────────
    -- The same UPDATE arriving twice (a retry after a dropped response) is a no-op.
    select count(*) into events from public.productivity_events where source_type = 'task' and source_id = task_id;
    update public.tasks set status = 'completed' where id = task_id;
    update public.tasks set status = 'completed' where id = task_id;
    if (select count(*) from public.productivity_events where source_type = 'task' and source_id = task_id) != events then
      raise exception 'FAIL: a repeated completion created another productivity event';
    end if;
    if (select count(*) from public.reward_events where source_id = battle_id) != 1 then
      raise exception 'FAIL: a repeated completion paid the battle again';
    end if;

    -- Resolving an already-resolved battle directly changes nothing either.
    perform public.resolve_pending_battle(test_owner, task_id, null, 5::smallint, null);
    if (select count(*) from public.reward_events where source_id = battle_id) != 1 then
      raise exception 'FAIL: resolve_pending_battle paid an already-resolved battle';
    end if;

    -- ── B. Abandoning a session ─────────────────────────────────────────────────
    encounter := public.get_or_create_encounter();
    insert into public.focus_sessions (owner_id, planned_duration_seconds, status, started_at)
      values (test_owner, 600, 'running', now()) returning id into session_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_duration_minutes, focus_session_id, encounter_id)
      values (test_owner, 'wild', 1, 'focusSession', 1, session_id, encounter.id) returning id into stale_battle;
    update public.focus_sessions set status = 'cancelled', ended_at = now() where id = session_id;

    if (select status from public.battles where id = stale_battle) != 'pending' then
      raise exception 'FAIL: a cancelled session resolved its battle';
    end if;
    if exists (select 1 from public.reward_events where source_id = stale_battle) then
      raise exception 'FAIL: a cancelled session earned XP';
    end if;
    again := public.get_or_create_encounter();
    if again.id != encounter.id then
      raise exception 'FAIL: cancelling a session replaced the encounter (a free reroll)';
    end if;

    -- A session shorter than what was promised is a withdrawal: no XP, no progress.
    insert into public.focus_sessions (owner_id, planned_duration_seconds, status, started_at)
      values (test_owner, 60, 'running', now()) returning id into session_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_duration_minutes, focus_session_id, encounter_id)
      values (test_owner, 'wild', 1, 'focusSession', 5, session_id, encounter.id) returning id into battle_id;
    update public.focus_sessions set status = 'completed', ended_at = now() where id = session_id;
    if (select result from public.battles where id = battle_id) is distinct from 'withdrawal' then
      raise exception 'FAIL: a 1-minute session should not satisfy a 5-minute commitment';
    end if;
    if exists (select 1 from public.reward_events where source_id = battle_id) then
      raise exception 'FAIL: a withdrawal earned XP';
    end if;

    -- ── C. The party changes between accepting the encounter and winning it ─────
    -- XP goes to whoever is in the party when the battle is RESOLVED.
    insert into public.owned_pokemon (owner_id, pokedex_number, level, xp, party_position)
      values (test_owner, 396, 5, 125, 1) returning id into pokemon_out;
    insert into public.focus_sessions (owner_id, planned_duration_seconds, status, started_at)
      values (test_owner, 600, 'running', now()) returning id into session_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_duration_minutes, focus_session_id, encounter_id)
      values (test_owner, 'wild', 1, 'focusSession', 1, session_id, encounter.id) returning id into battle_id;

    update public.owned_pokemon set party_position = null where id = pokemon_out;
    insert into public.owned_pokemon (owner_id, pokedex_number, level, xp, party_position)
      values (test_owner, 399, 5, 125, 1) returning id into pokemon_in;

    update public.focus_sessions set status = 'completed', ended_at = now() where id = session_id;

    -- 10 minutes x 1.5 XP = 15 XP, all to the one Pokémon now in the party.
    select xp into xp_after from public.owned_pokemon where id = pokemon_in;
    if xp_after != 140 then raise exception 'FAIL: the Pokémon now in the party should have 125 + 15 XP, has %', xp_after; end if;
    select xp into xp_after from public.owned_pokemon where id = pokemon_out;
    if xp_after != 125 then raise exception 'FAIL: the Pokémon moved to the box still gained XP (%)', xp_after; end if;

    -- ── D (second half). Retrying the session completion ────────────────────────
    select xp into xp_before from public.owned_pokemon where id = pokemon_in;
    update public.focus_sessions set status = 'completed' where id = session_id;
    update public.focus_sessions set status = 'completed' where id = session_id;
    select xp into xp_after from public.owned_pokemon where id = pokemon_in;
    if xp_after != xp_before then raise exception 'FAIL: repeating the session completion granted XP again'; end if;
    if (select count(*) from public.reward_events where source_id = battle_id) != 1 then
      raise exception 'FAIL: repeating the session completion paid the battle again';
    end if;

    -- The battle left pending by the cancelled session is still pending and unpaid.
    if (select status from public.battles where id = stale_battle) != 'pending' then
      raise exception 'FAIL: the abandoned battle got resolved by a later session';
    end if;

    raise exception 'T036_ROLLBACK';
  exception when others then
    if sqlerrm = 'T036_ROLLBACK' then
      raise notice 'PASS: reopen, abandon, party change and retry are all safe (rolled back)';
    else
      raise;
    end if;
  end;
end $$;
