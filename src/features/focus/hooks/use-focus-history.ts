import { useQuery } from '@tanstack/react-query'
import { useProfile } from '@/features/settings/hooks/use-profile'
import { queryKeys } from '@/shared/lib/query-keys'
import { listCompletedSessions } from '../api/focus-sessions-repository'
import { summarizeFocusHistory } from '../stats'

export function useFocusHistory() {
  const profile = useProfile()
  const sessionsQuery = useQuery({
    queryKey: queryKeys.focusSessions.completedHistory(),
    queryFn: () => listCompletedSessions(),
  })

  const timezone = profile.data?.timezone ?? 'UTC'
  const summary = sessionsQuery.data
    ? summarizeFocusHistory(sessionsQuery.data, timezone, new Date().toISOString())
    : null

  return {
    isLoading: sessionsQuery.isLoading || profile.isLoading,
    isError: sessionsQuery.isError,
    error: sessionsQuery.error,
    summary,
  }
}
