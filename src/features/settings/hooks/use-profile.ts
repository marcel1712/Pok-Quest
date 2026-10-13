import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { queryKeys } from '@/shared/lib/query-keys'
import { getProfile } from '../api/profile-repository'

export function useProfile() {
  const ownerId = useAuthStore((state) => state.session?.user.id)

  return useQuery({
    queryKey: queryKeys.profile.detail(ownerId ?? ''),
    queryFn: () => getProfile(ownerId as string),
    enabled: Boolean(ownerId),
  })
}
