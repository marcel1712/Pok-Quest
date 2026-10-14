import { StarterOnboarding } from '@/features/journey/components/StarterOnboarding'
import { useOnlineStatus } from '@/shared/hooks/use-online-status'
import { FocusWidget } from './dashboard/FocusWidget'
import { JourneyWidget } from './dashboard/JourneyWidget'
import { TasksWidget } from './dashboard/TasksWidget'
import { TeamWidget } from './dashboard/TeamWidget'

/**
 * Actions first (tasks, focus), status second (team, journey). Every section reads
 * through the same hooks — and therefore the same cache entries — as its full page,
 * and loads and fails on its own.
 */
export function DashboardPage() {
  const isOnline = useOnlineStatus()

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>

      {!isOnline && (
        <p role="status" className="rounded border border-amber-400/60 p-3 text-sm text-amber-300">
          Você está offline. O que aparece aqui são os últimos dados carregados, e alterações podem
          não ser salvas até a conexão voltar.
        </p>
      )}

      <StarterOnboarding />

      {/* One column on phones, in reading order: start focusing, then today's tasks,
          then status. On wide screens the task list takes the left column. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr] lg:items-start">
        <FocusWidget className="lg:col-start-2" />
        <TasksWidget className="lg:col-start-1 lg:row-span-3 lg:row-start-1" />
        <TeamWidget className="lg:col-start-2" />
        <JourneyWidget className="lg:col-start-2" />
      </div>
    </section>
  )
}
