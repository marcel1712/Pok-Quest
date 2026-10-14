-- Least-privilege grants (T-038).
--
-- Supabase's default privileges give `anon` and `authenticated` every table privilege
-- (INSERT, UPDATE, DELETE, TRUNCATE...) on every new table, and EXECUTE on every new
-- function. The tables created before T-028 still carried those grants and relied on
-- RLS alone. No hole was found — RLS blocked the rows — but a single forgotten policy,
-- or a privilege RLS does not cover (TRUNCATE), would have had nothing behind it.
-- After this migration a role can only do what the app actually needs it to do, and
-- RLS narrows that further to the caller's own rows.

-- 1. `anon` has no business in the public schema at all: signing in goes through the
--    auth API, and every screen requires a session.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- 2. `authenticated`: start from nothing, then grant exactly what the client uses.
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
revoke all on all functions in schema public from authenticated, public;

-- The user's own working data (RLS: own rows only).
grant select, insert, update, delete on public.tasks, public.categories to authenticated;
grant select, insert, update on public.focus_sessions, public.profiles to authenticated;

-- Declaring a commitment is an insert; resolving it is the server's job.
grant select, insert on public.battles to authenticated;

-- Party management only. Level, XP and species stay server-side (see T-026).
grant select on public.owned_pokemon to authenticated;
grant update (party_position, nickname) on public.owned_pokemon to authenticated;

-- Ledgers, progress and reference content: read-only for the client, written solely by
-- SECURITY DEFINER functions and triggers.
grant select on
  public.productivity_events, public.reward_events, public.captures, public.badges,
  public.encounters, public.evolution_events, public.game_progress,
  public.campaign_node_progress, public.history_entries,
  public.species_catalog, public.campaign_regions, public.campaign_nodes,
  public.campaign_node_prerequisites, public.campaign_node_wild_encounters
  to authenticated;

-- The RPCs the app calls. Everything else — trigger functions, resolve_pending_battle,
-- roll_wild_encounter, current_campaign_objective, purge_old_tasks, total_xp_for_level
-- — is internal: reachable only from inside other functions and triggers, which run
-- with their owner's privileges.
grant execute on function public.capture_from_battle(uuid) to authenticated;
grant execute on function public.choose_starter(integer) to authenticated;
grant execute on function public.confirm_evolution(uuid) to authenticated;
grant execute on function public.get_or_create_encounter() to authenticated;
grant execute on function public.get_history_summary() to authenticated;
grant execute on function public.swap_party_positions(uuid, uuid) to authenticated;

-- 3. Safe by default from now on: objects created by future migrations start with no
--    client access, so forgetting a `revoke` can no longer expose anything. Each
--    migration must grant what its table or function needs, explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- PUBLIC's EXECUTE on new functions is a built-in default; it can only be removed for
-- the role as a whole, not per schema.
alter default privileges for role postgres revoke execute on functions from public;
