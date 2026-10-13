import type { OwnedPokemon } from '@/features/pokemon/types'
import { supabase } from '@/shared/lib/supabase-client'
import type { GameProgress } from '../types'

/** `null` means the player has not chosen a starter yet. */
export async function getGameProgress(): Promise<GameProgress | null> {
  const { data, error } = await supabase.from('game_progress').select('*').maybeSingle()
  if (error) throw error
  return data
}

/**
 * One-time operation enforced by the database (see choose_starter in the migration):
 * the client only names one of the catalog's starters. A second call — double click,
 * another device — fails with 23505 and creates nothing.
 */
export async function chooseStarter(pokedexNumber: number): Promise<OwnedPokemon> {
  const { data, error } = await supabase.rpc('choose_starter', {
    p_pokedex_number: pokedexNumber,
  })
  if (error) throw error
  return data
}
