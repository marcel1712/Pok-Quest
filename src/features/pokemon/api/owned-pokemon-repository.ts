import { supabase } from '@/shared/lib/supabase-client'
import type { Capture, OwnedPokemon } from '../types'

export async function getCaptureForBattle(battleId: string): Promise<Capture | null> {
  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .eq('battle_id', battleId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function listOwnedPokemon(): Promise<OwnedPokemon[]> {
  const { data, error } = await supabase
    .from('owned_pokemon')
    .select('*')
    .order('captured_at', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Plain RLS-governed update — setting your *own* Pokémon's slot isn't a
 * reward-sensitive operation. The partial unique index on (owner_id, party_position)
 * is what actually enforces "no duplicate slot" and the implicit 6-slot cap; this
 * surfaces that as a normal thrown error for the UI to catch.
 */
export async function setPartyPosition(id: string, position: number | null): Promise<OwnedPokemon> {
  const { data, error } = await supabase
    .from('owned_pokemon')
    .update({ party_position: position })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

/** Atomic swap via RPC (see migration) — avoids ever briefly holding two Pokémon in
 * the same slot, which the unique index would otherwise reject mid-swap. */
export async function swapPartyPositions(pokemonIdA: string, pokemonIdB: string): Promise<void> {
  const { error } = await supabase.rpc('swap_party_positions', {
    p_pokemon_a: pokemonIdA,
    p_pokemon_b: pokemonIdB,
  })
  if (error) throw error
}

/**
 * Validates eligibility server-side (own battle, resolved victory, wild, not already
 * captured) — see capture_from_battle in the migration. Retries/duplicate calls for
 * the same battle return the same Pokémon rather than erroring or duplicating it.
 */
export async function captureFromBattle(battleId: string): Promise<OwnedPokemon> {
  const { data, error } = await supabase.rpc('capture_from_battle', { p_battle_id: battleId })
  if (error) throw error
  return data
}

/**
 * Applies a pending evolution already decided server-side by the leveling trigger —
 * the client only ever confirms or leaves it pending, never chooses the target
 * species (see confirm_evolution in the migration).
 */
export async function confirmEvolution(ownedPokemonId: string): Promise<OwnedPokemon> {
  const { data, error } = await supabase.rpc('confirm_evolution', {
    p_owned_pokemon_id: ownedPokemonId,
  })
  if (error) throw error
  return data
}
