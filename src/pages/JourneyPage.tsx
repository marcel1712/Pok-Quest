import { useState } from 'react'
import { JourneyNodeList } from '@/features/journey/components/JourneyNodeList'
import { StarterOnboarding } from '@/features/journey/components/StarterOnboarding'
import { useJourney } from '@/features/journey/hooks/use-journey'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'

const STEPS_PER_PAGE = 10

export function JourneyPage() {
  const { journey, objective, isLoading, isError, error } = useJourney()
  // null = follow the player: show the page where the next encounter is.
  const [selectedPage, setSelectedPage] = useState<number | null>(null)

  const completedCount = journey.filter((entry) => entry.status === 'completed').length
  const completionPercent =
    journey.length > 0 ? Math.round((completedCount / journey.length) * 100) : 0

  const pageCount = Math.max(1, Math.ceil(journey.length / STEPS_PER_PAGE))
  const objectiveIndex = objective
    ? journey.findIndex((entry) => entry.node.id === objective.node.id)
    : 0
  const objectivePage = Math.floor(Math.max(0, objectiveIndex) / STEPS_PER_PAGE)
  const page = Math.min(selectedPage ?? objectivePage, pageCount - 1)
  const pageEntries = journey.slice(page * STEPS_PER_PAGE, (page + 1) * STEPS_PER_PAGE)

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Jornada</h1>
        <p className="mt-2 text-slate-400">
          Vença encontros na tela de Foco para avançar por Sinnoh. Nada aqui regride em dias sem
          atividade.
        </p>
      </div>

      <StarterOnboarding />

      {isLoading && <p className="text-slate-400">Carregando…</p>}

      {isError && (
        <p role="alert" className="text-red-400">
          {toFriendlyErrorMessage(error)}
        </p>
      )}

      {!isLoading && !isError && journey.length === 0 && (
        <p className="text-slate-400">Nenhum conteúdo de campanha disponível ainda.</p>
      )}

      {journey.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-slate-400">
                {completedCount} de {journey.length} etapas concluídas
              </p>
              <p className="text-lg font-semibold text-slate-100">{completionPercent}%</p>
            </div>
            <div
              role="progressbar"
              aria-label="Conclusão da história"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completionPercent}
              className="h-2 overflow-hidden rounded bg-slate-800"
            >
              <div className="h-full bg-emerald-500" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>

          <JourneyNodeList journey={pageEntries} objectiveNodeId={objective?.node.id ?? null} />

          {pageCount > 1 && (
            <nav
              aria-label="Páginas da jornada"
              className="flex items-center justify-between gap-3"
            >
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setSelectedPage(page - 1)}
                className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40"
              >
                Anterior
              </button>
              <div className="flex flex-col items-center gap-1 text-sm text-slate-400">
                <span>
                  Página {page + 1} de {pageCount}
                </span>
                {page !== objectivePage && (
                  <button
                    type="button"
                    onClick={() => setSelectedPage(null)}
                    className="text-emerald-400 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    Ir para onde parei
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={page === pageCount - 1}
                onClick={() => setSelectedPage(page + 1)}
                className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40"
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
