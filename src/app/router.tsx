import { createBrowserRouter } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { LoginPage } from '@/pages/LoginPage'
import { pageLoaders } from './page-loaders'
import { RootLayout } from './RootLayout'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    // Shown only on a cold load, while the first page's chunk is on its way.
    hydrateFallbackElement: (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink-muted">
        Carregando…
      </div>
    ),
    children: [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, lazy: pageLoaders['/'] },
          { path: 'tasks', lazy: pageLoaders['/tasks'] },
          { path: 'focus', lazy: pageLoaders['/focus'] },
          { path: 'team', lazy: pageLoaders['/team'] },
          { path: 'journey', lazy: pageLoaders['/journey'] },
          { path: 'settings', lazy: pageLoaders['/settings'] },
        ],
      },
    ],
  },
])
