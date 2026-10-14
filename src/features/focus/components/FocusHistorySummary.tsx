import { useFocusHistory } from '../hooks/use-focus-history'

export function FocusHistorySummary() {
  const { isLoading, isError, summary } = useFocusHistory()

  if (isLoading || isError || !summary) return null

  return (
    <div className="card flex gap-6 text-sm">
      <div>
        <p className="text-ink-muted">Hoje</p>
        <p className="text-lg font-semibold text-ink">
          {summary.today.sessionCount} {summary.today.sessionCount === 1 ? 'sessão' : 'sessões'} ·{' '}
          {summary.today.focusedMinutes} min
        </p>
      </div>
      <div>
        <p className="text-ink-muted">Últimos 7 dias</p>
        <p className="text-lg font-semibold text-ink">
          {summary.last7Days.sessionCount}{' '}
          {summary.last7Days.sessionCount === 1 ? 'sessão' : 'sessões'} ·{' '}
          {summary.last7Days.focusedMinutes} min
        </p>
      </div>
    </div>
  )
}
