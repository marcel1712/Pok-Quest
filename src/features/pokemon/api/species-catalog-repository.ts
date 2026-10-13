import { supabase } from '@/shared/lib/supabase-client'
import type { SpeciesCatalogEntry } from '../types'

/**
 * Reads the locally-stored catalog only — never fetches PokéAPI at runtime (T-024:
 * "proibir fetch da PokéAPI em cada renderização"). The catalog is populated exclusively
 * by reviewed migrations generated from scripts/import-species-catalog.ts.
 */
export async function listSpeciesCatalog(): Promise<SpeciesCatalogEntry[]> {
  const { data, error } = await supabase
    .from('species_catalog')
    .select('*')
    .order('pokedex_number', { ascending: true })

  if (error) throw error
  return data
}

export async function getSpeciesByPokedexNumber(
  pokedexNumber: number,
): Promise<SpeciesCatalogEntry | null> {
  const { data, error } = await supabase
    .from('species_catalog')
    .select('*')
    .eq('pokedex_number', pokedexNumber)
    .maybeSingle()

  if (error) throw error
  return data
}
