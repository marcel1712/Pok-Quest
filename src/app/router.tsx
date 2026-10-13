import { createBrowserRouter } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { DashboardPage } from '@/pages/DashboardPage'
import { FocusPage } from '@/pages/FocusPage'
import { JourneyPage } from '@/pages/JourneyPage'
import { LoginPage } from '@/pages/LoginPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TasksPage } from '@/pages/TasksPage'
import { TeamPage } from '@/pages/TeamPage'
import { RootLayout } from './RootLayout'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'focus', element: <FocusPage /> },
          { path: 'team', element: <TeamPage /> },
          { path: 'journey', element: <JourneyPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
])
