-- Manual verification for capture + party management (T-025). Not run automatically —
-- see t013-completion-idempotency.sql header for why.
--
--   npx supabase db query --linked -f supabase/verification/t025-capture-and-party.sql
--
-- Runs inside one subtransaction that is ALWAYS rolled back (the T025_ROLLBACK exception
-- at the end), so nothing it creates or changes survives, pass or fail.
do $$
declare
  test_owner uuid;
  task_victory uuid;
  task_other uuid;
  task_withdrawal uuid;
  battle_wild uuid;
  battle_other_wild uuid;
  battle_withdrawal uuid;
  pokemon_a uuid;
  pokemon_b uuid;
  pokemon_c uuid;
  capture_count int;
  owned_count int;
  got_unique_violation boolean := false;
  pos_a smallint;
  pos_b smallint;
begin
  select id into test_owner from auth.users limit 1;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);
    -- Start from a known state, whatever the real account currently holds.
    update public.owned_pokemon set party_position = null where owner_id = test_owner;
    delete from public.reward_events where owner_id = test_owner;
    update public.focus_sessions set status = 'cancelled', ended_at = now()
      where owner_id = test_owner and status in ('running', 'paused');
    -- Wild Pokémon only exist on campaign routes (T-030): open Route 201 for this test.
    delete from public.campaign_node_progress where owner_id = test_owner;
    insert into public.campaign_node_progress (owner_id, node_id, victories, completed_at)
      values (test_owner, 'sinnoh.twinleaf-town', 1, now());


    -- Scenario A: wild victory -> capture succeeds, species matches the battle's roll.
    insert into public.tasks (owner_id, title, difficulty)
    values (test_owner, '__t025_task_a__', 3) returning id into task_victory;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
    values (test_owner, 'wild', 3, 'task', 3, task_victory, 'sinnoh.route-201') returning id into battle_wild;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_victory;

    if (select wild_species_pokedex_number from public.battles where id = battle_wild) is null then
      raise exception 'FAIL: expected the Route 201 battle to carry a wild species';
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);
    select (public.capture_from_battle(battle_wild)).id into pokemon_a;

    select count(*) into capture_count from public.captures where battle_id = battle_wild;
    if capture_count != 1 then
      raise exception 'FAIL: expected exactly 1 capture row, got %', capture_count;
    end if;

    -- Scenario B: capturing the same battle again returns the SAME pokemon, no duplicate.
    select (public.capture_from_battle(battle_wild)).id into pokemon_b;
    if pokemon_a != pokemon_b then
      raise exception 'FAIL: repeated capture of the same battle must return the same pokemon';
    end if;
    select count(*) into owned_count from public.owned_pokemon where id = pokemon_a;
    if owned_count != 1 then
      raise exception 'FAIL: expected exactly 1 owned_pokemon row for this capture, got %', owned_count;
    end if;

    -- Scenario C: a withdrawal battle cannot be captured.
    insert into public.tasks (owner_id, title, difficulty)
    values (test_owner, '__t025_task_withdrawal__', 1) returning id into task_withdrawal;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
    values (test_owner, 'wild', 3, 'task', 3, task_withdrawal, 'sinnoh.route-201') returning id into battle_withdrawal;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_withdrawal;

    begin
      perform public.capture_from_battle(battle_withdrawal);
      raise exception 'FAIL: expected capture_from_battle to reject a withdrawal battle';
    exception when others then
      if sqlerrm not like '%vitória confirmada%' then
        raise exception 'FAIL: unexpected error capturing a withdrawal battle: %', sqlerrm;
      end if;
    end;

    -- Scenario D: party position uniqueness + swap.
    insert into public.tasks (owner_id, title, difficulty)
    values (test_owner, '__t025_task_b__', 3) returning id into task_other;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
    values (test_owner, 'wild', 3, 'task', 3, task_other, 'sinnoh.route-201') returning id into battle_other_wild;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_other;
    select (public.capture_from_battle(battle_other_wild)).id into pokemon_c;

    update public.owned_pokemon set party_position = 1 where id = pokemon_a;
    update public.owned_pokemon set party_position = 2 where id = pokemon_c;

    begin
      update public.owned_pokemon set party_position = 1 where id = pokemon_c;
    exception when unique_violation then
      got_unique_violation := true;
    end;
    if not got_unique_violation then
      raise exception 'FAIL: expected a unique_violation assigning an already-taken party position';
    end if;

    perform public.swap_party_positions(pokemon_a, pokemon_c);
    select party_position into pos_a from public.owned_pokemon where id = pokemon_a;
    select party_position into pos_b from public.owned_pokemon where id = pokemon_c;
    if pos_a != 2 or pos_b != 1 then
      raise exception 'FAIL: expected swapped positions (2, 1), got (%, %)', pos_a, pos_b;
    end if;

    raise notice 'PASS: capture succeeded once, repeat capture idempotent, withdrawal rejected, duplicate position rejected, swap worked';

    raise exception 'T025_ROLLBACK';
  exception when others then
    if sqlerrm = 'T025_ROLLBACK' then
      raise notice 'PASS: t025 checks hold (all test data rolled back)';
    else
      raise;
    end if;
  end;
end $$;
