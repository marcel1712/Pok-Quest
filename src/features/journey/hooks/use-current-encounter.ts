import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { getCurrentEncounter } from '../api/campaign-repository'

export function useCurrentEncounter() {
  return useQuery({
    queryKey: queryKeys.campaign.encounter(),
    queryFn: getCurrentEncounter,
  })
}
