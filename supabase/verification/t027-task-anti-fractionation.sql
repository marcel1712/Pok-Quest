-- Manual verification for task XP anti-fractionation (T-027). Not run automatically —
-- see t013-completion-idempotency.sql header for why.
--
--   npx supabase db query --linked -f supabase/verification/t027-task-anti-fractionation.sql
do $$
declare
  test_owner uuid;
  task_ids uuid[] := array[]::uuid[];
  battle_ids uuid[] := array[]::uuid[];
  task_id uuid;
  battle_id uuid;
  amounts integer[] := array[]::integer[];
  amount integer;
  i integer;
begin
  select id into test_owner from auth.users limit 1;

  -- 6 trivial (difficulty 1) tasks, each with its own wild-kind battle, completed
  -- back to back — simulates someone trying to farm XP via microtasks in one day.
  for i in 1..6 loop
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t027_frac_task_' || i || '__', 1) returning id into task_id;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id)
      values (test_owner, 'trainer', 1, 'task', 1, task_id) returning id into battle_id;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = task_id;

    task_ids := array_append(task_ids, task_id);
    battle_ids := array_append(battle_ids, battle_id);

    select re.amount into amount from public.reward_events re where re.source_id = battle_id;
    amounts := array_append(amounts, amount);
  end loop;

  raise notice 'XP per task (1..6): %', amounts;

  if amounts[1] != 20 or amounts[2] != 20 or amounts[3] != 20 or amounts[4] != 20 or amounts[5] != 20 then
    raise exception 'FAIL: expected the first 5 task completions today to earn full XP (20 each), got %', amounts;
  end if;
  if amounts[6] != 10 then
    raise exception 'FAIL: expected the 6th task completion today to be diminished to 10 XP, got %', amounts[6];
  end if;

  raise notice 'PASS: first 5 tasks full XP (20 each), 6th diminished to 10';

  -- cleanup: leave no trace in the real project.
  delete from public.productivity_events where source_type = 'task' and source_id = any(task_ids);
  delete from public.reward_events where source_id = any(battle_ids);
  delete from public.battles where id = any(battle_ids);
  delete from public.tasks where id = any(task_ids);
end $$;
