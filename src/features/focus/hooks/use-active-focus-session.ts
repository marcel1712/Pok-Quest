import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { getActiveSession } from '../api/focus-sessions-repository'

/**
 * The single source of truth for "is there a session running/paused right now".
 * Any page can mount this and recover the true state after a reload or a route
 * change — nothing about the timer lives only in component state.
 */
export function useActiveFocusSession() {
  return useQuery({
    queryKey: queryKeys.focusSessions.active(),
    queryFn: getActiveSession,
  })
}
