import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { getCaptureForBattle } from '../api/owned-pokemon-repository'

export function useCaptureForBattle(battleId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.captures.forBattle(battleId ?? ''),
    queryFn: () => getCaptureForBattle(battleId as string),
    enabled: Boolean(battleId),
  })
}
