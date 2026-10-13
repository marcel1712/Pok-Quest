import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { queryKeys } from '@/shared/lib/query-keys'
import { getCampaignContent, listCampaignProgress } from '../api/campaign-repository'
import { buildJourney, pickObjective } from '../domain'

// Content changes only through a seed migration, never during a session.
const CONTENT_STALE_TIME = 24 * 60 * 60 * 1000

export function useJourney() {
  const content = useQuery({
    queryKey: queryKeys.campaign.content(),
    queryFn: getCampaignContent,
    staleTime: CONTENT_STALE_TIME,
  })
  const progress = useQuery({
    queryKey: queryKeys.campaign.progress(),
    queryFn: listCampaignProgress,
  })

  const journey = useMemo(
    () => (content.data && progress.data ? buildJourney(content.data, progress.data) : []),
    [content.data, progress.data],
  )
  const objective = useMemo(() => pickObjective(journey), [journey])

  return {
    journey,
    objective,
    isLoading: content.isLoading || progress.isLoading,
    isError: content.isError || progress.isError,
    error: content.error ?? progress.error,
  }
}
