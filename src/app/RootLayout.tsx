import { MotionConfig } from 'motion/react'
import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from '@/features/auth/api/auth'
import { useFocusPreferences } from '@/features/settings/hooks/use-focus-preferences'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/tasks', label: 'Tarefas' },
  { to: '/focus', label: 'Foco' },
  { to: '/team', label: 'Equipe' },
  { to: '/journey', label: 'Jornada' },
  { to: '/settings', label: 'Configurações' },
]

export function RootLayout() {
  // The single place the in-app "reduce motion" preference is applied: the data
  // attribute switches off CSS transitions/animations (see styles/index.css) and
  // MotionConfig does the same for Motion components. With the preference off, both
  // still follow the operating system's prefers-reduced-motion setting.
  const { preferences } = useFocusPreferences()

  return (
    <MotionConfig reducedMotion={preferences.reduceMotion ? 'always' : 'user'}>
      <div
        data-reduce-motion={preferences.reduceMotion ? 'true' : undefined}
        className="min-h-screen bg-canvas text-ink"
      >
        <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
          <nav
            aria-label="Principal"
            className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-2 py-2 text-sm"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shrink-0 rounded-control px-3 py-2 transition-colors ${
                    isActive
                      ? 'bg-surface-raised font-semibold text-accent-soft'
                      : 'text-ink-muted hover:text-ink'
                  }`
                }
                end={item.to === '/'}
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => signOut()}
              className="btn btn-ghost btn-sm ml-auto"
            >
              Sair
            </button>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </MotionConfig>
  )
}
