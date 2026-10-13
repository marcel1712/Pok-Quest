-- Manual verification for focus_sessions (T-016): one-active-session constraint and the
-- completion trigger. Not run automatically — see t013-completion-idempotency.sql header.
--
--   npx supabase db query --linked -f supabase/verification/t016-focus-sessions.sql
do $$
declare
  test_owner uuid;
  session_a uuid;
  session_b uuid;
  event_count int;
  got_unique_violation boolean := false;
begin
  select id into test_owner from auth.users limit 1;

  insert into public.focus_sessions (owner_id, planned_duration_seconds)
  values (test_owner, 1500)
  returning id into session_a;

  -- A second concurrent active session for the same owner must be rejected by the DB.
  begin
    insert into public.focus_sessions (owner_id, planned_duration_seconds)
    values (test_owner, 1500)
    returning id into session_b;
  exception when unique_violation then
    got_unique_violation := true;
  end;

  if not got_unique_violation then
    raise exception 'FAIL: expected a unique_violation starting a second active session, got none';
  end if;

  -- Confirming the session must record exactly one productivity event.
  update public.focus_sessions
    set status = 'completed', ended_at = clock_timestamp()
    where id = session_a;
  select count(*) into event_count
    from public.productivity_events
    where source_type = 'focus_session' and source_id = session_a;
  if event_count != 1 then
    raise exception 'FAIL: expected 1 event after completion, got %', event_count;
  end if;

  -- Re-confirming (retry/double click) must not add a second event.
  update public.focus_sessions
    set status = 'completed', ended_at = clock_timestamp()
    where id = session_a;
  select count(*) into event_count
    from public.productivity_events
    where source_type = 'focus_session' and source_id = session_a;
  if event_count != 1 then
    raise exception 'FAIL: expected still 1 event after duplicate confirm, got %', event_count;
  end if;

  -- Now that session_a is terminal, starting a new active session must succeed.
  insert into public.focus_sessions (owner_id, planned_duration_seconds)
  values (test_owner, 1500)
  returning id into session_b;

  raise notice 'PASS: unique_violation=%, event_count=%, session_b=%', got_unique_violation, event_count, session_b;

  -- cleanup: leave no trace in the real project.
  delete from public.productivity_events where source_type = 'focus_session' and source_id in (session_a, session_b);
  delete from public.focus_sessions where id in (session_a, session_b);
end $$;
