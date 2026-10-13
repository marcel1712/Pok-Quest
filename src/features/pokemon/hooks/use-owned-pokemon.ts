import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { listOwnedPokemon } from '../api/owned-pokemon-repository'

export function useOwnedPokemon() {
  return useQuery({
    queryKey: queryKeys.ownedPokemon.list(),
    queryFn: listOwnedPokemon,
  })
}
