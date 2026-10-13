import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/tasks', label: 'Tarefas' },
  { to: '/focus', label: 'Foco' },
  { to: '/team', label: 'Equipe' },
  { to: '/journey', label: 'Jornada' },
  { to: '/settings', label: 'Configurações' },
]

export function RootLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <nav className="flex gap-4 overflow-x-auto px-4 py-3 text-sm">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'font-semibold text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
