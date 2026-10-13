-- Real gap found while starting T-026: RLS on `owned_pokemon` (T-025) only restricts
-- which ROWS `authenticated` can UPDATE (`owner_id = auth.uid()`) — it says nothing
-- about which COLUMNS. The default blanket table-level UPDATE grant meant an
-- authenticated user could legally PATCH their own Pokémon's `level`, `xp`, or
-- `pokedex_number` directly to anything, bypassing the entire reward/leveling system
-- this task is about to build. RLS row-filtering and column-level grants are two
-- separate layers; this project had only applied the first one. Verified via
-- information_schema.column_privileges before writing this fix.
--
-- `party_position` and `nickname` are the only columns a client legitimately manages
-- itself (team arrangement, a cosmetic name) — everything else (level, xp,
-- pokedex_number, pending_evolution_to_pokedex_number once T-026 adds it) is only ever
-- written by SECURITY DEFINER functions, which run as the table owner and are
-- unaffected by column grants.
revoke update on public.owned_pokemon from authenticated;
revoke update on public.owned_pokemon from anon;
grant update (party_position, nickname) on public.owned_pokemon to authenticated;
