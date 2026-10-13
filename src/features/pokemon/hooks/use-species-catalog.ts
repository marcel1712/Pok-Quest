import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { getSpeciesByPokedexNumber, listSpeciesCatalog } from '../api/species-catalog-repository'

// Reference content changes only via migrations (a new deploy), never at runtime —
// a long staleTime avoids ever refetching it needlessly within a session (T-024:
// "cache/fallback e política de atualização do catálogo").
const CATALOG_STALE_TIME = 24 * 60 * 60 * 1000

export function useSpeciesCatalog() {
  return useQuery({
    queryKey: queryKeys.speciesCatalog.list(),
    queryFn: listSpeciesCatalog,
    staleTime: CATALOG_STALE_TIME,
  })
}

export function useSpeciesByPokedexNumber(pokedexNumber: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.speciesCatalog.detail(pokedexNumber ?? -1),
    queryFn: () => getSpeciesByPokedexNumber(pokedexNumber as number),
    enabled: typeof pokedexNumber === 'number',
    staleTime: CATALOG_STALE_TIME,
  })
}
