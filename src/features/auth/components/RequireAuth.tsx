import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/auth-store'

export function RequireAuth() {
  const status = useAuthStore((state) => state.status)

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink-muted">
        Carregando…
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
