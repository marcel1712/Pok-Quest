-- Manual verification for the `record_task_completion_event` trigger (T-013).
-- Not run automatically (no local Postgres/Docker in this project — see
-- docs/DECISIONS.md "Ambiente único"). Run by hand against the linked project when the
-- trigger changes:
--
--   npx supabase db query --linked -f supabase/verification/t013-completion-idempotency.sql
--
-- Creates and fully deletes one disposable task; raises an exception (rolling back
-- everything, including the insert) if any assertion fails, so a failed run always
-- leaves the real database untouched.
--
-- Runs inside one subtransaction that is ALWAYS rolled back (the T013_ROLLBACK exception
-- at the end), so nothing it creates or changes survives, pass or fail.
do $$
declare
  test_owner uuid;
  test_task_id uuid;
  after_first int;
  after_duplicate int;
  after_recomplete int;
begin
  select id into test_owner from auth.users limit 1;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);
    -- Start from a known state, whatever the real account currently holds.
    update public.owned_pokemon set party_position = null where owner_id = test_owner;
    delete from public.reward_events where owner_id = test_owner;
    update public.focus_sessions set status = 'cancelled', ended_at = now()
      where owner_id = test_owner and status in ('running', 'paused');


    insert into public.tasks (owner_id, title, difficulty)
    values (test_owner, '__t013_concurrency_test__', 2)
    returning id into test_task_id;

    -- First completion: must record exactly one event.
    -- clock_timestamp() (not now()/transaction_timestamp()) advances between statements
    -- within this one transaction, standing in for separate client requests each with
    -- their own wall-clock completed_at — unlike now(), which is frozen per transaction.
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = test_task_id;
    select count(*) into after_first from public.productivity_events where source_id = test_task_id;
    if after_first != 1 then
      raise exception 'FAIL: expected 1 event after first completion, got %', after_first;
    end if;

    -- Duplicate "retry"/double-click: status already completed, must NOT add a second event.
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = test_task_id;
    select count(*) into after_duplicate from public.productivity_events where source_id = test_task_id;
    if after_duplicate != 1 then
      raise exception 'FAIL: expected still 1 event after duplicate completion, got %', after_duplicate;
    end if;

    -- Reopen then complete again: a genuinely new completion episode, must add a second event.
    update public.tasks set status = 'pending', completed_at = null where id = test_task_id;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = test_task_id;
    select count(*) into after_recomplete from public.productivity_events where source_id = test_task_id;
    if after_recomplete != 2 then
      raise exception 'FAIL: expected 2 events after reopen+recomplete, got %', after_recomplete;
    end if;

    raise notice 'PASS: after_first=%, after_duplicate=%, after_recomplete=%', after_first, after_duplicate, after_recomplete;

    raise exception 'T013_ROLLBACK';
  exception when others then
    if sqlerrm = 'T013_ROLLBACK' then
      raise notice 'PASS: t013 checks hold (all test data rolled back)';
    else
      raise;
    end if;
  end;
end $$;
