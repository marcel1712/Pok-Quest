-- Manual verification for the history view, its summary and task retention (T-035).
-- Not run automatically — see t013-completion-idempotency.sql header for why.
--
--   npx supabase db query --linked -f supabase/verification/t035-history-and-retention.sql
--
-- One subtransaction, always rolled back: it creates and purges tasks, rewrites the
-- owner's profile timezone and inserts focus sessions, none of which may survive.
do $$
declare
  test_owner uuid;
  old_task uuid;
  old_archived uuid;
  recent_task uuid;
  old_pending uuid;
  old_battle uuid;
  purged integer;
  event public.productivity_events;
  battle public.battles;
  summary record;
  expected integer;
  local_midnight timestamptz;
  today_before integer;
  got_error boolean;
begin
  select id into test_owner from auth.users limit 1;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);
    update public.owned_pokemon set party_position = null where owner_id = test_owner;

    -- 1. Completing a task records its title and difficulty in the ledger.
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t035_old__', 4) returning id into old_task;
    insert into public.battles (owner_id, encounter_kind, encounter_difficulty, commitment_type, commitment_min_difficulty, task_id)
      values (test_owner, 'trainer', 1, 'task', 1, old_task) returning id into old_battle;
    update public.tasks set status = 'completed', completed_at = clock_timestamp() where id = old_task;
    select * into event from public.productivity_events where source_type = 'task' and source_id = old_task;
    if event.title is distinct from '__t035_old__' or event.difficulty is distinct from 4 then
      raise exception 'FAIL: completion event did not keep title/difficulty: %', event;
    end if;

    -- 2. Retention: only completed/archived tasks older than 90 days are purged.
    update public.tasks set completed_at = now() - interval '91 days' where id = old_task;
    insert into public.tasks (owner_id, title, difficulty, status)
      values (test_owner, '__t035_archived__', 1, 'archived') returning id into old_archived;
    -- updated_at is maintained by a trigger; age it with the trigger off.
    alter table public.tasks disable trigger set_tasks_updated_at;
    update public.tasks set updated_at = now() - interval '91 days' where id = old_archived;
    alter table public.tasks enable trigger set_tasks_updated_at;
    insert into public.tasks (owner_id, title, difficulty)
      values (test_owner, '__t035_recent__', 1) returning id into recent_task;
    update public.tasks set status = 'completed', completed_at = now() - interval '89 days' where id = recent_task;
    insert into public.tasks (owner_id, title, difficulty, created_at)
      values (test_owner, '__t035_pending__', 1, now() - interval '400 days') returning id into old_pending;

    purged := public.purge_old_tasks();
    if purged != 2 then raise exception 'FAIL: expected 2 purged tasks, got %', purged; end if;
    if exists (select 1 from public.tasks where id in (old_task, old_archived)) then
      raise exception 'FAIL: an old completed/archived task survived the purge';
    end if;
    if (select count(*) from public.tasks where id in (recent_task, old_pending)) != 2 then
      raise exception 'FAIL: the purge deleted a recent or still-pending task';
    end if;

    -- 3. The purge keeps the ledger: the event (with its title), the resolved battle
    --    (now without a task) and its XP are all still there, and in the history.
    select * into event from public.productivity_events where source_type = 'task' and source_id = old_task;
    if event.title is distinct from '__t035_old__' then
      raise exception 'FAIL: the completion event did not survive the purge';
    end if;
    select * into battle from public.battles where id = old_battle;
    if battle.id is null or battle.task_id is not null or battle.result is distinct from 'victory' then
      raise exception 'FAIL: the resolved battle should survive with task_id null, got %', battle;
    end if;
    if not exists (select 1 from public.reward_events where source_id = old_battle) then
      raise exception 'FAIL: the battle reward did not survive the purge';
    end if;
    if not exists (select 1 from public.history_entries
                     where kind = 'task' and title = '__t035_old__' and amount = 4) then
      raise exception 'FAIL: the purged task is missing from the history';
    end if;

    -- 4. The all-time summary reconciles with the source tables.
    select * into summary from public.get_history_summary() where period = 'allTime';

    select count(*) into expected from public.productivity_events
      where owner_id = test_owner and source_type = 'task';
    if summary.tasks_completed != expected then
      raise exception 'FAIL: tasks_completed % != % completion events', summary.tasks_completed, expected;
    end if;

    select coalesce(sum(round(planned_duration_seconds / 60.0)), 0) into expected
      from public.focus_sessions where owner_id = test_owner and status = 'completed';
    if summary.focus_minutes != expected then
      raise exception 'FAIL: focus_minutes % != % from focus_sessions', summary.focus_minutes, expected;
    end if;

    select count(*) into expected from public.battles
      where owner_id = test_owner and status = 'resolved' and result = 'victory';
    if summary.victories != expected then
      raise exception 'FAIL: victories % != % resolved victories', summary.victories, expected;
    end if;

    select coalesce(sum(amount), 0) into expected from public.reward_events
      where owner_id = test_owner and source_type = 'battle';
    if summary.xp_earned != expected then
      raise exception 'FAIL: xp_earned % != % from reward_events', summary.xp_earned, expected;
    end if;

    -- 5. "Today" turns over at midnight in the profile's timezone, not in UTC: of two
    --    sessions one minute either side of local midnight, only the later one counts.
    update public.profiles set timezone = 'America/Sao_Paulo' where id = test_owner;
    local_midnight := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
    select s.focus_sessions into today_before from public.get_history_summary() s where period = 'today';

    insert into public.focus_sessions (owner_id, planned_duration_seconds, status, started_at, ended_at)
      values (test_owner, 600, 'completed', local_midnight - interval '11 minutes', local_midnight - interval '1 minute');
    insert into public.focus_sessions (owner_id, planned_duration_seconds, status, started_at, ended_at)
      values (test_owner, 600, 'completed', local_midnight - interval '9 minutes', local_midnight + interval '1 second');

    select * into summary from public.get_history_summary() where period = 'today';
    if summary.focus_sessions != today_before + 1 then
      raise exception 'FAIL: expected exactly one of the two midnight sessions to count today (% -> %)', today_before, summary.focus_sessions;
    end if;

    -- 6. As the real client role: own history is readable, the purge is not callable,
    --    and evolution history cannot be forged.
    set local role authenticated;

    if (select count(*) from public.history_entries where owner_id != test_owner) != 0 then
      raise exception 'FAIL: history shows rows of another owner';
    end if;
    if (select count(*) from public.history_entries) = 0 then
      raise exception 'FAIL: authenticated cannot read its own history';
    end if;

    got_error := false;
    begin
      perform public.purge_old_tasks(interval '0 days');
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could call purge_old_tasks'; end if;

    got_error := false;
    begin
      insert into public.evolution_events (owner_id, from_pokedex_number, to_pokedex_number)
        values (test_owner, 390, 392);
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could insert an evolution event'; end if;

    reset role;
    raise exception 'T035_ROLLBACK';
  exception when others then
    reset role;
    if sqlerrm = 'T035_ROLLBACK' then
      raise notice 'PASS: history and retention rules hold (all test data rolled back)';
    else
      raise;
    end if;
  end;
end $$;
