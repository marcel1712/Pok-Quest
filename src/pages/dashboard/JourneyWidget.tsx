import { useBadges } from '@/features/journey/hooks/use-badges'
import { useJourney } from '@/features/journey/hooks/use-journey'
import { WidgetCard } from './WidgetCard'
import { ProgressBar } from '@/shared/ui/ProgressBar'

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
        <p className="text-ink-muted">Nenhum conteúdo de campanha disponível ainda.</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-ink">
              {objective ? objective.node.title : 'História concluída'}
            </p>
            <p className="shrink-0 text-lg font-semibold text-ink">{percent}%</p>
          </div>
          <ProgressBar label="Conclusão da história" value={percent} />
          <p className="text-sm text-ink-muted">
            {completedCount} de {journey.length} etapas · {badges?.length ?? 0}/{badgeTotal}{' '}
            insígnias
          </p>
        </>
      )}
    </WidgetCard>
  )
}
