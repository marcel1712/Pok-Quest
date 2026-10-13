import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { queryKeys } from '@/shared/lib/query-keys'
import { startSession, transitionSession } from '../api/focus-sessions-repository'
import { cancelSession, confirmSession, pauseSession, resumeSession } from '../domain'
import type { StartSessionInput } from '../schemas'
import type { FocusSession } from '../types'

function syncActiveSession(queryClient: QueryClient, session: FocusSession) {
  const isActive = session.status === 'running' || session.status === 'paused'
  queryClient.setQueryData(queryKeys.focusSessions.active(), isActive ? session : null)
  return queryClient.invalidateQueries({ queryKey: queryKeys.focusSessions.all })
}

export function useStartFocusSession() {
  const queryClient = useQueryClient()
  const ownerId = useAuthStore((state) => state.session?.user.id)

  return useMutation({
    mutationFn: (input: StartSessionInput) => {
      if (!ownerId) throw new Error('Usuário não autenticado.')
      return startSession(ownerId, input)
    },
    onSuccess: (session) => syncActiveSession(queryClient, session),
  })
}

/**
 * `fromStatuses` is the status (or statuses) the session must still be in for this
 * transition to actually apply — see `transitionSession` for why that guard matters
 * for retries after a dropped response.
 */
function useSessionTransitionMutation(
  fromStatuses: string[],
  computePatch: (session: FocusSession) => ReturnType<typeof pauseSession>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (session: FocusSession) =>
      transitionSession(session.id, fromStatuses, computePatch(session)),
    onSuccess: (session) => syncActiveSession(queryClient, session),
  })
}

export function usePauseFocusSession() {
  return useSessionTransitionMutation(['running'], (session) =>
    pauseSession(session, new Date().toISOString()),
  )
}

export function useResumeFocusSession() {
  return useSessionTransitionMutation(['paused'], (session) =>
    resumeSession(session, new Date().toISOString()),
  )
}

export function useCancelFocusSession() {
  return useSessionTransitionMutation(['running', 'paused'], (session) =>
    cancelSession(session, new Date().toISOString()),
  )
}

export function useConfirmFocusSession() {
  return useSessionTransitionMutation(['running'], (session) => confirmSession(session, Date.now()))
}
