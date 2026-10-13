-- Manual verification for the campaign unlock rules (T-028). Not run automatically —
-- see t013-completion-idempotency.sql header for why.
--
--   npx supabase db query --linked -f supabase/verification/t028-campaign-unlock.sql
--
-- Unlike the older scripts, this one touches the owner's REAL campaign progress and
-- party, so instead of cleaning up row by row it does everything inside one
-- subtransaction and always rolls it back (the T028_ROLLBACK exception at the end).
-- Nothing below survives, pass or fail.
do $$
declare
  test_owner uuid;
  task_id uuid;
  battle public.battles;
  progress public.campaign_node_progress;
  first_completed_at timestamptz;
  got_error boolean;
  i integer;
begin
  select id into test_owner from auth.users limit 1;

  begin
    delete from public.campaign_node_progress where owner_id = test_owner;
    update public.owned_pokemon set party_position = null where owner_id = test_owner;

    -- 1. A node whose prerequisite is not completed is locked.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t028_locked__', 1) returning id into task_id;
    got_error := false;
    begin
      insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
        values (test_owner, 'wild', 1, 'task', 1, task_id, 'sinnoh.route-201');
    exception when check_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: battle on a locked node was accepted'; end if;

    -- 2. Encounter kind/difficulty come from the node, whatever the client sends.
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
      values (test_owner, 'gymLeader', 5, 'task', 1, task_id, 'sinnoh.twinleaf-town')
      returning * into battle;
    if battle.encounter_kind != 'milestone' or battle.encounter_difficulty != 1 then
      raise exception 'FAIL: encounter not overridden from the node, got %/%', battle.encounter_kind, battle.encounter_difficulty;
    end if;

    -- 3. Winning records progress and completes a 1-victory node.
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;
    select * into progress from public.campaign_node_progress
      where owner_id = test_owner and node_id = 'sinnoh.twinleaf-town';
    if progress.victories is distinct from 1 or progress.completed_at is null then
      raise exception 'FAIL: expected twinleaf-town completed with 1 victory, got % / %', progress.victories, progress.completed_at;
    end if;

    -- 4. A completed, non-repeatable node cannot be fought again.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t028_repeat__', 1) returning id into task_id;
    got_error := false;
    begin
      insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
        values (test_owner, 'milestone', 1, 'task', 1, task_id, 'sinnoh.twinleaf-town');
    exception when check_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: completed non-repeatable node accepted a new battle'; end if;

    -- 5. Route 201 is now unlocked and needs 3 victories; a 4th is allowed (repeatable)
    --    and does not move completed_at.
    for i in 1..4 loop
      if i > 1 then
        insert into public.tasks (owner_id, title, difficulty)
          values (test_owner, '__t028_route_' || i || '__', 1) returning id into task_id;
      end if;
      insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
        values (test_owner, 'wild', 1, 'task', 1, task_id, 'sinnoh.route-201');
      update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;

      select * into progress from public.campaign_node_progress
        where owner_id = test_owner and node_id = 'sinnoh.route-201';
      if progress.victories is distinct from i then
        raise exception 'FAIL: expected % route victories, got %', i, progress.victories;
      end if;
      if (i < 3) != (progress.completed_at is null) then
        raise exception 'FAIL: route completion wrong after % victories (completed_at %)', i, progress.completed_at;
      end if;
      if i = 3 then first_completed_at := progress.completed_at; end if;
    end loop;
    if progress.completed_at != first_completed_at then
      raise exception 'FAIL: completed_at changed on a repeat victory';
    end if;

    -- 6. The commitment cannot be easier than the node (rival, difficulty 2, no party).
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t028_rival__', 1) returning id into task_id;
    got_error := false;
    begin
      insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
        values (test_owner, 'rival', 2, 'task', 1, task_id, 'sinnoh.rival-route-201');
    exception when check_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: commitment below the node difficulty was accepted'; end if;

    -- 7. An unmet commitment is a withdrawal and moves no progress.
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
      values (test_owner, 'rival', 2, 'task', 2, task_id, 'sinnoh.rival-route-201')
      returning * into battle;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;
    select * into battle from public.battles where id = battle.id;
    if battle.result is distinct from 'withdrawal' then
      raise exception 'FAIL: expected withdrawal for a difficulty-1 task against a min-2 commitment, got %', battle.result;
    end if;
    if exists (select 1 from public.campaign_node_progress
                 where owner_id = test_owner and node_id = 'sinnoh.rival-route-201') then
      raise exception 'FAIL: a withdrawal recorded campaign progress';
    end if;

    -- 8. A strong party lowers the minimum (average level 10 -> difficulty 2 becomes 1).
    insert into public.owned_pokemon (owner_id, pokedex_number, level, xp, party_position)
      values (test_owner, 396, 10, 1000, 1);
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t028_rival_party__', 1) returning id into task_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id, campaign_node_id)
      values (test_owner, 'rival', 2, 'task', 1, task_id, 'sinnoh.rival-route-201');

    -- 9. As the real client role: can read own progress, cannot write progress or content.
    perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);
    set local role authenticated;

    if (select count(*) from public.campaign_node_progress) != 2 then
      raise exception 'FAIL: authenticated should see exactly its 2 progress rows';
    end if;

    got_error := false;
    begin
      insert into public.campaign_node_progress (owner_id, node_id, victories, completed_at)
        values (test_owner, 'sinnoh.oreburgh-gym', 1, now());
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could insert campaign progress'; end if;

    got_error := false;
    begin
      update public.campaign_node_progress set victories = 99 where owner_id = test_owner;
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could update campaign progress'; end if;

    got_error := false;
    begin
      update public.campaign_nodes set required_victories = 1;
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could update campaign nodes'; end if;

    reset role;
    raise exception 'T028_ROLLBACK';
  exception when others then
    reset role;
    if sqlerrm = 'T028_ROLLBACK' then
      raise notice 'PASS: campaign unlock rules hold (all test data rolled back)';
    else
      raise;
    end if;
  end;
end $$;
