import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { queryKeys } from '@/shared/lib/query-keys'
import { createBattle } from '../api/battles-repository'
import type { CreateBattleInput } from '../schemas'

export function useCreateBattle() {
  const queryClient = useQueryClient()
  const ownerId = useAuthStore((state) => state.session?.user.id)

  return useMutation({
    mutationFn: (input: CreateBattleInput) => {
      if (!ownerId) throw new Error('Usuário não autenticado.')
      return createBattle(ownerId, input)
    },
    onSuccess: (battle) => {
      if (battle.task_id) {
        queryClient.setQueryData(queryKeys.battles.forTask(battle.task_id), battle)
      }
      if (battle.focus_session_id) {
        queryClient.setQueryData(queryKeys.battles.forFocusSession(battle.focus_session_id), battle)
      }
    },
  })
}
