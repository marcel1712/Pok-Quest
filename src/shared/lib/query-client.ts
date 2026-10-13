import { QueryClient } from '@tanstack/react-query'
import { isPostgrestError } from './supabase-error'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      // RLS/permission and conflict errors won't resolve themselves on retry.
      retry: (failureCount, error) => {
        if (isPostgrestError(error) && ['42501', '23505', '23514'].includes(error.code)) {
          return false
        }
        return failureCount < 1
      },
    },
    mutations: {
      retry: false,
    },
  },
})
