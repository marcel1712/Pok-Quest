-- Security audit (T-038): what an anonymous caller, ANOTHER signed-in user, and the owner
-- themselves can and cannot do through the public API roles.
--
--   npx supabase db query --linked -f supabase/verification/t038-security-audit.sql
--
-- Runs inside one subtransaction that is ALWAYS rolled back (the T038_ROLLBACK exception
-- at the end) — including the second user it creates in auth.users to play the intruder.
do $$
declare
  victim uuid;
  intruder uuid := gen_random_uuid();
  item record;
  n integer;
  got_error boolean;
  victim_task uuid;
  victim_session uuid;
  victim_battle uuid;
  victim_pokemon uuid;
  victim_position smallint;
  arguments text;
begin
  select id into victim from auth.users limit 1;

  begin
    -- ── Setup: the victim owns one of everything; a second account exists ────────
    perform set_config('request.jwt.claims', json_build_object('sub', victim)::text, true);
    update public.focus_sessions set status = 'cancelled', ended_at = now()
      where owner_id = victim and status in ('running', 'paused');
    insert into public.tasks (owner_id, title, difficulty)
      values (victim, '__t038_private__', 3) returning id into victim_task;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
      values (victim, 'wild', 1, 'task', 1, victim_task, public.current_campaign_objective(victim))
      returning id into victim_battle;
    update public.tasks set status = 'completed', completed_at = now() where id = victim_task;
    insert into public.focus_sessions (owner_id, planned_duration_seconds)
      values (victim, 600) returning id into victim_session;
    select id, party_position into victim_pokemon, victim_position
      from public.owned_pokemon where owner_id = victim order by party_position nulls last limit 1;
    if victim_pokemon is null then
      insert into public.owned_pokemon (owner_id, pokedex_number, level, xp, party_position)
        values (victim, 396, 5, 125, 1) returning id, party_position into victim_pokemon, victim_position;
    end if;
    update public.owned_pokemon set pending_evolution_to_pokedex_number = 397 where id = victim_pokemon;

    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
      values (intruder, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              't038-intruder@example.invalid', '', now(), now());

    -- ── 1. Anonymous: nothing in `public` is readable, writable or callable ──────
    set local role anon;
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);

    for item in
      select c.relname as name from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
        where ns.nspname = 'public' and c.relkind in ('r', 'v')
    loop
      got_error := false;
      begin
        execute format('select count(*) from public.%I', item.name) into n;
      exception when insufficient_privilege then got_error := true;
      end;
      if not got_error then raise exception 'FAIL: anon can read public.% (% rows visible)', item.name, n; end if;
    end loop;

    for item in
      select p.proname as name, p.pronargs as nargs from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
        where ns.nspname = 'public' and p.prorettype != 'trigger'::regtype
    loop
      select string_agg('null', ', ') into arguments from generate_series(1, item.nargs);
      got_error := false;
      begin
        execute format('select public.%I(%s)', item.name, coalesce(arguments, ''));
      exception
        when insufficient_privilege then got_error := true;
      end;
      if not got_error then raise exception 'FAIL: anon can execute public.%()', item.name; end if;
    end loop;

    -- ── 2. Another signed-in user: none of the victim's rows, in any table ───────
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', intruder)::text, true);
    set local role authenticated;

    for item in
      select c.table_name as name from information_schema.columns c
        join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
        where c.table_schema = 'public' and c.column_name = 'owner_id'
    loop
      execute format('select count(*) from public.%I where owner_id = $1', item.name) into n using victim;
      if n != 0 then raise exception 'FAIL: another user can read % row(s) of public.%', n, item.name; end if;

      -- Changing or deleting them: either refused outright or matching zero rows.
      begin
        execute format('update public.%I set owner_id = owner_id where owner_id = $1', item.name) using victim;
        get diagnostics n = row_count;
        if n != 0 then raise exception 'FAIL: another user updated % row(s) of public.%', n, item.name; end if;
      exception when insufficient_privilege or object_not_in_prerequisite_state then null;
      end;
      begin
        execute format('delete from public.%I where owner_id = $1', item.name) using victim;
        get diagnostics n = row_count;
        if n != 0 then raise exception 'FAIL: another user deleted % row(s) of public.%', n, item.name; end if;
      exception when insufficient_privilege or object_not_in_prerequisite_state then null;
      end;
    end loop;

    if (select count(*) from public.profiles where id = victim) != 0 then
      raise exception 'FAIL: another user can read the victim''s profile';
    end if;
    update public.profiles set timezone = 'Hacked/Zone' where id = victim;
    get diagnostics n = row_count;
    if n != 0 then raise exception 'FAIL: another user changed the victim''s profile'; end if;

    -- Planting rows under the victim's name.
    got_error := false;
    begin
      insert into public.tasks (owner_id, title, difficulty) values (victim, '__t038_planted__', 1);
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: another user inserted a task for the victim'; end if;

    got_error := false;
    begin
      insert into public.focus_sessions (owner_id, planned_duration_seconds) values (victim, 60);
    exception when insufficient_privilege or unique_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: another user inserted a focus session for the victim'; end if;

    -- RPCs pointed at the victim's battle and Pokémon.
    got_error := false;
    begin
      perform public.capture_from_battle(victim_battle);
    exception when others then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: another user captured from the victim''s battle'; end if;

    got_error := false;
    begin
      perform public.confirm_evolution(victim_pokemon);
    exception when others then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: another user confirmed the victim''s evolution'; end if;

    begin
      perform public.swap_party_positions(victim_pokemon, victim_pokemon);
    exception when others then null;
    end;

    if (select count(*) from public.history_entries) != 0 then
      raise exception 'FAIL: another user sees history entries (a brand-new account has none)';
    end if;
    if exists (select 1 from public.get_history_summary() s
                 where s.tasks_completed + s.focus_sessions + s.victories + s.xp_earned + s.captures > 0) then
      raise exception 'FAIL: another user''s summary includes the victim''s activity';
    end if;

    -- Back as the system: none of the above left a mark on the victim.
    reset role;
    if (select pokedex_number from public.owned_pokemon where id = victim_pokemon) = 397 then
      raise exception 'FAIL: the victim''s Pokémon was evolved by another user';
    end if;
    if (select party_position from public.owned_pokemon where id = victim_pokemon) is distinct from victim_position then
      raise exception 'FAIL: the victim''s party was changed by another user';
    end if;
    if exists (select 1 from public.captures where battle_id = victim_battle) then
      raise exception 'FAIL: a capture was created on the victim''s battle';
    end if;
    if (select title from public.tasks where id = victim_task) != '__t038_private__' then
      raise exception 'FAIL: the victim''s task was changed';
    end if;

    -- ── 3. The owner cannot forge their own progress ─────────────────────────────
    perform set_config('request.jwt.claims', json_build_object('sub', victim)::text, true);
    set local role authenticated;

    for item in select * from (values
      ('reward_events',          $q$insert into public.reward_events (owner_id, source_type, source_id, reward_type, amount) values ($1, 'battle', gen_random_uuid(), 'xp', 99999)$q$),
      ('reward_events',          $q$update public.reward_events set amount = 99999 where owner_id = $1$q$),
      ('reward_events',          $q$delete from public.reward_events where owner_id = $1$q$),
      ('owned_pokemon',          $q$insert into public.owned_pokemon (owner_id, pokedex_number, level, xp) values ($1, 483, 100, 1000000)$q$),
      ('owned_pokemon.level',    $q$update public.owned_pokemon set level = 100 where owner_id = $1$q$),
      ('owned_pokemon.xp',       $q$update public.owned_pokemon set xp = 1000000 where owner_id = $1$q$),
      ('owned_pokemon.species',  $q$update public.owned_pokemon set pokedex_number = 483 where owner_id = $1$q$),
      ('owned_pokemon',          $q$delete from public.owned_pokemon where owner_id = $1$q$),
      ('badges',                 $q$insert into public.badges (owner_id, node_id, battle_id) select $1, 'sinnoh.sunyshore-gym', id from public.battles limit 1$q$),
      ('captures',               $q$insert into public.captures (owner_id, battle_id, pokedex_number) select $1, id, 483 from public.battles limit 1$q$),
      ('campaign_node_progress', $q$insert into public.campaign_node_progress (owner_id, node_id, victories, completed_at) values ($1, 'sinnoh.champion-cynthia', 1, now())$q$),
      ('campaign_node_progress', $q$update public.campaign_node_progress set completed_at = now(), victories = 99 where owner_id = $1$q$),
      ('encounters',             $q$update public.encounters set wild_species_pokedex_number = 483, wild_level = 100 where owner_id = $1$q$),
      ('game_progress',          $q$update public.game_progress set starter_pokedex_number = 393 where owner_id = $1$q$),
      ('game_progress',          $q$delete from public.game_progress where owner_id = $1$q$),
      ('productivity_events',    $q$insert into public.productivity_events (owner_id, source_type, source_id, occurred_at) values ($1, 'task', gen_random_uuid(), now())$q$),
      ('evolution_events',       $q$insert into public.evolution_events (owner_id, from_pokedex_number, to_pokedex_number) values ($1, 390, 392)$q$),
      ('battles.result',         $q$update public.battles set status = 'resolved', result = 'victory', resolved_at = now() where owner_id = $1$q$),
      ('battles',                $q$delete from public.battles where owner_id = $1$q$),
      ('species_catalog',        $q$update public.species_catalog set is_legendary = false$q$),
      ('campaign_nodes',         $q$update public.campaign_nodes set required_victories = 1$q$),
      ('wild tables',            $q$insert into public.campaign_node_wild_encounters (node_id, pokedex_number, min_level, max_level, weight) values ('sinnoh.route-201', 483, 100, 100, 100)$q$)
    ) as t(what, statement) loop
      got_error := false;
      begin
        if position('$1' in item.statement) > 0 then execute item.statement using victim;
        else execute item.statement;
        end if;
      exception when insufficient_privilege then got_error := true;
      end;
      if not got_error then raise exception 'FAIL: the owner could forge % directly: %', item.what, item.statement; end if;
    end loop;

    -- Internal functions are not reachable as RPCs, even by the signed-in owner.
    for item in select * from (values
      ($q$select public.resolve_pending_battle($1, null, null, 5::smallint, 9999)$q$),
      ($q$select public.purge_old_tasks(interval '0 days')$q$),
      ($q$select * from public.roll_wild_encounter('sinnoh.route-201')$q$),
      ($q$select public.current_campaign_objective($1)$q$)
    ) as t(statement) loop
      got_error := false;
      begin
        if position('$1' in item.statement) > 0 then execute item.statement using victim;
        else execute item.statement;
        end if;
      exception when insufficient_privilege then got_error := true;
      end;
      if not got_error then raise exception 'FAIL: authenticated can call an internal function: %', item.statement; end if;
    end loop;

    reset role;
    raise exception 'T038_ROLLBACK';
  exception when others then
    reset role;
    if sqlerrm = 'T038_ROLLBACK' then
      raise notice 'PASS: anon sees nothing, users are isolated, progress cannot be forged (rolled back)';
    else
      raise;
    end if;
  end;
end $$;
