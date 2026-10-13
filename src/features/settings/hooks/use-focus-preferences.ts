import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { queryKeys } from '@/shared/lib/query-keys'
import { updateFocusPreferences } from '../api/profile-repository'
import { parseFocusPreferences, type FocusPreferencesInput } from '../schemas'
import { DEFAULT_FOCUS_PREFERENCES } from '../types'
import { useProfile } from './use-profile'

/** Preferences merged with safe defaults — never undefined, even before the profile loads. */
export function useFocusPreferences() {
  const profile = useProfile()
  const preferences = profile.data
    ? parseFocusPreferences(profile.data.settings)
    : DEFAULT_FOCUS_PREFERENCES

  return { ...profile, preferences }
}

export function useUpdateFocusPreferences() {
  const queryClient = useQueryClient()
  const ownerId = useAuthStore((state) => state.session?.user.id)

  return useMutation({
    mutationFn: (preferences: FocusPreferencesInput) => {
      if (!ownerId) throw new Error('Usuário não autenticado.')
      return updateFocusPreferences(ownerId, preferences)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile.all }),
  })
}
