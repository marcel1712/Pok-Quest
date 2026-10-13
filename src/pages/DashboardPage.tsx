import { StarterOnboarding } from '@/features/journey/components/StarterOnboarding'

export function DashboardPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="mt-2 text-slate-400">
          Tarefas de hoje, próximo encontro e resumo da equipe aparecerão aqui.
        </p>
      </div>

      <StarterOnboarding />
    </section>
  )
}
