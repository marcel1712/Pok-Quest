import { useBadges } from '@/features/journey/hooks/use-badges'
import { useJourney } from '@/features/journey/hooks/use-journey'
import { WidgetCard } from './WidgetCard'

export function JourneyWidget({ className }: { className?: string }) {
  const { journey, objective, isLoading, isError, error } = useJourney()
  const { data: badges } = useBadges()

  const completedCount = journey.filter((entry) => entry.status === 'completed').length
  const percent = journey.length > 0 ? Math.round((completedCount / journey.length) * 100) : 0
  const badgeTotal = journey.filter((entry) => entry.node.badge_name).length

  return (
    <WidgetCard
      className={className}
      title="Jornada"
      linkTo="/journey"
      linkLabel="Ver jornada"
      isLoading={isLoading}
      error={isError ? error : null}
    >
      {journey.length === 0 ? (
        <p className="text-slate-400">Nenhum conteúdo de campanha disponível ainda.</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-slate-100">
              {objective ? objective.node.title : 'História concluída'}
            </p>
            <p className="shrink-0 text-lg font-semibold text-slate-100">{percent}%</p>
          </div>
          <div
            role="progressbar"
            aria-label="Conclusão da história"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 overflow-hidden rounded bg-slate-800"
          >
            <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-sm text-slate-400">
            {completedCount} de {journey.length} etapas · {badges?.length ?? 0}/{badgeTotal}{' '}
            insígnias
          </p>
        </>
      )}
    </WidgetCard>
  )
}
