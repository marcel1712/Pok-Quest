import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { listBadges } from '../api/campaign-repository'

export function useBadges() {
  return useQuery({
    queryKey: queryKeys.campaign.badges(),
    queryFn: listBadges,
  })
}
