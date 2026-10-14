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

type Waiter = {
  resolve: (species: SpeciesCatalogEntry | null) => void
  reject: (error: unknown) => void
}

let waitersByNumber = new Map<number, Waiter[]>()
let flushScheduled = false

async function flush() {
  const batch = waitersByNumber
  waitersByNumber = new Map()
  flushScheduled = false

  const { data, error } = await supabase
    .from('species_catalog')
    .select('*')
    .in('pokedex_number', [...batch.keys()])

  for (const [pokedexNumber, waiters] of batch) {
    const species = data?.find((entry) => entry.pokedex_number === pokedexNumber) ?? null
    for (const waiter of waiters) {
      if (error) waiter.reject(error)
      else waiter.resolve(species)
    }
  }
}

/**
 * One species by number. Lookups asked for in the same tick are coalesced into a single
 * request (T-034): a screen showing six Pokémon makes one `in (...)` query instead of
 * six. Callers still get exactly their own species, or `null` if it does not exist.
 */
export function getSpeciesByPokedexNumber(
  pokedexNumber: number,
): Promise<SpeciesCatalogEntry | null> {
  return new Promise((resolve, reject) => {
    const waiters = waitersByNumber.get(pokedexNumber) ?? []
    waiters.push({ resolve, reject })
    waitersByNumber.set(pokedexNumber, waiters)

    if (!flushScheduled) {
      flushScheduled = true
      setTimeout(() => void flush(), 0)
    }
  })
}
