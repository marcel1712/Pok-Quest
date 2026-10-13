import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from './RootLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { TasksPage } from '@/pages/TasksPage'
import { FocusPage } from '@/pages/FocusPage'
import { TeamPage } from '@/pages/TeamPage'
import { JourneyPage } from '@/pages/JourneyPage'
import { SettingsPage } from '@/pages/SettingsPage'

export const router = createBrowserRouter([
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
])
