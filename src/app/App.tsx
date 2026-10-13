import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { startAuthListener } from '@/features/auth/store/auth-store'
import { queryClient } from '@/shared/lib/query-client'
import { router } from './router'

startAuthListener()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
