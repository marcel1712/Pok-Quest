-- Manual verification for gyms and badges (T-031). Not run automatically — see
-- t013-completion-idempotency.sql header for why.
--
--   npx supabase db query --linked -f supabase/verification/t031-gym-badges.sql
--
-- Same approach as t028–t030: one subtransaction that is always rolled back, because
-- it rewrites the owner's real campaign progress to stand right before the first gym.
do $$
declare
  test_owner uuid;
  gym_order integer;
  task_id uuid;
  task_a uuid;
  task_b uuid;
  battle_a public.battles;
  battle_b public.battles;
  battle public.battles;
  encounter public.encounters;
  badge public.badges;
  got_error boolean;
begin
  select id into test_owner from auth.users limit 1;
  select sort_order into gym_order from public.campaign_nodes where id = 'sinnoh.oreburgh-gym';

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);
    delete from public.badges where owner_id = test_owner;
    delete from public.campaign_node_progress where owner_id = test_owner;
    update public.encounters set consumed_at = now() where owner_id = test_owner and consumed_at is null;
    update public.owned_pokemon set party_position = null where owner_id = test_owner;

    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t031_skip__', 5) returning id into task_id;

    -- 1. A new player cannot walk straight into the gym.
    got_error := false;
    begin
      insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
        values (test_owner, 'gymLeader', 3, 'task', 3, task_id, 'sinnoh.oreburgh-gym');
    exception when check_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: the gym was open to a player with no progress'; end if;

    -- Put the player right before the gym: every earlier node completed.
    insert into public.campaign_node_progress (owner_id, node_id, victories, completed_at)
      select test_owner, id, required_victories, now()
        from public.campaign_nodes where region_id = 'sinnoh' and sort_order < gym_order;

    -- 2. The gym cannot be skipped: the node after it stays locked until it is beaten.
    got_error := false;
    begin
      insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
        values (test_owner, 'trainer', 2, 'task', 2, task_id, 'sinnoh.jubilife-galactic');
    exception when check_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: the chapter after the gym was reachable without the badge'; end if;

    encounter := public.get_or_create_encounter();
    if encounter.campaign_node_id != 'sinnoh.oreburgh-gym' or encounter.encounter_kind != 'gymLeader' then
      raise exception 'FAIL: expected the gym as the current encounter, got %', encounter;
    end if;

    -- 3. Losing (commitment not met) earns no badge.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t031_lose__', 1) returning id into task_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, encounter_id)
      values (test_owner, 'gymLeader', 3, 'task', 3, task_id, encounter.id) returning * into battle;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;
    if exists (select 1 from public.badges where owner_id = test_owner) then
      raise exception 'FAIL: a withdrawal earned a badge';
    end if;

    -- 4. Two devices: two battles against the gym are pending at once and both are won.
    --    Exactly one badge, tied to the first victory.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t031_device_a__', 3) returning id into task_a;
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t031_device_b__', 3) returning id into task_b;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, encounter_id)
      values (test_owner, 'gymLeader', 3, 'task', 3, task_a, encounter.id) returning * into battle_a;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, encounter_id)
      values (test_owner, 'gymLeader', 3, 'task', 3, task_b, encounter.id) returning * into battle_b;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_a;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_b;

    if (select count(*) from public.badges where owner_id = test_owner) != 1 then
      raise exception 'FAIL: expected exactly one badge after two simultaneous victories';
    end if;
    select * into badge from public.badges where owner_id = test_owner;
    if badge.node_id != 'sinnoh.oreburgh-gym' or badge.battle_id != battle_a.id then
      raise exception 'FAIL: badge not tied to the first winning battle: %', badge;
    end if;
    select * into battle from public.battles where id = battle_b.id;
    if battle.result is distinct from 'victory' then
      raise exception 'FAIL: the second device''s battle should still resolve as a victory';
    end if;

    -- 5. The gym cannot be fought again for another badge.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t031_again__', 3) returning id into task_id;
    got_error := false;
    begin
      insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
        values (test_owner, 'gymLeader', 3, 'task', 3, task_id, 'sinnoh.oreburgh-gym');
    exception when check_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: a beaten gym accepted a rematch'; end if;

    -- 6. The next chapter is now open, and completing a node without a badge adds none.
    encounter := public.get_or_create_encounter();
    if encounter.campaign_node_id != 'sinnoh.jubilife-galactic' then
      raise exception 'FAIL: expected the next chapter after the gym, got %', encounter.campaign_node_id;
    end if;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, encounter_id)
      values (test_owner, 'trainer', 2, 'task', 2, task_id, encounter.id);
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;
    if (select count(*) from public.badges where owner_id = test_owner) != 1 then
      raise exception 'FAIL: a node without a badge changed the badge count';
    end if;

    -- 7. As the real client role: read own badges, never write them.
    set local role authenticated;

    if (select count(*) from public.badges) != 1 then
      raise exception 'FAIL: authenticated should see exactly its one badge';
    end if;

    got_error := false;
    begin
      insert into public.badges (owner_id, node_id, battle_id)
        values (test_owner, 'sinnoh.eterna-gym', battle_a.id);
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could insert a badge'; end if;

    got_error := false;
    begin
      delete from public.badges;
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could delete badges'; end if;

    reset role;
    raise exception 'T031_ROLLBACK';
  exception when others then
    reset role;
    if sqlerrm = 'T031_ROLLBACK' then
      raise notice 'PASS: gym and badge rules hold (all test data rolled back)';
    else
      raise;
    end if;
  end;
end $$;
