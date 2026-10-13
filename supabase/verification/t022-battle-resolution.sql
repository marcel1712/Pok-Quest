-- Manual verification for battle resolution (T-022). Not run automatically — see
-- t013-completion-idempotency.sql header for why.
--
--   npx supabase db query --linked -f supabase/verification/t022-battle-resolution.sql
do $$
declare
  test_owner uuid;
  task_victory uuid;
  task_withdrawal uuid;
  battle_victory uuid;
  battle_withdrawal uuid;
  reward_count int;
  battle_row public.battles;
  got_unique_violation boolean := false;
begin
  select id into test_owner from auth.users limit 1;

  -- Scenario A: commitment met -> victory, exactly one reward event with the right XP.
  insert into public.tasks (owner_id, title, difficulty)
  values (test_owner, '__t022_victory_task__', 4)
  returning id into task_victory;

  insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id)
  values (test_owner, 'trainer', 3, 'task', 3, task_victory)
  returning id into battle_victory;

  update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_victory;

  select * into battle_row from public.battles where id = battle_victory;
  if battle_row.status != 'resolved' or battle_row.result != 'victory' then
    raise exception 'FAIL: expected battle_victory resolved as victory, got status=%, result=%', battle_row.status, battle_row.result;
  end if;

  select count(*) into reward_count from public.reward_events where source_id = battle_victory;
  if reward_count != 1 then
    raise exception 'FAIL: expected exactly 1 reward event, got %', reward_count;
  end if;
  if (select amount from public.reward_events where source_id = battle_victory) != 80 then
    raise exception 'FAIL: expected 80 XP (4 * 20), got %', (select amount from public.reward_events where source_id = battle_victory);
  end if;

  -- Scenario B: commitment NOT met (task difficulty too low) -> withdrawal, 0 XP, but
  -- the task completion itself must still succeed (battles must never block productivity).
  insert into public.tasks (owner_id, title, difficulty)
  values (test_owner, '__t022_withdrawal_task__', 1)
  returning id into task_withdrawal;

  insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id)
  values (test_owner, 'trainer', 3, 'task', 3, task_withdrawal)
  returning id into battle_withdrawal;

  update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_withdrawal;

  if (select status from public.tasks where id = task_withdrawal) != 'completed' then
    raise exception 'FAIL: task completion must succeed even when the battle resolves to withdrawal';
  end if;

  select * into battle_row from public.battles where id = battle_withdrawal;
  if battle_row.status != 'resolved' or battle_row.result != 'withdrawal' then
    raise exception 'FAIL: expected battle_withdrawal resolved as withdrawal, got status=%, result=%', battle_row.status, battle_row.result;
  end if;

  select count(*) into reward_count from public.reward_events where source_id = battle_withdrawal;
  if reward_count != 0 then
    raise exception 'FAIL: expected 0 reward events for a withdrawal, got %', reward_count;
  end if;

  -- Scenario C: a second battle for the same task must be rejected (unique constraint).
  begin
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id)
    values (test_owner, 'wild', 1, 'task', 1, task_victory);
  exception when unique_violation then
    got_unique_violation := true;
  end;
  if not got_unique_violation then
    raise exception 'FAIL: expected a unique_violation creating a second battle for the same task';
  end if;

  raise notice 'PASS: victory XP=80, withdrawal XP=0, task completion survived withdrawal, duplicate battle rejected';

  -- cleanup: leave no trace in the real project.
  delete from public.reward_events where source_id in (battle_victory, battle_withdrawal);
  delete from public.battles where id in (battle_victory, battle_withdrawal);
  delete from public.tasks where id in (task_victory, task_withdrawal);
end $$;
