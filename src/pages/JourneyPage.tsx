import { useState } from 'react'
import { BadgeCase } from '@/features/journey/components/BadgeCase'
import { JourneyNodeList } from '@/features/journey/components/JourneyNodeList'
import { StarterOnboarding } from '@/features/journey/components/StarterOnboarding'
import { useBadges } from '@/features/journey/hooks/use-badges'
import { useJourney } from '@/features/journey/hooks/use-journey'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { ProgressBar } from '@/shared/ui/ProgressBar'

const STEPS_PER_PAGE = 10

export function JourneyPage() {
  const { journey, objective, isLoading, isError, error } = useJourney()
  const { data: badges } = useBadges()
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
        <h1 className="page-title">Jornada</h1>
        <p className="mt-2 text-ink-muted">
          Vença encontros na tela de Foco para avançar por Sinnoh. Nada aqui regride em dias sem
          atividade.
        </p>
      </div>

      <StarterOnboarding />

      {isLoading && <p className="text-ink-muted">Carregando…</p>}

      {isError && (
        <p role="alert" className="text-danger">
          {toFriendlyErrorMessage(error)}
        </p>
      )}

      {!isLoading && !isError && journey.length === 0 && (
        <p className="text-ink-muted">Nenhum conteúdo de campanha disponível ainda.</p>
      )}

      {journey.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-ink-muted">
                {completedCount} de {journey.length} etapas concluídas
              </p>
              <p className="text-lg font-semibold text-ink">{completionPercent}%</p>
            </div>
            <ProgressBar label="Conclusão da história" value={completionPercent} />
          </div>

          <BadgeCase journey={journey} badges={badges ?? []} />

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
                className="btn btn-outline btn-sm"
              >
                Anterior
              </button>
              <div className="flex flex-col items-center gap-1 text-sm text-ink-muted">
                <span>
                  Página {page + 1} de {pageCount}
                </span>
                {page !== objectivePage && (
                  <button type="button" onClick={() => setSelectedPage(null)} className="link">
                    Ir para onde parei
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={page === pageCount - 1}
                onClick={() => setSelectedPage(page + 1)}
                className="btn btn-outline btn-sm"
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
