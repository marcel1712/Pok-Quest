-- Fixes a real gap in the previous migration: Supabase grants EXECUTE on every new
-- function to `anon` by default (confirmed via information_schema.routine_privileges),
-- not just `authenticated`/`public`. The previous migration only revoked from
-- `authenticated`/`public`, so an unauthenticated request with just the anon key could
-- still call resolve_pending_battle directly and forge arbitrary XP. Verified exploit
-- with curl against the live project before this fix; verified fixed after it.
revoke all on function public.resolve_pending_battle(uuid, uuid, uuid, smallint, numeric) from anon;
