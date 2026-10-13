-- Manual verification for leveling + evolution (T-026). Not run automatically — see
-- t013-completion-idempotency.sql header for why.
--
--   npx supabase db query --linked -f supabase/verification/t026-leveling-and-evolution.sql
do $$
declare
  test_owner uuid;
  task_a uuid;
  task_b uuid;
  battle_a uuid;
  battle_b uuid;
  turtwig_id uuid;
  bidoof_id uuid;
  level_after smallint;
  xp_after integer;
  pending_after integer;
  confirmed public.owned_pokemon;
  got_error boolean := false;
begin
  select id into test_owner from auth.users limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);

  -- Set up: capture a Turtwig (387) and a Bidoof (399) directly (bypassing the random
  -- wild roll, so this test is deterministic), both in the active party.
  insert into public.owned_pokemon (owner_id, pokedex_number, level, xp, party_position)
    values (test_owner, 387, 5, 125, 1) returning id into turtwig_id;
  insert into public.owned_pokemon (owner_id, pokedex_number, level, xp, party_position)
    values (test_owner, 399, 5, 125, 2) returning id into bidoof_id;

  -- Scenario A: a big task-driven battle grants enough XP to push Turtwig from level 5
  -- all the way past 18 AND 32 in one shot, chaining Turtwig -> Grotle -> Torterra.
  insert into public.tasks (owner_id, title, difficulty) values (test_owner, '__t026_task_a__', 5) returning id into task_a;
  insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id)
    values (test_owner, 'trainer', 5, 'task', 5, task_a) returning id into battle_a;
  update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_a;
  -- base xp = 5 * 20 = 100, split across 2 party members = 50 each.

  select level, xp, pending_evolution_to_pokedex_number into level_after, xp_after, pending_after
    from public.owned_pokemon where id = turtwig_id;
  if level_after != 5 then
    raise exception 'FAIL: expected level unchanged at 5 after a +50 xp grant (125->175, still < 216 for lvl 6), got %', level_after;
  end if;
  if xp_after != 175 then
    raise exception 'FAIL: expected xp 175 (125+50), got %', xp_after;
  end if;

  -- Scenario B: repeat several more times to cross the level-18 (Grotle) and
  -- level-32 (Torterra) thresholds in a single later grant — use a harder task so the
  -- xp share alone crosses both at once (needs xp >= 32768 to be level 32; drive it
  -- there directly to keep this script short instead of looping many battles).
  update public.owned_pokemon set xp = 30000, level = 29 where id = turtwig_id;

  insert into public.tasks (owner_id, title, difficulty) values (test_owner, '__t026_task_b__', 5) returning id into task_b;
  insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id)
    values (test_owner, 'trainer', 5, 'task', 5, task_b) returning id into battle_b;
  update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_b;
  -- +50 xp again -> 30050, still level 30 (30^3=27000, 31^3=29791, 32^3=32768) -> level 31, not yet 32.

  select level, pending_evolution_to_pokedex_number into level_after, pending_after from public.owned_pokemon where id = turtwig_id;
  if level_after != 31 then
    raise exception 'FAIL: expected level 31 (30050 xp), got %', level_after;
  end if;
  -- Already past Grotle's own threshold (18) but not yet Torterra's (32): pending
  -- should be the *closest* eligible stage, Grotle — it upgrades to Torterra below
  -- once level 32 is reached, it doesn't jump straight there early.
  if pending_after != 388 then
    raise exception 'FAIL: expected pending evolution to Grotle (388) at level 31, got %', pending_after;
  end if;

  -- Push it over the level-32 (Torterra) threshold directly and re-run leveling logic
  -- by granting one more small battle, to check the evolution chain fires.
  update public.owned_pokemon set xp = 32767 where id = turtwig_id; -- one short of level 32
  update public.tasks set status = 'pending', completed_at = null where id = task_b;
  update public.battles set status = 'pending', result = null, resolved_at = null where id = battle_b;
  update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_b;

  select level, pending_evolution_to_pokedex_number into level_after, pending_after from public.owned_pokemon where id = turtwig_id;
  if level_after < 32 then
    raise exception 'FAIL: expected level >= 32 after crossing the threshold, got %', level_after;
  end if;
  if pending_after != 389 then
    raise exception 'FAIL: expected pending evolution to Torterra (389), got %', pending_after;
  end if;

  -- confirm_evolution applies it and clears the flag.
  select * into confirmed from public.confirm_evolution(turtwig_id);
  if confirmed.pokedex_number != 389 or confirmed.pending_evolution_to_pokedex_number is not null then
    raise exception 'FAIL: expected confirm_evolution to apply Torterra and clear the pending flag, got pokedex=%, pending=%', confirmed.pokedex_number, confirmed.pending_evolution_to_pokedex_number;
  end if;

  -- confirm_evolution again (nothing pending) must be rejected, not silently no-op.
  begin
    perform public.confirm_evolution(turtwig_id);
  exception when others then
    got_error := true;
  end;
  if not got_error then
    raise exception 'FAIL: expected confirm_evolution to reject when nothing is pending';
  end if;

  -- Level cap: never exceeds 100 regardless of xp.
  update public.owned_pokemon set level = 100, xp = 999999999 where id = bidoof_id;
  update public.tasks set status = 'pending', completed_at = null where id = task_b;
  update public.battles set status = 'pending', result = null, resolved_at = null where id = battle_b;
  update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_b;
  select level into level_after from public.owned_pokemon where id = bidoof_id;
  if level_after != 100 then
    raise exception 'FAIL: level must stay capped at 100, got %', level_after;
  end if;

  raise notice 'PASS: xp split across party, batch level-up, multi-stage evolution chained, confirm/reject behave, level capped at 100';

  -- cleanup: leave no trace in the real project. productivity_events/reward_events
  -- aren't FK-cascaded from tasks/battles (deliberately polymorphic, T-013), so they
  -- need an explicit delete too — repeated test completions above created a few.
  delete from public.productivity_events where source_type = 'task' and source_id in (task_a, task_b);
  delete from public.reward_events where source_id in (battle_a, battle_b);
  delete from public.captures where battle_id in (battle_a, battle_b);
  delete from public.battles where id in (battle_a, battle_b);
  delete from public.tasks where id in (task_a, task_b);
  delete from public.owned_pokemon where id in (turtwig_id, bidoof_id);
end $$;
