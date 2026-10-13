import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { listRewardEvents, type RewardEventFilters } from '../api/reward-events-repository'

export function useRewardEvents(filters: RewardEventFilters = {}) {
  return useQuery({
    queryKey: queryKeys.rewardEvents.list(filters),
    queryFn: () => listRewardEvents(filters),
  })
}
