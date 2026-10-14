// Each page is its own chunk (T-034): a visit downloads the shell plus the page it asked
// for, not all six. Kept apart from the router so the navigation can warm a chunk up
// (on hover/focus) without importing the router itself.
export const pageLoaders = {
  '/': () => import('@/pages/DashboardPage').then((m) => ({ Component: m.DashboardPage })),
  '/tasks': () => import('@/pages/TasksPage').then((m) => ({ Component: m.TasksPage })),
  '/focus': () => import('@/pages/FocusPage').then((m) => ({ Component: m.FocusPage })),
  '/team': () => import('@/pages/TeamPage').then((m) => ({ Component: m.TeamPage })),
  '/journey': () => import('@/pages/JourneyPage').then((m) => ({ Component: m.JourneyPage })),
  '/history': () => import('@/pages/HistoryPage').then((m) => ({ Component: m.HistoryPage })),
  '/settings': () => import('@/pages/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
} as const

export type PagePath = keyof typeof pageLoaders
