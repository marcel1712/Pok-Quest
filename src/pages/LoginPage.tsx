import { Navigate } from 'react-router-dom'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { useAuthStore } from '@/features/auth/store/auth-store'

export function LoginPage() {
  const status = useAuthStore((state) => state.status)

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="page-title text-center">PokéQuest</h1>
        <LoginForm />
      </div>
    </div>
  )
}
