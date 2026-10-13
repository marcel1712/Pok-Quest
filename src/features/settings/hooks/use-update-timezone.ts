import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { queryKeys } from '@/shared/lib/query-keys'
import { updateTimezone } from '../api/profile-repository'

export function useUpdateTimezone() {
  const queryClient = useQueryClient()
  const ownerId = useAuthStore((state) => state.session?.user.id)

  return useMutation({
    mutationFn: (timezone: string) => {
      if (!ownerId) throw new Error('Usuário não autenticado.')
      return updateTimezone(ownerId, timezone)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile.all }),
  })
}
