import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { getBattleForFocusSession, getBattleForTask } from '../api/battles-repository'

export function useBattleForTask(taskId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.battles.forTask(taskId ?? ''),
    queryFn: () => getBattleForTask(taskId as string),
    enabled: Boolean(taskId),
  })
}

export function useBattleForFocusSession(focusSessionId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.battles.forFocusSession(focusSessionId ?? ''),
    queryFn: () => getBattleForFocusSession(focusSessionId as string),
    enabled: Boolean(focusSessionId),
  })
}
