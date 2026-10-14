-- Manual verification for route encounters and rarity (T-030). Not run automatically —
-- see t013-completion-idempotency.sql header for why.
--
--   npx supabase db query --linked -f supabase/verification/t030-route-encounters.sql
--
-- Same approach as t028/t029: one subtransaction that is always rolled back, because it
-- resets the owner's real campaign progress, party and open encounter.
do $$
declare
  test_owner uuid;
  task_id uuid;
  battle public.battles;
  encounter public.encounters;
  again public.encounters;
  captured public.owned_pokemon;
  got_error boolean;
  total integer;
  starly integer;
  bidoof integer;
  kricketot integer;
  bad integer;
  i integer;
  wild_node text;
  rolled_species integer;
  rolled_level smallint;
begin
  select id into test_owner from auth.users limit 1;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);
    delete from public.campaign_node_progress where owner_id = test_owner;
    update public.encounters set consumed_at = now() where owner_id = test_owner and consumed_at is null;
    update public.owned_pokemon set party_position = null where owner_id = test_owner;

    -- 1. Rarity: 4000 rolls on Route 201 (Starly 50 / Bidoof 40 / Kricketot 10) land
    --    within 4 points of the table's weights, and only on its species and levels.
    -- One call per loop iteration on purpose: inside a single query Postgres evaluates
    -- a set-returning call with constant arguments once and reuses the row.
    total := 4000; starly := 0; bidoof := 0; kricketot := 0; bad := 0;
    for i in 1..total loop
      select r.pokedex_number, r.level into rolled_species, rolled_level
        from public.roll_wild_encounter('sinnoh.route-201') r;
      if rolled_species = 396 then starly := starly + 1;
      elsif rolled_species = 399 then bidoof := bidoof + 1;
      elsif rolled_species = 401 then kricketot := kricketot + 1;
      else bad := bad + 1;
      end if;
      if rolled_level not between 2 and 3 then bad := bad + 1; end if;
    end loop;
    raise notice 'route-201 over % rolls: Starly %, Bidoof %, Kricketot %', total, starly, bidoof, kricketot;
    if bad > 0 then raise exception 'FAIL: % rolls outside the Route 201 table', bad; end if;
    if abs(starly - 2000) > 160 or abs(bidoof - 1600) > 160 or abs(kricketot - 400) > 160 then
      raise exception 'FAIL: distribution off: Starly %, Bidoof %, Kricketot % of 4000', starly, bidoof, kricketot;
    end if;

    -- 2. Every wild node: rolls stay inside that node's own table and level range, and
    --    never produce a legendary.
    bad := 0;
    for wild_node in select n.id from public.campaign_nodes n where n.encounter_kind = 'wild' loop
      for i in 1..40 loop
        select r.pokedex_number, r.level into rolled_species, rolled_level
          from public.roll_wild_encounter(wild_node) r;
        if not exists (
          select 1
            from public.campaign_node_wild_encounters w
            join public.species_catalog s on s.pokedex_number = w.pokedex_number
            where w.node_id = wild_node and w.pokedex_number = rolled_species
              and rolled_level between w.min_level and w.max_level
              and not s.is_legendary
        ) then
          bad := bad + 1;
        end if;
      end loop;
    end loop;
    if bad > 0 then raise exception 'FAIL: % rolls outside their node table (or legendary)', bad; end if;

    -- 3. A new player's encounter is the first story node, with no wild species; asking
    --    again returns the same encounter.
    encounter := public.get_or_create_encounter();
    if encounter.campaign_node_id != 'sinnoh.twinleaf-town' or encounter.wild_species_pokedex_number is not null then
      raise exception 'FAIL: unexpected first encounter %', encounter;
    end if;
    again := public.get_or_create_encounter();
    if again.id != encounter.id then raise exception 'FAIL: the open encounter was regenerated'; end if;

    -- 4. Winning a battle fought against the encounter consumes it and advances the node.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t030_town__', 1) returning id into task_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, encounter_id)
      values (test_owner, 'wild', 5, 'task', 1, task_id, encounter.id) returning * into battle;
    if battle.campaign_node_id is distinct from 'sinnoh.twinleaf-town' or battle.encounter_kind != 'milestone' then
      raise exception 'FAIL: battle did not take node/kind from the encounter: %', battle;
    end if;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;
    select * into again from public.encounters where id = encounter.id;
    if again.consumed_at is null or again.consumed_by_battle_id is distinct from battle.id then
      raise exception 'FAIL: victory did not consume the encounter';
    end if;

    -- 5. The next encounter is a wild one from Route 201's table, and repeated requests
    --    (page refreshes) never reroll it.
    encounter := public.get_or_create_encounter();
    if encounter.campaign_node_id != 'sinnoh.route-201' or encounter.encounter_kind != 'wild'
      or encounter.wild_species_pokedex_number not in (396, 399, 401)
      or encounter.wild_level not between 2 and 3 then
      raise exception 'FAIL: unexpected Route 201 encounter %', encounter;
    end if;
    for i in 1..5 loop
      again := public.get_or_create_encounter();
      if again.id != encounter.id or again.wild_species_pokedex_number != encounter.wild_species_pokedex_number then
        raise exception 'FAIL: encounter rerolled on request %', i;
      end if;
    end loop;

    -- 6. The client cannot name the species: Dialga (483) at level 100 is discarded in
    --    favour of what the encounter holds. This battle's commitment (difficulty 3) is
    --    not met by a difficulty-1 task, so it ends in withdrawal...
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t030_withdraw__', 1) returning id into task_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, encounter_id, wild_species_pokedex_number, wild_level)
      values (test_owner, 'wild', 1, 'task', 3, task_id, encounter.id, 483, 100) returning * into battle;
    if battle.wild_species_pokedex_number != encounter.wild_species_pokedex_number or battle.wild_level != encounter.wild_level then
      raise exception 'FAIL: client-supplied wild species/level was kept: % / %', battle.wild_species_pokedex_number, battle.wild_level;
    end if;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;
    select * into battle from public.battles where id = battle.id;
    if battle.result is distinct from 'withdrawal' then raise exception 'FAIL: expected a withdrawal, got %', battle.result; end if;

    -- 7. ...and a withdrawal neither consumes the encounter nor allows a capture.
    again := public.get_or_create_encounter();
    if again.id != encounter.id then raise exception 'FAIL: a withdrawal bought a new encounter'; end if;
    got_error := false;
    begin
      perform public.capture_from_battle(battle.id);
    exception when others then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: captured from a battle that was not won'; end if;

    -- 8. Winning it: the capture arrives at the encountered level with matching XP, and
    --    only then is a different encounter generated.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t030_win__', 1) returning id into task_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, encounter_id)
      values (test_owner, 'wild', 1, 'task', 1, task_id, encounter.id) returning * into battle;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;
    captured := public.capture_from_battle(battle.id);
    if captured.pokedex_number != encounter.wild_species_pokedex_number
      or captured.level != encounter.wild_level
      or captured.xp != public.total_xp_for_level(encounter.wild_level) then
      raise exception 'FAIL: capture does not match the encounter: %', captured;
    end if;
    again := public.get_or_create_encounter();
    if again.id = encounter.id then raise exception 'FAIL: a consumed encounter was returned again'; end if;

    -- 9. A consumed encounter cannot be fought again.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t030_reuse__', 1) returning id into task_id;
    got_error := false;
    begin
      insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, encounter_id)
        values (test_owner, 'wild', 1, 'task', 1, task_id, encounter.id);
    exception when check_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: a consumed encounter accepted a new battle'; end if;

    -- 10. A battle outside the campaign never carries a species, whatever is sent.
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, wild_species_pokedex_number, wild_level)
      values (test_owner, 'wild', 1, 'task', 1, task_id, 483, 100) returning * into battle;
    if battle.wild_species_pokedex_number is not null or battle.wild_level is not null then
      raise exception 'FAIL: a battle with no campaign node kept a client-supplied species';
    end if;

    -- 11. As the real client role: no writing encounters, no rolling directly.
    set local role authenticated;

    got_error := false;
    begin
      update public.encounters set wild_species_pokedex_number = 483, wild_level = 100;
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could update encounters'; end if;

    got_error := false;
    begin
      insert into public.encounters (owner_id, campaign_node_id, encounter_kind, encounter_difficulty)
        values (test_owner, 'sinnoh.oreburgh-gym', 'gymLeader', 3);
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could insert encounters'; end if;

    got_error := false;
    begin
      perform public.roll_wild_encounter('sinnoh.route-201');
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could call roll_wild_encounter'; end if;

    if (select count(*) from public.encounters) < 3 then
      raise exception 'FAIL: authenticated should be able to read its own encounters';
    end if;

    reset role;
    raise exception 'T030_ROLLBACK';
  exception when others then
    reset role;
    if sqlerrm = 'T030_ROLLBACK' then
      raise notice 'PASS: route encounter rules hold (all test data rolled back)';
    else
      raise;
    end if;
  end;
end $$;
