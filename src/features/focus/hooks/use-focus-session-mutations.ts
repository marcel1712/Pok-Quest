import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { queryKeys } from '@/shared/lib/query-keys'
import { startSession, updateSession } from '../api/focus-sessions-repository'
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

function useSessionTransitionMutation(
  computePatch: (session: FocusSession) => ReturnType<typeof pauseSession>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (session: FocusSession) => updateSession(session.id, computePatch(session)),
    onSuccess: (session) => syncActiveSession(queryClient, session),
  })
}

export function usePauseFocusSession() {
  return useSessionTransitionMutation((session) => pauseSession(session, new Date().toISOString()))
}

export function useResumeFocusSession() {
  return useSessionTransitionMutation((session) => resumeSession(session, new Date().toISOString()))
}

export function useCancelFocusSession() {
  return useSessionTransitionMutation((session) => cancelSession(session, new Date().toISOString()))
}

export function useConfirmFocusSession() {
  return useSessionTransitionMutation((session) => confirmSession(session, Date.now()))
}
