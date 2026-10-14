import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { getSpeciesByPokedexNumber, listSpeciesCatalog } from '../api/species-catalog-repository'
import type { SpeciesCatalogEntry } from '../types'

// Reference content changes only via migrations (a new deploy), never at runtime —
// a long staleTime avoids ever refetching it needlessly within a session (T-024:
// "cache/fallback e política de atualização do catálogo").
const CATALOG_STALE_TIME = 24 * 60 * 60 * 1000

/** The whole catalog (210 species). Only for screens that list it; pass `enabled:
 * false` to hold the request back until it is actually needed. */
export function useSpeciesCatalog({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.speciesCatalog.list(),
    queryFn: listSpeciesCatalog,
    staleTime: CATALOG_STALE_TIME,
    enabled,
  })
}

/**
 * One species. Costs no request when the whole catalog is already cached or on its way
 * (the Team page); otherwise the repository batches same-tick lookups into one request.
 */
export function useSpeciesByPokedexNumber(pokedexNumber: number | null | undefined) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.speciesCatalog.detail(pokedexNumber ?? -1),
    queryFn: async () => {
      const number = pokedexNumber as number
      const listKey = queryKeys.speciesCatalog.list()
      const fromCatalog = (catalog: SpeciesCatalogEntry[]) =>
        catalog.find((entry) => entry.pokedex_number === number) ?? null

      const cached = queryClient.getQueryData<SpeciesCatalogEntry[]>(listKey)
      if (cached) return fromCatalog(cached)

      if (queryClient.isFetching({ queryKey: listKey }) > 0) {
        return fromCatalog(
          await queryClient.ensureQueryData({
            queryKey: listKey,
            queryFn: listSpeciesCatalog,
            staleTime: CATALOG_STALE_TIME,
          }),
        )
      }

      return getSpeciesByPokedexNumber(number)
    },
    enabled: typeof pokedexNumber === 'number',
    staleTime: CATALOG_STALE_TIME,
  })
}
