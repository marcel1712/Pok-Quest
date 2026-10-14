import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from '@/features/auth/api/auth'
import { pageLoaders, type PagePath } from './page-loaders'
import { ReducedMotionPreferenceContext } from '@/shared/hooks/use-reduced-motion'
import { useFocusPreferences } from '@/features/settings/hooks/use-focus-preferences'

const navItems: { to: PagePath; label: string }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/tasks', label: 'Tarefas' },
  { to: '/focus', label: 'Foco' },
  { to: '/team', label: 'Equipe' },
  { to: '/journey', label: 'Jornada' },
  { to: '/settings', label: 'Configurações' },
]

export function RootLayout() {
  // The single place the in-app "reduce motion" preference is applied: the data
  // attribute switches off CSS transitions/animations (see styles/index.css) and the
  // context tells components about motion CSS cannot stop (animated GIFs). With the
  // preference off, both still follow the operating system's setting.
  const { preferences } = useFocusPreferences()

  return (
    <ReducedMotionPreferenceContext value={preferences.reduceMotion}>
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
                // Restricted prefetch: only the code for the page being pointed at, never
                // its data. A repeated import() is a no-op once the chunk is loaded.
                onPointerEnter={() => void pageLoaders[item.to]()}
                onFocus={() => void pageLoaders[item.to]()}
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
    </ReducedMotionPreferenceContext>
  )
}
