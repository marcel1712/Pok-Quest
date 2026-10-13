-- Defense-in-depth, not a fix for an active exploit: `capture_from_battle` and
-- `swap_party_positions` both filter every lookup/update by `owner_id = auth.uid()`,
-- so an anon caller (auth.uid() = null) can never match a row — verified with curl
-- against the live project (got "Batalha não encontrada", no state change). Still,
-- these functions got a broad `PUBLIC` EXECUTE grant on creation (distinct from the
-- per-role `anon`/`authenticated` grants seen on other functions — Postgres grant
-- defaults aren't fully consistent across function creations in this project), so we
-- revoke it explicitly rather than rely on the functions' own internal check as the
-- only line of defense. `authenticated` keeps its own separate grant and is unaffected.
revoke all on function public.capture_from_battle(uuid) from public;
revoke all on function public.swap_party_positions(uuid, uuid) from public;
